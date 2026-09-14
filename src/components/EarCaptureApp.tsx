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
import {
  INITIAL_AUTOSHUTTER,
  loadAutoShutterEnabled,
  saveAutoShutterEnabled,
  stepAutoshutter,
  type AutoshutterState,
} from "../lib/autoshutter";
import { pickBurstByScore, scoreBurstFrame } from "../lib/burst";
import { dwellPrompt, INITIAL_DWELL, type DwellState } from "../lib/dwell";
import { matrixToFiswgEuler } from "../lib/euler";
import {
  captureUiFor,
  evaluateGuidance,
  isAngleStable,
  type CaptureUi,
} from "../lib/guidance";
import {
  earRoiBox,
  faceHeightRatio,
  meanPresence,
  meanVisibility,
} from "../lib/landmarks";
import { EulerSmoother } from "../lib/one-euro";
import {
  loadPersonalBests,
  savePersonalBests,
  updatePersonalBest,
  type PersonalBestMap,
} from "../lib/personal-best";
import { measureEarQuality, qualityAlongYawCurve } from "../lib/quality";
import {
  startRelearnHoldoff,
  stepRelearnHoldoff,
  type RelearnHoldoff,
} from "../lib/relearn";
import type { EarQuality, EulerDeg, RoiBox } from "../lib/types";

type LiveState = {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  prompt: PromptKey;
  allowCapture: boolean;
  captureUi: CaptureUi;
  roi: RoiBox | null;
  quality: EarQuality | null;
  faceHeightRatio: number;
  shutterRemainingMs: number | null;
  overshootPastBestDeg: number;
};

