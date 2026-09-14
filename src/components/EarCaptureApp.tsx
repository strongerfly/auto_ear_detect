import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { poseConfig, type EarSide, type PromptKey } from "../config";
import { AngleHud } from "./AngleHud";
import { InstructionsPanel } from "./InstructionsPanel";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { DEFAULT_SIM, SimulatorPanel, type SimState } from "./SimulatorPanel";
import { useFaceLandmarker } from "../hooks/useFaceLandmarker";
import { useWebcam } from "../hooks/useWebcam";
import { useLocale } from "../i18n";
import { dwellPrompt, INITIAL_DWELL, type DwellState } from "../lib/dwell";
import { matrixToFiswgEuler } from "../lib/euler";
import { evaluateGuidance, isAngleStable } from "../lib/guidance";
import {
  earRoiBox,
  faceHeightRatio,
  meanPresence,
  meanVisibility,
} from "../lib/landmarks";
import { EulerSmoother } from "../lib/one-euro";
import {
  loadOffsets,
  offsetFromPeakYaw,
  saveOffsets,
  yawInCalibrationBand,
  type OffsetMap,
} from "../lib/offsets";
import { measureEarQuality } from "../lib/quality";
import type { EarQuality, EulerDeg, RoiBox } from "../lib/types";

type LiveState = {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  prompt: PromptKey;
  allowCapture: boolean;
  roi: RoiBox | null;
  quality: EarQuality | null;
  faceHeightRatio: number;
};

const INITIAL_LIVE: LiveState = {
  yaw: null,
  pitch: null,
  roll: null,
  prompt: "NO_FACE",
  allowCapture: false,
  roi: null,
  quality: null,
  faceHeightRatio: 0,
};

