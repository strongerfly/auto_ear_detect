import type { PromptKey, PoseConfig } from "../config";
import type { EarQuality, EulerDeg } from "./types";
import {
  classifyEarQuality,
  type QualityKind,
} from "./quality";
import {
  effectiveTargets,
  inNearBand,
  inReadyBand,
  type EffectiveTargets,
} from "./effective-targets";
import {
  qualityNearPeak,
  type PeakSample,
} from "./personal-best";

export type GuidanceInput = {
  hasFace: boolean;
  facePresence: number;
  trackingConfidence: number;
  faceHeightRatio: number;
  yaw: number;
  pitch: number;
  roll: number;
  quality: EarQuality | null;
  faceCount?: number;
};

export type GuidanceExtras = {
  yawDelta?: number;
  /** Signed frame-to-frame yaw change; negative = turning left (toward a +yaw peak). */
  signedYawDelta?: number;
  hadTrackedFace?: boolean;
  searchElapsedMs?: number;
  wasPoseReady?: boolean;
  sweepCoverageRatio?: number;
  wrongSideStreak?: number;
  roiOutOfFrame?: boolean;
};

export type GuidanceResult = {
  prompt: PromptKey;
  poseNear: boolean;
  poseReady: boolean;
  qualityKind: QualityKind;
  targets: EffectiveTargets;
  allowCapture: boolean;
  phase: "learning" | "hold" | "ready";
};

/** Weak cold-start peaks need a real sweep; a confident ~45° peak can still READY. */
function coverageAllowsReady(
  targets: EffectiveTargets,
  extras: GuidanceExtras,
  config: PoseConfig,
): boolean {
  const cov = extras.sweepCoverageRatio;
  if (cov === undefined) return true;
  if (cov >= config.search.minSweepCoverageRatio) return true;
  return (
    targets.locked &&
    targets.peakScore !== null &&
    targets.peakScore >= (config.ready.confidentPeakScore ?? 0.5)
  );
}

/** Progressive yaw hints. Unlocked = sweep only; TURN_BACK only after a peak. */
function pickYawPrompt(
  yaw: number,
  t: EffectiveTargets,
  yawDelta: number,
  config: PoseConfig,
  wasReady: boolean,
  extras: GuidanceExtras = {},
): PromptKey | null {
  const wrongSide =
    (t.side === "rightEar" && yaw < -8) || (t.side === "leftEar" && yaw > 8);
  const wrongNeed = config.failure.wrongSideFrames ?? 1;
  if (wrongSide && (extras.wrongSideStreak ?? wrongNeed) >= wrongNeed) {
    return "WRONG_SIDE";
  }

  const fastTurn =
    config.search.fastTurnDegPerFrame ?? config.search.slowYawDeltaDeg;
  if (yawDelta >= fastTurn) {
    return "SLOW_DOWN";
  }

  if (!t.locked) {
    return t.side === "rightEar" ? "SWEEP_RIGHT_EAR" : "SWEEP_LEFT_EAR";
  }

  const err = yaw - t.yawCenter;
  const abs = Math.abs(err);
  const exitBand = config.ready.exitBandDeg ?? t.fineAbsError;
  const inBand = wasReady ? abs <= exitBand : abs <= t.fineAbsError;
  if (inBand) return null;

  if (Math.abs(yaw) >= config.failure.stuckNearOuterEdgeDeg) {
    return "TURN_BACK_OVERSHOOT";
  }

  const overshootSide = t.side === "rightEar" ? err > 0 : err < 0;
  const signed = extras.signedYawDelta;
  const towardPeak =
    signed !== undefined &&
    ((err > 0 && signed < 0) || (err < 0 && signed > 0));
  const overshootDeg = config.search.overshootTurnBackDeg ?? 6;

  // Approaching the personal peak from the overshoot side → HOLD, not TURN_MORE.
  if (overshootSide && towardPeak && abs <= exitBand) {
    return null;
  }

  // Past personal bestYaw by ~6°+ (not merely |yaw|>88) → TURN_BACK.
  if (overshootSide && abs >= overshootDeg) {
    return "TURN_BACK";
  }

  if (t.side === "rightEar") {
    if (err > t.fineAbsError) return "TURN_BACK";
    if (err < -t.coarseAbsError) return "SWEEP_RIGHT_EAR";
    return "TURN_MORE";
  }
  if (err < -t.fineAbsError) return "TURN_BACK";
  if (err > t.coarseAbsError) return "SWEEP_LEFT_EAR";
  return "TURN_MORE";
}

/**
 * Natural order: keep the user turning, then fix pose/hair only when close.
 * READY = near bestYaw (±band) + score near peak + stable. Never requires 70–90.
 */
