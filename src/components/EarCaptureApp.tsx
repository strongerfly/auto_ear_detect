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
import { pickBurst, rememberBurst, type BurstEntry } from "../lib/burst";
import { matrixToFiswgEuler } from "../lib/euler";
import { evaluateGuidance, isAngleStable } from "../lib/guidance";
import {
  faceHeightRatio,
  meanPresence,
  meanVisibility,
  measureEarRoi,
} from "../lib/landmarks";
import { earSearch } from "../lib/search-band";
import {
  INITIAL_SHUTTER,
  stepShutter,
  type ShutterPhase,
  type ShutterState,
} from "../lib/shutter";
import { extendSweepAbs, stillResweeping, sweepCoverageRatio } from "../lib/sweep";
import { EulerSmoother } from "../lib/one-euro";
import {
  loadPersonalBests,
  savePersonalBests,
  updatePersonalBest,
  type PersonalBestMap,
} from "../lib/personal-best";
import { measureEarQuality, qualityAlongYawCurve, frontalQualityScore } from "../lib/quality";
import type { EarQuality, EulerDeg, RoiBox } from "../lib/types";

type LiveState = {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  prompt: PromptKey;
  allowCapture: boolean;
  phase: "learning" | "hold" | "ready";
  roi: RoiBox | null;
  quality: EarQuality | null;
  faceHeightRatio: number;
  shutterPhase: ShutterPhase;
  countdownLeftMs: number;
};