export function EarCaptureApp() {
  const { locale, t } = useLocale();
  const { videoRef, ready: camReady, error: camError, start, stop } =
    useWebcam();
  const { landmarker, error: lmError, loading: lmLoading } =
    useFaceLandmarker();
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  const [side, setSide] = useState<EarSide>("rightEar");
  const [offsets, setOffsets] = useState<OffsetMap>(() => loadOffsets());
  const [autoShutter, setAutoShutter] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const [calibBest, setCalibBest] = useState({ laplacian: -1, yaw: 0 });
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [sim, setSim] = useState<SimState>(DEFAULT_SIM);
  const [live, setLive] = useState<LiveState>(INITIAL_LIVE);
  const [status, setStatus] = useState(() => t("loadingLandmarker"));

  const sideRef = useRef(side);
  const offsetsRef = useRef(offsets);
  const simRef = useRef(sim);
  const calibratingRef = useRef(calibrating);
  const autoShutterRef = useRef(autoShutter);
  const shutterLatch = useRef(false);
  const dwellRef = useRef<DwellState>(INITIAL_DWELL);
  const lastAngles = useRef<EulerDeg | null>(null);
  const stableFrames = useRef(0);
  const lastVideoTime = useRef(-1);
  const smootherRef = useRef<EulerSmoother | null>(null);
  const calibBestRef = useRef({ laplacian: -1, yaw: 0 });

  sideRef.current = side;
  offsetsRef.current = offsets;
  simRef.current = sim;
  calibratingRef.current = calibrating;
  autoShutterRef.current = autoShutter;

  useEffect(() => {
    const o = poseConfig.smoothing.oneEuro;
    smootherRef.current = new EulerSmoother(o.minCutoff, o.beta, o.dCutoff);
  }, []);

  const offset = offsets[side];
  const promptText = t(live.prompt);

  const liveRef = useRef(live);
  liveRef.current = live;

  const captureStill = useCallback(() => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const snap = liveRef.current;
    const label = tRef.current;
    if (simRef.current.enabled || !video || video.readyState < 2) {
      canvas.width = 960;
      canvas.height = 540;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawSimStill(
        ctx,
        canvas.width,
        canvas.height,
        sideRef.current,
        simRef.current,
        snap.yaw,
        snap.pitch,
        snap.roll,
        label(sideRef.current === "rightEar" ? "simStillRight" : "simStillLeft"),
        label(sideRef.current === "rightEar" ? "roiRight" : "roiLeft"),
      );
    } else {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
    }
    const url = canvas.toDataURL("image/png");
    setLastCapture(url);
  }, [videoRef]);

  const captureStillRef = useRef(captureStill);
  captureStillRef.current = captureStill;

  useEffect(() => {
    if (!lmLoading && landmarker) {
      setStatus(t("clickToStart"));
    } else if (lmError) {
      setStatus(t("modelLoadFailed", { error: lmError }));
    } else {
      setStatus(t("loadingLandmarker"));
    }
  }, [landmarker, lmError, lmLoading, t]);

  useEffect(() => {
    let raf = 0;
    const scratch = sampleRef.current;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const currentSide = sideRef.current;
      const simState = simRef.current;
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const roiLabel = tRef.current(
        currentSide === "rightEar" ? "roiRight" : "roiLeft",
      );

      let yaw: number | null = null;
      let pitch: number | null = null;
      let roll: number | null = null;
      let hasFace = false;
      let presence = 0;
      let tracking = 0;
      let heightRatio = 0;
      let roi: RoiBox | null = null;
      let quality: EarQuality | null = null;

      if (simState.enabled) {
        hasFace = simState.hasFace;
        presence = hasFace ? 1 : 0;
        tracking = hasFace ? 1 : 0;
        heightRatio = simState.faceHeightRatio;
        yaw = simState.yaw;
        pitch = simState.pitch;
        roll = simState.roll;
        quality = simState.quality;
        if (overlay) {
          drawSimOverlay(overlay, currentSide, simState, roiLabel);
        }
      } else if (
        landmarker &&
        video &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTime.current
      ) {
        lastVideoTime.current = video.currentTime;
        let result: FaceLandmarkerResult | null = null;
        try {
          result = landmarker.detectForVideo(video, now);
        } catch {
          result = null;
        }
        const face = result?.faceLandmarks?.[0];
        const mat = result?.facialTransformationMatrixes?.[0];
        if (face && mat?.data) {
          hasFace = true;
          presence = meanPresence(face);
          tracking = meanVisibility(face);
          heightRatio = faceHeightRatio(face);
          let euler = matrixToFiswgEuler(mat.data);
          if (poseConfig.smoothing.enabled && smootherRef.current) {
            euler = smootherRef.current.filter(
              euler.yaw,
              euler.pitch,
              euler.roll,
              now,
            );
          }
          yaw = euler.yaw;
          pitch = euler.pitch;
          roll = euler.roll;
          roi = earRoiBox(
            face,
            currentSide,
            video.videoWidth,
            video.videoHeight,
          );
          if (roi && scratch) {
            scratch.width = roi.w;
            scratch.height = roi.h;
            const sctx = scratch.getContext("2d", { willReadFrequently: true });
            if (sctx) {
              sctx.drawImage(
                video,
                roi.x,
                roi.y,
                roi.w,
                roi.h,
                0,
                0,
                roi.w,
                roi.h,
              );
              quality = measureEarQuality(
                sctx.getImageData(0, 0, roi.w, roi.h),
              );
            }
          }
        } else {
          smootherRef.current?.reset();
        }
        if (overlay && video.videoWidth) {
          drawCameraOverlay(
            overlay,
            video.videoWidth,
            video.videoHeight,
            roi,
            currentSide,
            roiLabel,
          );
        }
      } else if (!simState.enabled && overlay && video && video.videoWidth) {
        drawCameraOverlay(
          overlay,
          video.videoWidth,
          video.videoHeight,
          null,
          currentSide,
          roiLabel,
        );
      }

      const angles: EulerDeg | null =
        yaw === null || pitch === null || roll === null
          ? null
          : { yaw, pitch, roll };

      if (!hasFace || !angles) {
        stableFrames.current = 0;
        lastAngles.current = null;
      } else if (
        isAngleStable(angles, lastAngles.current, poseConfig)
      ) {
        stableFrames.current += 1;
      } else {
        stableFrames.current = 0;
      }
      lastAngles.current = angles;

      const guidance = evaluateGuidance(
        {
          hasFace,
          facePresence: presence,
          trackingConfidence: tracking,
          faceHeightRatio: heightRatio,
          yaw: yaw ?? 0,
          pitch: pitch ?? 0,
          roll: roll ?? 0,
          quality,
        },
        poseConfig,
        currentSide,
        offsetsRef.current[currentSide],
        stableFrames.current,
      );

      dwellRef.current = dwellPrompt(
        dwellRef.current,
        guidance.prompt,
        now,
        poseConfig.promptUx.minDwellMs,
      );
      const shown = dwellRef.current.displayed ?? guidance.prompt;

      if (
        calibratingRef.current &&
        angles &&
        quality &&
        yawInCalibrationBand(angles.yaw)
      ) {
        if (quality.laplacian > calibBestRef.current.laplacian) {
          calibBestRef.current = {
            laplacian: quality.laplacian,
            yaw: angles.yaw,
          };
          setCalibBest(calibBestRef.current);
        }
      }

      if (guidance.allowCapture && autoShutterRef.current && !shutterLatch.current) {
        shutterLatch.current = true;
        captureStillRef.current();
      }
      if (!guidance.allowCapture) {
        shutterLatch.current = false;
      }

      setLive({
        yaw,
        pitch,
        roll,
        prompt: shown,
        allowCapture: guidance.allowCapture,
        roi,
        quality,
        faceHeightRatio: heightRatio,
      });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [landmarker, videoRef]);

  const startCalibration = () => {
    calibBestRef.current = { laplacian: -1, yaw: 0 };
    setCalibBest(calibBestRef.current);
    setCalibrating(true);
  };

  const finishCalibration = () => {
    setCalibrating(false);
    if (calibBestRef.current.laplacian < 0) return;
    const next = {
      ...offsets,
      [side]: offsetFromPeakYaw(side, calibBestRef.current.yaw),
    };
    setOffsets(next);
    saveOffsets(next);
  };

  const clearOffset = () => {
    const next = { ...offsets, [side]: 0 };
    setOffsets(next);
    saveOffsets(next);
  };

  const downloadCapture = () => {
    if (!lastCapture) return;
    const a = document.createElement("a");
    a.href = lastCapture;
    const tag = side === "rightEar" ? "right-ear" : "left-ear";
    a.download = `${tag}-${Date.now()}.png`;
    a.click();
  };

  const stageHint = useMemo(() => {
    if (sim.enabled) return t("simMode");
    if (camError) return t("cameraError", { error: camError });
    if (!camReady) return t("cameraOff");
    return t("previewHint");
  }, [camError, camReady, sim.enabled, t]);

  const calibPeak =
    calibBest.laplacian < 0
      ? "—"
      : `${calibBest.laplacian.toFixed(0)} @ ${calibBest.yaw.toFixed(1)}°`;

  return (
    <div className="app" data-locale={locale}>
      <header className="top">
        <div>
          <p className="eyebrow">Auto Ear Detect</p>
          <h1>{t("appTitle")}</h1>
        </div>
        <div className="top-actions">
          <LocaleSwitcher />
          <div className="modes" role="tablist" aria-label={t("sideAriaLabel")}>
            <button
              type="button"
              role="tab"
              aria-selected={side === "leftEar"}
              className={side === "leftEar" ? "on" : ""}
              onClick={() => setSide("leftEar")}
            >
              {t("shootLeftEar")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={side === "rightEar"}
              className={side === "rightEar" ? "on" : ""}
              onClick={() => setSide("rightEar")}
            >
              {t("shootRightEar")}
            </button>
          </div>
        </div>
      </header>

      <p className="status">{status}</p>

      <section className={`stage ${live.allowCapture ? "ready" : ""}`}>
        <video
          ref={videoRef}
          className="cam"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={overlayRef} className="overlay" />
        <canvas ref={sampleRef} className="scratch" />
        <div className="prompt" data-ready={live.allowCapture}>
          {promptText}
        </div>
        <span className="stage-tag">{stageHint}</span>
      </section>

      <AngleHud
        yaw={live.yaw}
        pitch={live.pitch}
        roll={live.roll}
        offset={offset}
        prompt={live.prompt}
      />

      <div className="dock">
        <button type="button" className="ghost" onClick={() => void start()}>
          {t("openCamera")}
        </button>
        <button type="button" className="ghost" onClick={stop}>
          {t("closeCamera")}
        </button>
        <button
          type="button"
          className="capture"
          disabled={!live.allowCapture}
          onClick={captureStill}
        >
          {t("capture")}
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={autoShutter}
            onChange={(e) => setAutoShutter(e.target.checked)}
          />
          {t("autoShutter")}
        </label>
        <button
          type="button"
          className="ghost"
          disabled={!lastCapture}
          onClick={downloadCapture}
        >
          {t("downloadLast")}
        </button>
      </div>

      <div className="dock">
        {calibrating ? (
          <>
            <span className="calib-note">
              {t("calibNote", { peak: calibPeak })}
            </span>
            <button type="button" className="ghost" onClick={finishCalibration}>
              {t("finishCalibrate")}
            </button>
          </>
        ) : (
          <button type="button" className="ghost" onClick={startCalibration}>
            {t("calibrate")}
          </button>
        )}
        <button type="button" className="ghost" onClick={clearOffset}>
          {t("clearOffset")}
        </button>
        {live.quality ? (
          <span className="calib-note">
            {t("qualityNote", {
              laplacian: live.quality.laplacian.toFixed(0),
              brightness: live.quality.brightness.toFixed(0),
              edge: live.quality.edgeEnergy.toFixed(0),
            })}
          </span>
        ) : null}
      </div>

      {lastCapture ? (
        <figure className="preview">
          <figcaption>{t("lastCaptureCaption")}</figcaption>
          <img src={lastCapture} alt={t("lastCaptureAlt")} />
        </figure>
      ) : null}

      <InstructionsPanel />

      <SimulatorPanel sim={sim} onChange={setSim} />

      <footer className="foot">
        <p>{t("footer")}</p>
      </footer>
    </div>
  );
}

function drawCameraOverlay(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  roi: RoiBox | null,
  side: EarSide,
  roiLabel: string,
) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  if (!roi) return;
  ctx.strokeStyle = side === "rightEar" ? "#5ee0b5" : "#8fd3ff";
  ctx.lineWidth = Math.max(3, width / 400);
  ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
  ctx.font = `${Math.max(18, width / 45)}px ui-sans-serif, sans-serif`;
  ctx.fillStyle = ctx.strokeStyle;
  fillUnmirroredText(ctx, roiLabel, roi.x + 8, roi.y + 28);
}