const INITIAL_LIVE: LiveState = {
  yaw: null,
  pitch: null,
  roll: null,
  prompt: "NO_FACE",
  allowCapture: false,
  captureUi: "learning",
  roi: null,
  quality: null,
  faceHeightRatio: 0,
  shutterRemainingMs: null,
  overshootPastBestDeg: poseConfig.ready.overshootPastBestDeg,
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
  const [bests, setBests] = useState<PersonalBestMap>(() => loadPersonalBests());
  const [autoShutter, setAutoShutter] = useState(() => loadAutoShutterEnabled());
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [sim, setSim] = useState<SimState>(DEFAULT_SIM);
  const [live, setLive] = useState<LiveState>(INITIAL_LIVE);
  const [status, setStatus] = useState(() => t("loadingLandmarker"));
  const [relearnOpen, setRelearnOpen] = useState(false);

  const sideRef = useRef(side);
  const bestsRef = useRef(bests);
  const simRef = useRef(sim);
  const autoShutterRef = useRef(autoShutter);
  const shutterLatch = useRef(false);
  const shutterRef = useRef<AutoshutterState>(INITIAL_AUTOSHUTTER);
  const cancelShutterRef = useRef(false);
  const wasInReadyBand = useRef(false);
  const relearnHoldoffRef = useRef<RelearnHoldoff | null>(null);
  const dwellRef = useRef<DwellState>(INITIAL_DWELL);
  const lastAngles = useRef<EulerDeg | null>(null);
  const stableFrames = useRef(0);
  const lastVideoTime = useRef(-1);
  const smootherRef = useRef<EulerSmoother | null>(null);

  sideRef.current = side;
  bestsRef.current = bests;
  simRef.current = sim;
  autoShutterRef.current = autoShutter;

  useEffect(() => {
    const o = poseConfig.smoothing.oneEuro;
    smootherRef.current = new EulerSmoother(o.minCutoff, o.beta, o.dCutoff);
  }, []);

  useEffect(() => {
    dwellRef.current = INITIAL_DWELL;
    wasInReadyBand.current = false;
    shutterRef.current = INITIAL_AUTOSHUTTER;
  }, [side]);

  const personalBest = bests[side];
  const promptText = t(live.prompt);

  const liveRef = useRef(live);
  liveRef.current = live;

  const captureStill = useCallback(() => {
    const best = pickBurstByScore(shutterRef.current.burst);
    if (best?.dataUrl) {
      setLastCapture(best.dataUrl);
      shutterLatch.current = true;
      cancelShutterRef.current = true;
      return;
    }
    const url = renderStillDataUrl(
      videoRef.current,
      sideRef.current,
      simRef.current,
      liveRef.current.yaw,
      liveRef.current.pitch,
      liveRef.current.roll,
      tRef.current,
    );
    if (url) setLastCapture(url);
  }, [videoRef]);

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
      let faceCount = 0;

      if (simState.enabled) {
        hasFace = simState.hasFace;
        faceCount = hasFace ? 1 : 0;
        presence = hasFace ? 1 : 0;
        tracking = hasFace ? 1 : 0;
        heightRatio = simState.faceHeightRatio;
        yaw = simState.yaw;
        pitch = simState.pitch;
        roll = simState.roll;
        quality = simState.qualityFollowsYaw
          ? qualityAlongYawCurve(
              simState.yaw,
              simState.qualityPeakYaw,
              simState.quality,
            )
          : simState.quality;
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
        faceCount = result?.faceLandmarks?.length ?? 0;
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
      const yawDeltaSigned =
        lastAngles.current && angles
          ? angles.yaw - lastAngles.current.yaw
          : 0;
      const yawDelta = Math.abs(yawDeltaSigned);
      lastAngles.current = angles;

      relearnHoldoffRef.current = stepRelearnHoldoff(
        relearnHoldoffRef.current,
        currentSide,
        yaw,
        poseConfig.search.relearnSweepMinDeg,
      );
      const holdoff = relearnHoldoffRef.current;
      const deferBest = holdoff !== null && holdoff.side === currentSide;

      if (hasFace && angles && quality && !deferBest) {
        const prevPeak = bestsRef.current[currentSide];
        const nextPeak = updatePersonalBest(prevPeak, {
          yaw: angles.yaw,
          pitch: angles.pitch,
          roll: angles.roll,
          quality,
          side: currentSide,
        });
        if (nextPeak !== prevPeak) {
          const nextMap = { ...bestsRef.current, [currentSide]: nextPeak };
          bestsRef.current = nextMap;
          setBests(nextMap);
          savePersonalBests(nextMap);
        }
      }

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
          faceCount,
        },
        poseConfig,
        currentSide,
        bestsRef.current[currentSide],
        stableFrames.current,
        {
          yawDelta,
          yawDeltaSigned,
          wasInReadyBand: wasInReadyBand.current,
        },
      );
      wasInReadyBand.current = guidance.poseReady;

      dwellRef.current = dwellPrompt(
        dwellRef.current,
        guidance.prompt,
        now,
        poseConfig.promptUx,
      );
      const shown = dwellRef.current.displayed ?? guidance.prompt;

      let shutterRemainingMs: number | null = null;
      const cancelClick = cancelShutterRef.current;
      cancelShutterRef.current = false;

      const wantBurst =
        guidance.allowCapture &&
        autoShutterRef.current &&
        !shutterLatch.current &&
        shutterRef.current.phase !== "counting" &&
        shutterRef.current.phase !== "cancelled";
      const burstFrame =
        wantBurst && shutterRef.current.burst.length < poseConfig.ready.burstFrames
          ? {
              score: scoreBurstFrame(quality, yaw),
              capturedAt: now,
              dataUrl:
                renderStillDataUrl(
                  video,
                  currentSide,
                  simState,
                  yaw,
                  pitch,
                  roll,
                  tRef.current,
                ) ?? "",
            }
          : null;

      const shutter = stepAutoshutter(shutterRef.current, {
        now,
        enabled: autoShutterRef.current && !shutterLatch.current,
        allowCapture: guidance.allowCapture,
        cancelClick,
        frame: burstFrame && burstFrame.dataUrl ? burstFrame : null,
        burstFrames: poseConfig.ready.burstFrames,
        autoshutterMs: poseConfig.ready.autoshutterMs,
      });
      shutterRef.current = shutter.state;
      if (shutter.state.phase === "counting") {
        shutterRemainingMs = shutter.remainingMs;
      }
      if (shutter.fire) {
        shutterLatch.current = true;
        setLastCapture(shutter.fire.dataUrl);
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
        captureUi: captureUiFor(shown, guidance.allowCapture),
        roi,
        quality,
        faceHeightRatio: heightRatio,
        shutterRemainingMs,
        overshootPastBestDeg: guidance.overshootPastBestDeg,
      });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [landmarker, videoRef]);

  const confirmRelearn = () => {
    const next = { ...bests, [side]: null };
    bestsRef.current = next;
    setBests(next);
    savePersonalBests(next);
    dwellRef.current = INITIAL_DWELL;
    wasInReadyBand.current = false;
    shutterRef.current = INITIAL_AUTOSHUTTER;
    relearnHoldoffRef.current = startRelearnHoldoff(side, liveRef.current.yaw);
    stableFrames.current = 0;
    lastAngles.current = null;
    setRelearnOpen(false);
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
    if (camError === "NotAllowedError" || camError === "NotFoundError") {
      return t("cameraDenied");
    }
    if (camError) return t("cameraError", { error: camError });
    if (!camReady) return t("cameraOff");
    return t("previewHint");
  }, [camError, camReady, sim.enabled, t]);

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

      <section
        className={`stage${live.captureUi === "ready" ? " ready" : live.captureUi === "hold" ? " hold" : ""}`}
      >
        <video
          ref={videoRef}
          className="cam"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={overlayRef} className="overlay" />
        <canvas ref={sampleRef} className="scratch" />
        <div
          className="prompt"
          data-ready={live.allowCapture}
          data-ui={live.captureUi}
        >
          {promptText}
        </div>
        {live.shutterRemainingMs != null ? (
          <div className="shutter-count">
            <span>
              {t("autoshutterCounting", {
                seconds: (live.shutterRemainingMs / 1000).toFixed(1),
              })}
            </span>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                cancelShutterRef.current = true;
              }}
            >
              {t("autoshutterCancel")}
            </button>
          </div>
        ) : null}
        <span className="stage-tag">{stageHint}</span>
      </section>

      <AngleHud
        yaw={live.yaw}
        pitch={live.pitch}
        roll={live.roll}
        bestYaw={personalBest}
        captureUi={live.captureUi}
        overshootPastBestDeg={live.overshootPastBestDeg}
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
          data-ui={live.captureUi}
          disabled={live.captureUi !== "ready"}
          onClick={captureStill}
        >
          {t("capture")}
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={autoShutter}
            onChange={(e) => {
              const on = e.target.checked;
              setAutoShutter(on);
              saveAutoShutterEnabled(on);
            }}
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
        <button
          type="button"
          className="ghost"
          onClick={() => setRelearnOpen(true)}
        >
          {t("relearn")}
        </button>
      </div>

      {relearnOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="relearn-title"
          >
            <p id="relearn-title">{t("relearnConfirm")}</p>
            <div className="modal-actions">
              <button type="button" className="capture" onClick={confirmRelearn}>
                {t("relearnConfirmYes")}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setRelearnOpen(false)}
              >
                {t("relearnConfirmNo")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

function renderStillDataUrl(
  video: HTMLVideoElement | null,
  side: EarSide,
  sim: SimState,
  yaw: number | null,
  pitch: number | null,
  roll: number | null,
  label: (key: "simStillRight" | "simStillLeft" | "roiRight" | "roiLeft") => string,
): string | null {
  const canvas = document.createElement("canvas");
  if (sim.enabled || !video || video.readyState < 2) {
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    drawSimStill(
      ctx,
      canvas.width,
      canvas.height,
      side,
      sim,
      yaw,
      pitch,
      roll,
      label(side === "rightEar" ? "simStillRight" : "simStillLeft"),
      label(side === "rightEar" ? "roiRight" : "roiLeft"),
    );
  } else {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
  }
  return canvas.toDataURL("image/png");
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
