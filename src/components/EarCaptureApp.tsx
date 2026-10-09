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
import { countdownSeconds, stepAutoShutter } from "../lib/auto-shutter";
import {
  pickBurstCandidate,
  pushBurstCandidate,
  type BurstCandidate,
} from "../lib/burst";
import { cameraNotice } from "../lib/camera-access";
import { createTimedStability, stepTimedStability } from "../lib/capture-conditions";
import { dwellPrompt, INITIAL_DWELL, type DwellState } from "../lib/dwell";
import { matrixToFiswgEuler } from "../lib/euler";
import {
  captureHintKey,
  captureUiFor,
  evaluateGuidance,
  evaluateCaptureConditions,
  promptForDisplay,
} from "../lib/guidance";
import {
  earInFrame,
  earRoiLayout,
  faceHeightRatio,
} from "../lib/landmarks";
import { EulerSmoother } from "../lib/one-euro";
import {
  EMPTY_PEAK_HYGIENE,
  stepPeakHygiene,
  type PeakHygieneState,
} from "../lib/peak-hygiene";
import {
  createPeakMemory,
  isBestYawSampleEligible,
  loadPersonalBests,
  MAX_PEAK_SAMPLE_GAP_MS,
  savePersonalBests,
  settlePersonalBest,
  yawInSearchWindow,
  type PeakMemory,
  type PersonalBestMap,
} from "../lib/personal-best";
import {
  captureFeedbackFor,
  captureResultKey,
  otherEar,
  type CaptureFeedback,
} from "../lib/capture-feedback";
import {
  gateCapture,
  isSideChosen,
  loadChosenSide,
  saveChosenSide,
} from "../lib/chosen-side";
import { createProgress, stepProgress } from "../lib/progress";
import {
  frontalQualityScore,
  measureEarQuality,
  qualityAlongYawCurve,
  smoothEarQuality,
} from "../lib/quality";
import {
  EMPTY_SWEEP,
  clearPeakForSide,
  introPromptFor,
  isSoftPeak,
  keepPeaksOnSideSwitch,
  noteSweepSample,
  pickPromptDuringIntro,
  sideIntroUntil,
} from "../lib/side-session";
import type { EarQuality, EulerDeg, RoiBox } from "../lib/types";

type BurstPayload = {
  canvas: HTMLCanvasElement;
  yaw: number | null;
  quality: EarQuality | null;
  timestampMs: number;
  side: EarSide;
};

function reportedConfidence(points: { presence?: number; visibility?: number }[],
  field: "presence" | "visibility"): number | null {
  const scores = points.map((p) => p[field]).filter((v) => v !== undefined);
  if (scores.length === 0) return null;
  if (scores.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return NaN;
  // tasks-vision converts an absent protobuf visibility field to zero.
  // An all-zero Face Landmarker array therefore supplies no visibility score.
  if (field === "visibility" && scores.every((v) => v === 0)) return null;
  // Retain zero/invalid reported scores. Absence must not be fabricated as 1.
  return scores.reduce((sum, v) => sum + v, 0) / scores.length;
}

function readRoiQuality(
  video: HTMLCanvasElement,
  roi: RoiBox,
  scratch: HTMLCanvasElement,
): EarQuality | null {
  if (roi.w < 1 || roi.h < 1) return null;
  scratch.width = roi.w;
  scratch.height = roi.h;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, roi.x, roi.y, roi.w, roi.h, 0, 0, roi.w, roi.h);
  return measureEarQuality(context.getImageData(0, 0, roi.w, roi.h));
}

function paintVideoFrame(
  video: HTMLVideoElement | HTMLCanvasElement,
  canvas: HTMLCanvasElement,
): HTMLCanvasElement {
  canvas.width = "videoWidth" in video ? video.videoWidth : video.width;
  canvas.height = "videoHeight" in video ? video.videoHeight : video.height;
  const context = canvas.getContext("2d");
  if (!context || canvas.width <= 0 || canvas.height <= 0) {
    throw new Error("camera_frame_unavailable");
  }
  context.drawImage(video, 0, 0);
  return canvas;
}

type LiveState = {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  prompt: PromptKey;
  allowCapture: boolean;
  roi: RoiBox | null;
  quality: EarQuality | null;
  faceHeightRatio: number;
  shutterCountdownMs: number | null;
  stuck: boolean;
  /** Weak/flat peak that already passed the quality READY gate. */
  softReady: boolean;
  captured: boolean;
};