function drawSimOverlay(
  canvas: HTMLCanvasElement,
  side: EarSide,
  sim: SimState,
  roiLabel: string,
) {
  const width = 960;
  const height = 540;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(8, 18, 16, 0.35)";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-sim.roll * Math.PI) / 180);
  ctx.fillStyle = sim.hasFace ? "#c9a07a" : "#2a3834";
  ctx.beginPath();
  ctx.ellipse(0, 0, 90, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1612";
  ctx.beginPath();
  ctx.ellipse(-28, -20, 8, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(28, -20, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const roiX = side === "rightEar" ? 160 : 680;
  ctx.strokeStyle = "#5ee0b5";
  ctx.lineWidth = 3;
  ctx.strokeRect(roiX, 180, 140, 180);
  ctx.fillStyle = "#5ee0b5";
  ctx.font = "20px ui-sans-serif, sans-serif";
  fillUnmirroredText(ctx, roiLabel, roiX + 8, 170);
}

/** Canvas is CSS-mirrored with the selfie preview; pre-flip glyphs so they read LTR. */
function fillUnmirroredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  const w = ctx.measureText(text).width;
  ctx.save();
  ctx.translate(x + w, y);
  ctx.scale(-1, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawSimStill(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  side: EarSide,
  sim: SimState,
  yaw: number | null,
  pitch: number | null,
  roll: number | null,
  title: string,
  roiLabel: string,
) {
  ctx.fillStyle = "#e7f4ee";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#0b1210";
  ctx.font = "32px ui-sans-serif, sans-serif";
  ctx.fillText(title, 40, 56);
  ctx.font = "22px ui-sans-serif, sans-serif";
  ctx.fillText(
    `yaw ${yaw?.toFixed(1) ?? "—"}°   pitch ${pitch?.toFixed(1) ?? "—"}°   roll ${roll?.toFixed(1) ?? "—"}°`,
    40,
    96,
  );

  ctx.save();
  ctx.translate(width / 2, height / 2 + 20);
  ctx.rotate(((-(roll ?? 0)) * Math.PI) / 180);
  ctx.fillStyle = sim.hasFace ? "#c9a07a" : "#7a8a84";
  ctx.beginPath();
  ctx.ellipse(0, 0, 90, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1612";
  ctx.beginPath();
  ctx.ellipse(-28, -20, 8, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(28, -20, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const roiX = side === "rightEar" ? 160 : 680;
  ctx.strokeStyle = "#1a4f43";
  ctx.lineWidth = 4;
  ctx.strokeRect(roiX, 180, 140, 180);
  ctx.fillStyle = "#1a4f43";
  ctx.font = "20px ui-sans-serif, sans-serif";
  ctx.fillText(roiLabel, roiX + 8, 170);
}