const INITIAL_LIVE: LiveState = {
  yaw: null,
  pitch: null,
  roll: null,
  prompt: "NO_FACE",
  allowCapture: false,
  phase: "learning",
  roi: null,
  quality: null,
  faceHeightRatio: 0,
  shutterPhase: "idle",
  countdownLeftMs: 0,
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
  const [autoShutter, setAutoShutter] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [sim, setSim] = useState<SimState>(DEFAULT_SIM);
  const [live, setLive] = useState<LiveState>(INITIAL_LIVE);
  const [status, setStatus] = useState(() => t("loadingLandmarker"));

  const sideRef = useRef(side);
  const bestsRef = useRef(bests);
  const simRef = useRef(sim);
  const autoShutterRef = useRef(autoShutter);
  const shutterRef = useRef<ShutterState>(INITIAL_SHUTTER);
  const dwellRef = useRef<DwellState>(INITIAL_DWELL);
  const lastAngles = useRef<EulerDeg | null>(null);
  const stableFrames = useRef(0);
  const lastVideoTime = useRef(-1);
  const smootherRef = useRef<EulerSmoother | null>(null);
  const readyBurst = useRef(0);
  const hadTrackedFace = useRef(false);
  const searchStartedAt = useRef<number | null>(null);
  const wasPoseReady = useRef(false);
  const shutterCancel = useRef(false);
  const burstRing = useRef<BurstEntry<HTMLCanvasElement>[]>([]);
  const sweepMinAbs = useRef<number | null>(null);
  const sweepMaxAbs = useRef<number | null>(null);
  const wrongSideStreak = useRef(0);
  const resweepFromYaw = useRef<number | null>(null);

  sideRef.current = side;
  bestsRef.current = bests;
  simRef.current = sim;
  autoShutterRef.current = autoShutter;

  useEffect(() => {
    const o = poseConfig.smoothing.oneEuro;
    smootherRef.current = new EulerSmoother(o.minCutoff, o.beta, o.dCutoff);
  }, []);

  const resetTransient = useCallback((nextSide: EarSide) => {
    hadTrackedFace.current = false;
    searchStartedAt.current = null;
    dwellRef.current = INITIAL_DWELL;
    wasPoseReady.current = false;
    burstRing.current = [];
    readyBurst.current = 0;
    shutterRef.current = INITIAL_SHUTTER;
    shutterCancel.current = false;
    lastAngles.current = null;
    stableFrames.current = 0;
    sweepMinAbs.current = null;
    sweepMaxAbs.current = null;
    wrongSideStreak.current = 0;
    resweepFromYaw.current = null;
    smootherRef.current?.reset();
    setLive({
      ...INITIAL_LIVE,
      prompt: nextSide === "rightEar" ? "SWEEP_RIGHT_EAR" : "SWEEP_LEFT_EAR",
    });
  }, []);

  useEffect(() => {
    resetTransient(side);
  }, [side, resetTransient]);

  const personalBest = bests[side];
  const promptText = t(live.prompt);

  const liveRef = useRef(live);
  liveRef.current = live;

  const paintCaptureCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      const video = videoRef.current;
      const snap = liveRef.current;
      const label = tRef.current;
      if (simRef.current.enabled || !video || video.readyState < 2) {
        canvas.width = 960;
        canvas.height = 540;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;
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
        return true;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.drawImage(video, 0, 0);
      return true;
    },
    [videoRef],
  );

  const captureStill = useCallback(() => {
    const picked = pickBurst(
      burstRing.current,
      poseConfig.ready.pickBurstBy,
    );
    const canvas = picked?.payload ?? document.createElement("canvas");
    if (!picked && !paintCaptureCanvas(canvas)) return;
    setLastCapture(canvas.toDataURL("image/png"));
  }, [paintCaptureCanvas]);

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
      let roiOutOfFrame = false;
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
          const measured = measureEarRoi(
            face,
            currentSide,
            video.videoWidth,
            video.videoHeight,
          );
          roi = measured?.box ?? null;
          roiOutOfFrame = measured?.clipped ?? false;
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
      const signedYawDelta =
        lastAngles.current && angles
          ? angles.yaw - lastAngles.current.yaw
          : 0;
      const yawDelta = Math.abs(signedYawDelta);
      lastAngles.current = angles;

      if (hasFace) {
        hadTrackedFace.current = true;
        if (searchStartedAt.current === null) searchStartedAt.current = now;
      } else {
        wrongSideStreak.current = 0;
      }

      // Pause scoring/stability already reset above; keep bestYaw (do not clear).
      // Relearn: do not immediately re-lock the same pose — user must actually resweep.
      if (
        !stillResweeping(
          resweepFromYaw.current,
          yaw,
          poseConfig.ready.exitBandDeg,
        )
      ) {
        resweepFromYaw.current = null;
        if (hasFace && angles && quality) {
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
      }

      if (hasFace && angles) {
        const band = earSearch(currentSide);
        const abs = Math.abs(angles.yaw);
        if (abs >= band.yawAbsMin && abs <= band.yawAbsMax) {
          const ext = extendSweepAbs(
            sweepMinAbs.current,
            sweepMaxAbs.current,
            angles.yaw,
          );
          sweepMinAbs.current = ext.minAbs;
          sweepMaxAbs.current = ext.maxAbs;
        }
        const onWrong =
          (currentSide === "rightEar" && angles.yaw < -8) ||
          (currentSide === "leftEar" && angles.yaw > 8);
        wrongSideStreak.current = onWrong ? wrongSideStreak.current + 1 : 0;
      }

      const coverage = sweepCoverageRatio(
        sweepMinAbs.current,
        sweepMaxAbs.current,
        earSearch(currentSide).yawAbsMin,
        earSearch(currentSide).yawAbsMax,
      );

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
          signedYawDelta,
          hadTrackedFace: hadTrackedFace.current,
          searchElapsedMs:
            searchStartedAt.current === null
              ? 0
              : now - searchStartedAt.current,
          wasPoseReady: wasPoseReady.current,
          sweepCoverageRatio: coverage,
          wrongSideStreak: wrongSideStreak.current,
          roiOutOfFrame,
        },
      );

      dwellRef.current = dwellPrompt(
        dwellRef.current,
        guidance.prompt,
        now,
        poseConfig.promptUx,
      );
      const shown = dwellRef.current.displayed ?? guidance.prompt;

      wasPoseReady.current = guidance.poseReady;

      if (guidance.allowCapture) {
        readyBurst.current += 1;
        const score = quality
          ? frontalQualityScore(
              quality,
              yaw ?? undefined,
              poseConfig,
              currentSide,
            )
          : 0;
        const recycled =
          burstRing.current.length >= poseConfig.ready.burstFrames
            ? burstRing.current[0].payload
            : document.createElement("canvas");
        if (paintCaptureCanvas(recycled)) {
          burstRing.current = rememberBurst(
            burstRing.current,
            { score, payload: recycled },
            poseConfig.ready.burstFrames,
          );
        }
      } else {
        readyBurst.current = 0;
        burstRing.current = [];
      }

      const shutterStep = stepShutter(shutterRef.current, {
        nowMs: now,
        enabled: autoShutterRef.current,
        allowCapture: guidance.allowCapture,
        cancelled: shutterCancel.current,
        countdownMs: poseConfig.ready.countdownMs,
        cooldownMs: poseConfig.ready.cooldownMs,
      });
      shutterRef.current = shutterStep.state;
      if (shutterStep.fire) {
        captureStillRef.current();
      }

      setLive({
        yaw,
        pitch,
        roll,
        prompt: shown,
        allowCapture: guidance.allowCapture,
        phase: guidance.phase,
        roi,
        quality,
        faceHeightRatio: heightRatio,
        shutterPhase: shutterStep.state.phase,
        countdownLeftMs: shutterStep.countdownLeftMs,
      });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [landmarker, videoRef, paintCaptureCanvas]);

  const recalibrateSide = () => {
    if (!window.confirm(t("relearnConfirm"))) return;
    const next = { ...bests, [side]: null };
    bestsRef.current = next;
    setBests(next);
    savePersonalBests(next);
    const fromYaw = live.yaw ?? lastAngles.current?.yaw ?? 0;
    resetTransient(side);
    resweepFromYaw.current = fromYaw;
  };

  const downloadCapture = () => {
    if (!lastCapture) return;
    const a = document.createElement("a");
    a.href = lastCapture;
    const tag = side === "rightEar" ? "right-ear" : "left-ear";
    a.download = `${tag}-${Date.now()}.png`;
    a.click();
  };

  const cameraDenied =
    camError === "NotAllowedError" || camError === "NotFoundError";

  const stageHint = useMemo(() => {
    if (sim.enabled) return t("simMode");
    if (cameraDenied) return t("cameraDenied");
    if (camError) return t("cameraError", { error: camError });
    if (!camReady) return t("cameraOff");
    return t("previewHint");
  }, [camError, camReady, cameraDenied, sim.enabled, t]);

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
        className={`stage ${live.allowCapture ? "ready" : personalBest ? "learned" : ""}`}
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
          data-soft-best={
            Boolean(personalBest) &&
            !live.allowCapture &&
            live.phase === "hold"
          }
        >
          {promptText}
          {live.shutterPhase === "countdown" && live.countdownLeftMs > 0 ? (
            <span className="shutter-count">
              {t("autoshutterCountdown", {
                n: Math.max(1, Math.ceil(live.countdownLeftMs / 1000)),
              })}
            </span>
          ) : null}
        </div>
        <span className="stage-tag">{stageHint}</span>
        {cameraDenied ? (
          <div className="stage-empty" role="status">
            <p>{t("cameraDenied")}</p>
            <button type="button" className="ghost" onClick={() => void start()}>
              {t("openCamera")}
            </button>
          </div>
        ) : null}
      </section>

      <AngleHud
        yaw={live.yaw}
        pitch={live.pitch}
        roll={live.roll}
        bestYaw={personalBest}
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
          title={
            live.allowCapture
              ? t("READY")
              : live.phase === "hold"
                ? t("HOLD_NEAR_PEAK")
                : t(side === "rightEar" ? "SWEEP_RIGHT_EAR" : "SWEEP_LEFT_EAR")
          }
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
              shutterCancel.current = !on;
              if (!on) shutterRef.current = INITIAL_SHUTTER;
            }}
          />
          {t("autoShutter")}
        </label>
        {autoShutter &&
        (live.allowCapture || live.shutterPhase === "countdown") ? (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              shutterCancel.current = true;
              shutterRef.current = INITIAL_SHUTTER;
              setAutoShutter(false);
            }}
          >
            {t("autoshutterCancel")}
          </button>
        ) : null}
        {live.shutterPhase === "countdown" && live.countdownLeftMs > 0 ? (
          <span className="shutter-count-dock">
            {t("autoshutterCountdown", {
              n: Math.max(1, Math.ceil(live.countdownLeftMs / 1000)),
            })}
          </span>
        ) : null}
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
        <span
          className={`calib-note${personalBest && !live.allowCapture ? " soft-best" : ""}`}
          data-soft-best={Boolean(personalBest) && !live.allowCapture}
        >
          {personalBest ? t("learnedNote") : t("learningNote")}
        </span>
        <button type="button" className="ghost" onClick={recalibrateSide}>
          {t("relearn")}
        </button>
      </div>

      {lastCapture ? (
        <figure className="preview">
          <figcaption>
            {t("lastCaptureCaption")} · {t("otherEarHint")}
          </figcaption>
          <img src={lastCapture} alt={t("lastCaptureAlt")} />
        </figure>
      ) : null}

      <InstructionsPanel />

      <SimulatorPanel sim={sim} onChange={setSim} />

      <footer className="foot">
        <p>{t("footer")}</p>
        <p className="limits-hint">{t("limitsHint")}</p>
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