export function pickPrompt(
  input: GuidanceInput,
  config: PoseConfig,
  targets: EffectiveTargets,
  stableFrames: number,
  extras: GuidanceExtras = {},
): GuidanceResult {
  const qualityKind = classifyEarQuality(input.quality, config);
  const poseNear = inNearBand(input.yaw, input.pitch, input.roll, targets);
  const poseReady = inReadyBand(
    input.yaw,
    input.pitch,
    input.roll,
    targets,
    config,
    extras.wasPoseReady ?? false,
  );
  const stable = stableFrames >= config.ready.stableFrames;
  const peak =
    targets.locked && targets.bestYaw !== null && targets.peakScore !== null
      ? { yaw: targets.bestYaw, score: targets.peakScore }
      : null;
  const nearPeakScore = qualityNearPeak(
    input.quality,
    peak,
    input.yaw,
    config,
    targets.side,
  );

  const fail: Omit<GuidanceResult, "prompt"> = {
    poseNear,
    poseReady,
    qualityKind,
    targets,
    allowCapture: false,
    phase: targets.locked ? "hold" : "learning",
  };

  if (
    !input.hasFace ||
    input.facePresence < config.faceGates.minFacePresence ||
    input.trackingConfidence < config.faceGates.minTrackingConfidence
  ) {
    const lost = extras.hadTrackedFace ? "FAIL_TRACKING" : "NO_FACE";
    return { ...fail, prompt: lost, poseNear: false, poseReady: false };
  }
  if ((input.faceCount ?? 1) > 1) {
    return { ...fail, prompt: "MULTI_FACE", poseNear: false, poseReady: false };
  }
  if (input.faceHeightRatio < config.faceGates.minFaceHeightRatio) {
    return { ...fail, prompt: "TOO_FAR", poseNear: false, poseReady: false };
  }
  if (input.faceHeightRatio > config.faceGates.maxFaceHeightRatio) {
    return { ...fail, prompt: "TOO_CLOSE", poseNear: false, poseReady: false };
  }

  const stuckNoPeak =
    !targets.locked &&
    (extras.searchElapsedMs ?? 0) >= config.failure.timeoutMs &&
    (extras.yawDelta ?? 0) < 2;
  if (stuckNoPeak) {
    return { ...fail, prompt: "FAIL_TIMEOUT" };
  }

  const absYawErr = Math.abs(input.yaw - targets.yawCenter);
  const closeOnYaw = absYawErr <= targets.coarseAbsError;
  const severeRoll =
    Math.abs(input.roll) >= config.poseGuidance.rollSevereAbove;

  if (severeRoll) {
    return { ...fail, prompt: "FIX_ROLL", poseNear: false, poseReady: false };
  }
  if (closeOnYaw && Math.abs(input.roll) > config.poseGuidance.rollCorrectAbove) {
    return { ...fail, prompt: "FIX_ROLL", poseNear: false, poseReady: false };
  }
  if (closeOnYaw && input.pitch > config.poseGuidance.pitchTooHighAbove) {
    return { ...fail, prompt: "PITCH_DOWN", poseNear: false, poseReady: false };
  }
  if (closeOnYaw && input.pitch < config.poseGuidance.pitchTooLowBelow) {
    return { ...fail, prompt: "PITCH_UP", poseNear: false, poseReady: false };
  }
  if (extras.roiOutOfFrame && closeOnYaw) {
    return { ...fail, prompt: "TOO_CLOSE", poseNear: false, poseReady: false };
  }

  const yawHint = pickYawPrompt(
    input.yaw,
    targets,
    extras.yawDelta ?? 0,
    config,
    extras.wasPoseReady ?? false,
    extras,
  );
  if (yawHint) {
    return { ...fail, prompt: yawHint, poseNear: false, poseReady: false };
  }

  if (qualityKind === "hair") {
    return { ...fail, prompt: "CLEAR_HAIR" };
  }
  if (qualityKind === "light") {
    if (
      input.quality &&
      input.quality.brightness > config.ready.brightnessMax
    ) {
      return { ...fail, prompt: "TOO_BRIGHT" };
    }
    if (
      input.quality &&
      input.quality.brightness < config.ready.brightnessMin
    ) {
      return { ...fail, prompt: "TOO_DARK" };
    }
    return { ...fail, prompt: "BAD_LIGHT" };
  }

  const allowCapture =
    poseReady &&
    stable &&
    qualityKind === "ok" &&
    nearPeakScore &&
    coverageAllowsReady(targets, extras, config);
  if (allowCapture) {
    return { ...fail, prompt: "READY", allowCapture: true, phase: "ready" };
  }
  if (
    poseReady &&
    stable &&
    qualityKind === "ok" &&
    nearPeakScore &&
    !coverageAllowsReady(targets, extras, config)
  ) {
    return {
      ...fail,
      prompt:
        targets.side === "rightEar" ? "SWEEP_RIGHT_EAR" : "SWEEP_LEFT_EAR",
      phase: "learning",
    };
  }
  if (!targets.locked) {
    return {
      ...fail,
      prompt:
        targets.side === "rightEar" ? "SWEEP_RIGHT_EAR" : "SWEEP_LEFT_EAR",
      phase: "learning",
    };
  }
  return { ...fail, prompt: "HOLD_NEAR_PEAK", phase: "hold" };
}

export function evaluateGuidance(
  input: GuidanceInput,
  config: PoseConfig,
  side: EffectiveTargets["side"],
  personalBest: PeakSample | null,
  stableFrames: number,
  extras: GuidanceExtras = {},
): GuidanceResult {
  const targets = effectiveTargets(side, personalBest, config);
  return pickPrompt(input, config, targets, stableFrames, extras);
}

export function isAngleStable(
  current: EulerDeg,
  previous: EulerDeg | null,
  config: PoseConfig,
): boolean {
  if (!previous) return false;
  return (
    Math.abs(current.yaw - previous.yaw) < config.ready.maxDeltaYawDeg &&
    Math.abs(current.pitch - previous.pitch) < config.ready.maxDeltaPitchDeg &&
    Math.abs(current.roll - previous.roll) < config.ready.maxDeltaRollDeg
  );
}