const INITIAL_LIVE: LiveState = {
  yaw: null,
  pitch: null,
  roll: null,
  prompt: "PICK_SIDE",
  allowCapture: false,
  roi: null,
  quality: null,
  faceHeightRatio: 0,
  shutterCountdownMs: null,
  stuck: false,
  softReady: false,
  captured: false,
};

export function EarCaptureApp() {
  const { locale, t } = useLocale();
  const { videoRef, ready: camReady, error: camError, start, stop } =
    useWebcam();
  const { landmarker, error: lmError, loading: lmLoading } =
    useFaceLandmarker();
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const cameraFrameRef = useRef<HTMLCanvasElement | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  const [side, setSide] = useState<EarSide | null>(() => loadChosenSide());
  const [bests, setBests] = useState<PersonalBestMap>(() => loadPersonalBests());
  const [autoShutter, setAutoShutter] = useState(true);
  const [debugHud, setDebugHud] = useState(false);
  const [relearnArmed, setRelearnArmed] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [captureFeedback, setCaptureFeedback] = useState<CaptureFeedback | null>(
    null,
  );
  const [sim, setSim] = useState<SimState>(DEFAULT_SIM);
  const [live, setLive] = useState<LiveState>(() => {
    const stored = loadChosenSide();
    return {
      ...INITIAL_LIVE,
      prompt: stored ? introPromptFor(stored) : "PICK_SIDE",
    };
  });
  const [status, setStatus] = useState(() => t("loadingLandmarker"));

  const sideRef = useRef(side);
  const bestsRef = useRef(bests);
  const cameraBestsRef = useRef(bests);
  const simulatorBestsRef = useRef<PersonalBestMap>({ leftEar: null, rightEar: null });
  const simRef = useRef(sim);
  const autoShutterRef = useRef(autoShutter);
  const shutterLatch = useRef(false);
  const countdownStartedAt = useRef<number | null>(null);
  const cancelReadyEpisode = useRef(false);
  const dwellRef = useRef<DwellState>(INITIAL_DWELL);
  const timedStability = useRef(createTimedStability());
  const lastVideoTime = useRef(-1);
  const lastSampleTime = useRef<number | null>(null);
  const smootherRef = useRef<EulerSmoother | null>(null);
  const readyBurst = useRef(0);
  const bootNow =
    typeof performance !== "undefined" ? performance.now() : 0;
  const progressRef = useRef(createProgress(bootNow));
  const introUntilRef = useRef(sideIntroUntil(bootNow));
  const sweepRef = useRef(EMPTY_SWEEP);
  const capturedThisSideRef = useRef(false);
  const wasReadyRef = useRef(false);
  const wasCapturableRef = useRef(false);
  const peakMemoryRef = useRef<PeakMemory>(createPeakMemory());
  const hygieneRef = useRef<PeakHygieneState>(EMPTY_PEAK_HYGIENE);
  const smoothedQualityRef = useRef<EarQuality | null>(null);
  const burstRef = useRef<BurstCandidate<BurstPayload>[]>([]);
  const lastBurstVideoTimeRef = useRef(-1);

  sideRef.current = side;
  bestsRef.current = bests;
  simRef.current = sim;
  autoShutterRef.current = autoShutter;

  useEffect(() => {
    const o = poseConfig.smoothing.oneEuro;
    smootherRef.current = new EulerSmoother(o.minCutoff, o.beta, o.dCutoff);
  }, []);

  const resetCaptureTiming = useCallback(() => {
    timedStability.current = createTimedStability();
    lastSampleTime.current = null;
    lastVideoTime.current = -1;
    smootherRef.current?.reset();
    peakMemoryRef.current = createPeakMemory();
    smoothedQualityRef.current = null;
    wasReadyRef.current = false;
    wasCapturableRef.current = false;
    shutterLatch.current = false;
    readyBurst.current = 0;
    countdownStartedAt.current = null;
    cancelReadyEpisode.current = false;
    burstRef.current = [];
    lastBurstVideoTimeRef.current = -1;
  }, []);

  const resetSideSession = useCallback((nextSide: EarSide, now = performance.now()) => {
    dwellRef.current = {
      displayed: introPromptFor(nextSide),
      candidate: introPromptFor(nextSide),
      candidateSinceMs: now,
    };
    shutterLatch.current = false;
    countdownStartedAt.current = null;
    cancelReadyEpisode.current = false;
    readyBurst.current = 0;
    resetCaptureTiming();
    progressRef.current = createProgress(now);
    introUntilRef.current = sideIntroUntil(now);
    sweepRef.current = EMPTY_SWEEP;
    capturedThisSideRef.current = false;
    wasReadyRef.current = false;
    wasCapturableRef.current = false;
    peakMemoryRef.current = createPeakMemory();
    hygieneRef.current = EMPTY_PEAK_HYGIENE;
    smoothedQualityRef.current = null;
    burstRef.current = [];
    lastBurstVideoTimeRef.current = -1;
    setRelearnArmed(false);
    setLive({
      ...INITIAL_LIVE,
      prompt: introPromptFor(nextSide),
      shutterCountdownMs: null,
    });
  }, [resetCaptureTiming]);

  useEffect(() => {
    const invalidate = () => {
      resetCaptureTiming();
      setLive((prev) => ({ ...prev, allowCapture: false, shutterCountdownMs: null }));
    };
    const visibility = () => { if (document.hidden) invalidate(); };
    const video = videoRef.current;
    document.addEventListener("visibilitychange", visibility);
    video?.addEventListener("ended", invalidate);
    video?.addEventListener("emptied", invalidate);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      video?.removeEventListener("ended", invalidate);
      video?.removeEventListener("emptied", invalidate);
    };
  }, [resetCaptureTiming, videoRef]);

  const changeSimulator = (next: SimState) => {
    if (next.enabled !== simRef.current.enabled) {
      if (next.enabled) cameraBestsRef.current = bestsRef.current;
      else simulatorBestsRef.current = bestsRef.current;
      const nextBests = next.enabled ? simulatorBestsRef.current : cameraBestsRef.current;
      bestsRef.current = nextBests;
      setBests(nextBests);
      setLastCapture(null);
      setCaptureFeedback(null);
      const current = sideRef.current;
      if (isSideChosen(current)) resetSideSession(current);
      else resetCaptureTiming();
    }
    simRef.current = next;
    setSim(next);
  };

  const startCamera = () => {
    resetCaptureTiming();
    setLive((prev) => ({ ...prev, allowCapture: false, shutterCountdownMs: null }));
    void start();
  };
  const stopCamera = () => {
    resetCaptureTiming();
    setLive((prev) => ({ ...prev, allowCapture: false, shutterCountdownMs: null }));
    stop();
  };

  const selectSide = useCallback(
    (next: EarSide) => {
      if (next === sideRef.current) return;
      // Keep both peaks; resetSideSession only clears shutter / dwell / intro.
      bestsRef.current = keepPeaksOnSideSwitch(bestsRef.current);
      sideRef.current = next;
      setSide(next);
      saveChosenSide(next);
      resetSideSession(next);
    },
    [resetSideSession],
  );

  useEffect(() => {
    const current = sideRef.current;
    if (!current) return;
    const now = performance.now();
    introUntilRef.current = sideIntroUntil(now);
    progressRef.current = createProgress(now);
    const intro = introPromptFor(current);
    dwellRef.current = {
      displayed: intro,
      candidate: intro,
      candidateSinceMs: now,
    };
  }, []);

  const notice = cameraNotice({
    sim: sim.enabled,
    camError,
    camReady,
  });
  const cameraDenied = notice === "denied" || notice === "missing";
  const cameraBlockText =
    notice === "denied"
      ? t("cameraDenied")
      : notice === "missing"
        ? t("cameraMissing")
        : null;
  const personalBest = side ? bests[side] : null;
  const captureUi = captureUiFor(
    personalBest !== null,
    live.allowCapture,
    live.softReady,
  );
  const captureHint = cameraBlockText
    ? cameraBlockText
    : side
      ? t(captureHintKey(captureUi))
      : t("PICK_SIDE");
  const promptText = cameraBlockText
    ? cameraBlockText
    : live.captured && !live.stuck
      ? captureFeedback
        ? t(captureResultKey(captureFeedback))
        : t("captureNearPeak")
      : t(live.prompt);

  const liveRef = useRef(live);
  liveRef.current = live;

  const rememberVideoBurst = useCallback(
    (video: HTMLCanvasElement, videoTime: number, sampledAtMs: number,
      score: number, yaw: number | null, quality: EarQuality | null) => {
      const limit = poseConfig.ready.burstFrames;
      if (
        burstRef.current.length > 0 &&
        lastBurstVideoTimeRef.current === videoTime
      ) {
        const last = burstRef.current[burstRef.current.length - 1];
        const next = burstRef.current.slice();
        next[next.length - 1] = {
          score,
          payload: {
            canvas: paintVideoFrame(video, last.payload.canvas),
            yaw,
            quality,
            timestampMs: sampledAtMs,
            side: sideRef.current!,
          },
        };
        burstRef.current = next;
        return;
      }
      const recycle =
        burstRef.current.length >= limit
          ? burstRef.current[0].payload.canvas
          : document.createElement("canvas");
      burstRef.current = pushBurstCandidate(
        burstRef.current,
        {
          score,
          payload: {
            canvas: paintVideoFrame(video, recycle),
            yaw,
            quality,
            timestampMs: sampledAtMs,
            side: sideRef.current!,
          },
        },
        limit,
      );
      lastBurstVideoTimeRef.current = videoTime;
    },
    [],
  );

  const captureStill = useCallback(() => {
    const chosen = sideRef.current;
    if (!isSideChosen(chosen) || capturedThisSideRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const snap = liveRef.current;
    const label = tRef.current;
    let capturedScore =
      snap.quality && snap.yaw != null
        ? frontalQualityScore(snap.quality, snap.yaw)
        : (bestsRef.current[chosen]?.score ?? 0);
    let savedCanvas: HTMLCanvasElement | null = null;
    if (!simRef.current.enabled) {
      // Each candidate already has matching pixels, pose and measured quality.
      // Re-scoring here with liveRef would mix the new video frame with old pose.
      const best = pickBurstCandidate(
        burstRef.current.filter((frame) => frame.payload.side === chosen &&
          performance.now() - frame.payload.timestampMs >= 0 &&
          performance.now() - frame.payload.timestampMs <= poseConfig.captureConditions.maxGapMs),
        poseConfig.ready.pickBurstBy,
      );
      const sampleTime = lastSampleTime.current;
      if (!snap.allowCapture || !video || video.readyState < 2 || video.videoWidth <= 0 || !best ||
          sampleTime === null || performance.now() - sampleTime > MAX_PEAK_SAMPLE_GAP_MS) {
        resetCaptureTiming();
        setLive((prev) => ({ ...prev, allowCapture: false, shutterCountdownMs: null }));
        return;
      }
      savedCanvas = best.payload.canvas;
      capturedScore = best.score;
    }
    if (simRef.current.enabled) {
      canvas.width = 960;
      canvas.height = 540;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawSimStill(
        ctx,
        canvas.width,
        canvas.height,
        chosen,
        simRef.current,
        snap.yaw,
        snap.pitch,
        snap.roll,
        label(chosen === "rightEar" ? "simStillRight" : "simStillLeft"),
        label(chosen === "rightEar" ? "roiRight" : "roiLeft"),
      );
    }
    const url = (savedCanvas ?? canvas).toDataURL("image/png");
    burstRef.current = [];
    setLastCapture(url);
    shutterLatch.current = true;
    countdownStartedAt.current = null;
    capturedThisSideRef.current = true;
    const peak = bestsRef.current[chosen];
    setCaptureFeedback(
      captureFeedbackFor(
        chosen,
        capturedScore,
        peak?.score ?? null,
        poseConfig.ready.scoreRatioOfBest,
        snap.softReady,
      ),
    );
  }, [videoRef, resetCaptureTiming]);

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

      if (!isSideChosen(currentSide)) {
        setLive({
          ...INITIAL_LIVE,
          prompt: "PICK_SIDE",
        });
        return;
      }

      const roiLabel = tRef.current(
        currentSide === "rightEar" ? "roiRight" : "roiLeft",
      );

      let yaw: number | null = null;
      let pitch: number | null = null;
      let roll: number | null = null;
      let hasFace = false;
      let presence: number | null = null;
      let tracking: number | null = null;
      let heightRatio = 0;
      let roi: RoiBox | null = null;
      let quality: EarQuality | null = null;
      let faceCount = 0;
      let earVisible: boolean | undefined;
      let didSample = false;
      let rawAngles: EulerDeg | null = null;
      let cameraFrame: HTMLCanvasElement | null = null;

      if (simState.enabled) {
        didSample = true;
        hasFace = simState.hasFace;
        faceCount = hasFace ? 1 : 0;
        presence = hasFace ? 1 : 0;
        tracking = hasFace ? 1 : 0;
        heightRatio = simState.faceHeightRatio;
        yaw = simState.yaw;
        pitch = simState.pitch;
        roll = simState.roll;
        rawAngles = { yaw, pitch, roll };
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
        didSample = true;
        lastVideoTime.current = video.currentTime;
        let result: FaceLandmarkerResult | null = null;
        try {
          const frozen = cameraFrameRef.current ?? document.createElement("canvas");
          cameraFrameRef.current = frozen;
          cameraFrame = paintVideoFrame(video, frozen);
          result = landmarker.detectForVideo(cameraFrame, now);
        } catch {
          result = null;
        }
        const face = result?.faceLandmarks?.[0];
        const mat = result?.facialTransformationMatrixes?.[0];
        faceCount = result?.faceLandmarks?.length ?? 0;
        if (face && mat?.data?.length === 16 && Array.from(mat.data).every(Number.isFinite)) {
          try {
            hasFace = true;
            presence = reportedConfidence(face, "presence");
            tracking = reportedConfidence(face, "visibility");
            heightRatio = faceHeightRatio(face);
            let euler = matrixToFiswgEuler(mat.data);
            rawAngles = euler;
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
            const layout = earRoiLayout(
              face,
              currentSide,
              cameraFrame!.width,
              cameraFrame!.height,
            );
            roi = layout.roi;
            earVisible = earInFrame(layout.visibleRatio) &&
              layout.visibleRatio >= poseConfig.captureConditions.minRoiVisibleRatio;
            if (roi && scratch && cameraFrame) {
              quality = readRoiQuality(cameraFrame, roi, scratch);
            }
          } catch {
            hasFace = false;
            rawAngles = null;
            yaw = pitch = roll = null;
            roi = null;
            quality = null;
            smootherRef.current?.reset();
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
      } else if (
        !simState.enabled &&
        landmarker &&
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.currentTime === lastVideoTime.current
      ) {
        // Same video frame as the last sample. Leave the overlay and the
        // peak alone — a duplicate rAF is not a face-loss blip.
        if (lastSampleTime.current !== null &&
            now - lastSampleTime.current > poseConfig.captureConditions.maxGapMs) {
          const frozenVideoTime = lastVideoTime.current;
          resetCaptureTiming();
          lastVideoTime.current = frozenVideoTime;
          setLive((prev) => ({ ...prev, prompt: "NO_FACE", allowCapture: false,
            shutterCountdownMs: null }));
        }
        return;
      }

      if (didSample) {
        const previousTime = lastSampleTime.current;
        if (previousTime !== null &&
            (now <= previousTime || now - previousTime > MAX_PEAK_SAMPLE_GAP_MS)) {
          // An interrupted camera stream is not an uninterrupted stable hold.
          timedStability.current = createTimedStability();
          smootherRef.current?.reset();
          peakMemoryRef.current = createPeakMemory();
          smoothedQualityRef.current = null;
          wasReadyRef.current = false;
          wasCapturableRef.current = false;
          readyBurst.current = 0;
          countdownStartedAt.current = null;
          burstRef.current = [];
          lastBurstVideoTimeRef.current = -1;
          if (rawAngles) {
            yaw = rawAngles.yaw;
            pitch = rawAngles.pitch;
            roll = rawAngles.roll;
          }
        }
        lastSampleTime.current = now;
      }

      const angles: EulerDeg | null =
        yaw === null || pitch === null || roll === null
          ? null
          : { yaw, pitch, roll };

      const input = {
        hasFace, facePresence: presence, trackingConfidence: tracking,
        faceHeightRatio: heightRatio, yaw: yaw ?? NaN, pitch: pitch ?? NaN,
        roll: roll ?? NaN, quality, faceCount,
      };
      const conditions = evaluateCaptureConditions(input, poseConfig, {
        source: simState.enabled ? "simulator" : "camera",
        earInFrame: earVisible,
        roiShortEdgePx: roi ? Math.min(roi.w, roi.h) : undefined,
        timestampMs: now,
      });
      const motion = stepTimedStability(timedStability.current, {
        timestampMs: now, angles: rawAngles, eligible: false,
        source: simState.enabled ? "simulator" : "camera", side: currentSide,
      }, poseConfig.captureConditions);
      const angularVelocity = motion.velocityAvailable ? motion.velocityDegPerSec : null;

      let allowPeakUpdate = false;
      if (didSample) {
        const hygiene = stepPeakHygiene(
          hygieneRef.current,
          hasFace,
          earVisible,
          {
            ignoreFrameIfFaceLost: poseConfig.score.ignoreFrameIfFaceLost,
            maxFaceLostFrames: poseConfig.failure.maxFaceLostFrames,
          },
        );
        hygieneRef.current = hygiene.state;
        allowPeakUpdate = hygiene.allowPeakUpdate;
      }

      const peakSample = angles && quality ? {
        ...angles,
        quality,
        side: currentSide,
        // Legacy peak API uses a delta; velocity is the actual learning gate.
        yawDelta: 0,
        timestampMs: now,
      } : null;
      // A sharp crop must also belong to one well-tracked, correctly sized face.
      const canLearnPeak = allowPeakUpdate && conditions.eligible &&
        angularVelocity !== null && [angularVelocity.yaw, angularVelocity.pitch,
          angularVelocity.roll].every((v) => Math.abs(v) <
            poseConfig.captureConditions.slowYawSpeedDegPerSec) &&
        peakSample !== null && isBestYawSampleEligible(peakSample);
      if (!canLearnPeak) {
        smoothedQualityRef.current = null;
        peakMemoryRef.current = createPeakMemory();
      }
      const peakQuality =
        peakSample && canLearnPeak
          ? smoothEarQuality(
              smoothedQualityRef.current,
              peakSample.quality,
              poseConfig.score.smoothAlpha,
            )
          : null;
      if (peakQuality) smoothedQualityRef.current = peakQuality;

      if (peakSample && peakQuality) {
        const { yaw } = peakSample;
        if (yawInSearchWindow(yaw, currentSide)) {
          sweepRef.current = noteSweepSample(
            sweepRef.current,
            yaw,
            frontalQualityScore(peakQuality, yaw),
          );
        }
        const prevPeak = bestsRef.current[currentSide];
        const settled = settlePersonalBest(
          prevPeak,
          peakMemoryRef.current,
          {
            ...peakSample,
            quality: peakQuality,
          },
        );
        peakMemoryRef.current = settled.memory;
        const nextPeak = settled.peak;
        if (nextPeak !== prevPeak) {
          const nextMap = { ...bestsRef.current, [currentSide]: nextPeak };
          bestsRef.current = nextMap;
          setBests(nextMap);
          if (simState.enabled) simulatorBestsRef.current = nextMap;
          else {
            cameraBestsRef.current = nextMap;
            savePersonalBests(nextMap);
          }
        }
      }

      const extras = {
        conditions,
        angularVelocityDegPerSec: angularVelocity,
        wasReady: wasReadyRef.current,
        earInFrame: earVisible,
        softPeak: isSoftPeak(
          sweepRef.current,
          bestsRef.current[currentSide]?.score ?? null,
        ),
        wasCapturable: wasCapturableRef.current,
      };
      const qualification = evaluateGuidance(input, poseConfig, currentSide,
        bestsRef.current[currentSide], 0, extras);
      timedStability.current = stepTimedStability(timedStability.current, {
        timestampMs: now, angles: rawAngles, eligible: didSample && qualification.captureEligible,
        source: simState.enabled ? "simulator" : "camera", side: currentSide,
      }, poseConfig.captureConditions);
      const guidance = evaluateGuidance(input, poseConfig, currentSide,
        bestsRef.current[currentSide], timedStability.current.stable ?
          Math.max(timedStability.current.stableMs, poseConfig.captureConditions.stableMs) : 0, extras);
      wasReadyRef.current = guidance.poseReady;
      wasCapturableRef.current = guidance.allowCapture;

      const inIntro = now < introUntilRef.current;
      progressRef.current = stepProgress(progressRef.current, {
        now,
        peakScore: bestsRef.current[currentSide]?.score ?? null,
        allowCapture: guidance.allowCapture,
        paused: inIntro || capturedThisSideRef.current,
      });
      const stuck = progressRef.current.stuck;
      const allowCapture = gateCapture({
        side: currentSide,
        guidanceAllowCapture: guidance.allowCapture,
        stuck,
        capturedThisSide: capturedThisSideRef.current,
      });

      dwellRef.current = dwellPrompt(
        dwellRef.current,
        stuck ? "STUCK_NO_PROGRESS" : guidance.prompt,
        now,
        poseConfig.promptUx,
      );
      let shown = dwellRef.current.displayed ?? guidance.prompt;
      if (stuck) {
        shown = "STUCK_NO_PROGRESS";
      } else {
        shown = pickPromptDuringIntro(
          now,
          introUntilRef.current,
          introPromptFor(currentSide),
          shown,
        );
      }

      if (allowCapture) {
        readyBurst.current += 1;
        if (
          !simState.enabled &&
          cameraFrame &&
          quality
        ) {
          rememberVideoBurst(
            cameraFrame,
            lastVideoTime.current,
            now,
            frontalQualityScore(quality, yaw ?? 0),
            yaw,
            quality,
          );
        }
      } else if (!capturedThisSideRef.current) {
        readyBurst.current = 0;
        shutterLatch.current = false;
        cancelReadyEpisode.current = false;
        countdownStartedAt.current = null;
        burstRef.current = [];
        lastBurstVideoTimeRef.current = -1;
      }

      const shutter = stepAutoShutter({
        allowCapture,
        autoShutter: autoShutterRef.current,
        cancelled: cancelReadyEpisode.current,
        latched: shutterLatch.current,
        startedAt: countdownStartedAt.current,
        now,
        countdownMs: poseConfig.ready.autoshutterMs,
        burstCount: readyBurst.current,
        burstNeeded: 1,
      });
      countdownStartedAt.current = shutter.startedAt;
      if (shutter.fire) {
        shutterLatch.current = true;
        countdownStartedAt.current = null;
        captureStillRef.current();
      }

      const captured = capturedThisSideRef.current;
      let displayPrompt: PromptKey = promptForDisplay(shown, allowCapture);
      if (captured && !stuck) {
        displayPrompt = liveRef.current.prompt;
      }

      setLive({
        yaw,
        pitch,
        roll,
        prompt: displayPrompt,
        allowCapture,
        roi,
        quality,
        faceHeightRatio: heightRatio,
        shutterCountdownMs: shutter.fire ? null : shutter.remainingMs,
        stuck,
        softReady: allowCapture && guidance.prompt === "SOFT_READY",
        captured,
      });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [landmarker, rememberVideoBurst, videoRef, resetCaptureTiming]);

  const recalibrateSide = () => {
    const current = sideRef.current;
    if (!isSideChosen(current)) return;
    if (!relearnArmed) {
      setRelearnArmed(true);
      return;
    }
    const next = clearPeakForSide(bestsRef.current, current);
    bestsRef.current = next;
    setBests(next);
    if (simRef.current.enabled) simulatorBestsRef.current = next;
    else {
      cameraBestsRef.current = next;
      savePersonalBests(next);
    }
    setRelearnArmed(false);
    resetSideSession(current);
  };

  const retryStuck = () => {
    const current = sideRef.current;
    if (!isSideChosen(current)) return;
    resetSideSession(current);
  };

  const retake = () => {
    setLastCapture(null);
    setCaptureFeedback(null);
    const current = sideRef.current;
    if (isSideChosen(current)) resetSideSession(current);
  };

  const cancelAutoShutter = () => {
    cancelReadyEpisode.current = true;
    countdownStartedAt.current = null;
    setLive((prev) => ({ ...prev, shutterCountdownMs: null }));
  };

  const downloadCapture = () => {
    if (!lastCapture || !side) return;
    const a = document.createElement("a");
    a.href = lastCapture;
    const tag = side === "rightEar" ? "right-ear" : "left-ear";
    a.download = `${tag}-${Date.now()}.png`;
    a.click();
  };

  const stageHint = useMemo(() => {
    if (notice === "sim") return t("simMode");
    if (notice === "denied") return t("cameraDenied");
    if (notice === "missing") return t("cameraMissing");
    if (notice === "error") return t("cameraError", { error: camError ?? "" });
    if (notice === "off") return t("cameraOff");
    return t("previewHint");
  }, [camError, notice, t]);

  return (
    <div className="app" data-locale={locale} data-side={side ?? "none"}>
      <header className="top">
        <div>
          <p className="eyebrow">Auto Ear Detect</p>
          <h1>{t("appTitle")}</h1>
        </div>
        <div className="top-actions">
          <LocaleSwitcher />
          <div
            className={`modes${side ? "" : " need-pick"}`}
            role="tablist"
            aria-label={t("sideAriaLabel")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={side === "leftEar"}
              className={side === "leftEar" ? "on" : ""}
              onClick={() => selectSide("leftEar")}
            >
              {t("shootLeftEar")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={side === "rightEar"}
              className={side === "rightEar" ? "on" : ""}
              onClick={() => selectSide("rightEar")}
            >
              {t("shootRightEar")}
            </button>
          </div>
        </div>
      </header>

      <p className="status">{status}</p>

      <section
        className={`stage${cameraDenied ? " denied" : live.softReady ? " soft" : live.allowCapture ? " ready" : ""}${live.stuck ? " stuck" : ""}`}
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
        {!side ? (
          <div
            className="side-pick"
            role="dialog"
            aria-modal="true"
            aria-labelledby="side-pick-title"
          >
            <p id="side-pick-title">{t("PICK_SIDE")}</p>
            <div className="side-pick-actions">
              <button type="button" onClick={() => selectSide("leftEar")}>
                {t("shootLeftEar")}
              </button>
              <button type="button" onClick={() => selectSide("rightEar")}>
                {t("shootRightEar")}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="prompt"
            data-ready={live.allowCapture && !live.softReady && !cameraDenied}
            data-soft={live.softReady && !cameraDenied}
            data-stuck={live.stuck}
            data-camera-denied={cameraDenied}
            data-captured={live.captured && !live.stuck}
          >
            {promptText}
          </div>
        )}
        {cameraDenied ? (
          <div className="camera-denied-banner" role="status">
            <button
              type="button"
              className="stuck-retry"
              onClick={startCamera}
            >
              {t("openCamera")}
            </button>
          </div>
        ) : null}
        {live.stuck && !cameraDenied ? (
          <div className="stuck-banner" role="status">
            <button type="button" className="stuck-retry" onClick={retryStuck}>
              {t("stuckRetry")}
            </button>
            <button
              type="button"
              className={relearnArmed ? "ghost warn" : "ghost"}
              onClick={recalibrateSide}
            >
              {relearnArmed ? t("relearnConfirm") : t("relearn")}
            </button>
            {relearnArmed ? (
              <button
                type="button"
                className="ghost"
                onClick={() => setRelearnArmed(false)}
              >
                {t("relearnCancel")}
              </button>
            ) : null}
          </div>
        ) : null}
        {live.shutterCountdownMs !== null ? (
          <div className="countdown-banner" role="status">
            <span>
              {t("autoShutterCountdown", {
                seconds: countdownSeconds(live.shutterCountdownMs),
              })}
            </span>
            <button
              type="button"
              className="countdown-cancel"
              onClick={cancelAutoShutter}
            >
              {t("cancelAutoShutter")}
            </button>
          </div>
        ) : null}
        <span className="stage-tag">{stageHint}</span>
      </section>

      {debugHud ? (
        <AngleHud
          yaw={live.yaw}
          pitch={live.pitch}
          roll={live.roll}
          bestYaw={personalBest}
        />
      ) : null}

      <div className="dock">
        <button type="button" className="ghost" onClick={startCamera}>
          {t("openCamera")}
        </button>
        <button type="button" className="ghost" onClick={stopCamera}>
          {t("closeCamera")}
        </button>
        {cameraDenied ? (
          <button
            type="button"
            className="capture"
            onClick={startCamera}
          >
            {t("openCamera")}
          </button>
        ) : live.stuck ? (
          <button type="button" className="capture" onClick={retryStuck}>
            {t("stuckRetry")}
          </button>
        ) : (
          <button
            type="button"
            className={`capture${live.softReady ? " soft" : ""}`}
            disabled={!live.allowCapture}
            title={captureHint}
            aria-label={captureHint}
            onClick={captureStill}
          >
            {t("capture")}
          </button>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={autoShutter}
            onChange={(e) => {
              const on = e.target.checked;
              setAutoShutter(on);
              if (!on) {
                countdownStartedAt.current = null;
                setLive((prev) => ({ ...prev, shutterCountdownMs: null }));
              }
            }}
          />
          {t("autoShutter")}
        </label>
        {live.shutterCountdownMs !== null ? (
          <button
            type="button"
            className="countdown-cancel"
            onClick={cancelAutoShutter}
          >
            {t("cancelAutoShutter")}
          </button>
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
        <span className="calib-note">{captureHint}</span>
        <button
          type="button"
          className={relearnArmed ? "ghost warn" : "ghost"}
          disabled={!side}
          onClick={recalibrateSide}
        >
          {relearnArmed ? t("relearnConfirm") : t("relearn")}
        </button>
        {relearnArmed ? (
          <button
            type="button"
            className="ghost"
            onClick={() => setRelearnArmed(false)}
          >
            {t("relearnCancel")}
          </button>
        ) : null}
      </div>

      {lastCapture ? (
        <figure className="preview">
          <figcaption>
            {captureFeedback && side && captureFeedback.side === side ? (
              <>
                <strong>{t(captureResultKey(captureFeedback))}</strong>
                <span>{t("lastCaptureCaption")}</span>
              </>
            ) : (
              t("lastCaptureCaption")
            )}
          </figcaption>
          {captureFeedback && side && captureFeedback.side === side ? (
            <div className="preview-actions">
              <button type="button" className="capture" onClick={retake}>
                {t("retake")}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => selectSide(otherEar(side))}
              >
                {t("shootOtherEar")}
              </button>
            </div>
          ) : null}
          <img src={lastCapture} alt={t("lastCaptureAlt")} />
        </figure>
      ) : null}

      <InstructionsPanel />

      <label className="check debug-toggle">
        <input
          type="checkbox"
          checked={debugHud}
          onChange={(e) => setDebugHud(e.target.checked)}
        />
        {t("debugHud")}
      </label>

      <SimulatorPanel sim={sim} onChange={changeSimulator} />

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
