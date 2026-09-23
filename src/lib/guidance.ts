import type { PromptKey, PoseConfig } from "../config";
import type { EarQuality, EulerDeg } from "./types";
import {
  classifyEarQuality,
  frontalQualityScore,
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
  /** Signed per-frame Δyaw; used to detect returning toward bestYaw. */
  yawDeltaSigned?: number;
  /** Previous frame was inside the READY band (enter ±5° / leave ±8°). */
  wasReady?: boolean;
  /** False when the ear ROI is mostly clipped. Undefined = unknown (simulator). */
  earInFrame?: boolean;
  /** Weak/flat peak: capture allowed, copy distinct from READY. */
  softPeak?: boolean;
};

export type CaptureUiState = "learning" | "hold" | "ready" | "soft";

export function captureUiFor(
  locked: boolean,
  allowCapture: boolean,
  softReady = false,
): CaptureUiState {
  if (allowCapture && softReady) return "soft";
  if (allowCapture) return "ready";
  if (locked) return "hold";
  return "learning";
}

/**
 * Shutter hint: learning vs near-peak vs strong READY vs weak/flat soft.
 * Soft must not reuse the READY line. Never HOLD_STILL.
 */
export function captureHintKey(
  ui: CaptureUiState,
): "READY" | "NEAR_PEAK" | "learningNote" | "softCaptureHint" {
  if (ui === "soft") return "softCaptureHint";
  if (ui === "ready") return "READY";
  if (ui === "hold") return "NEAR_PEAK";
  return "learningNote";
}

export type GuidanceResult = {
  prompt: PromptKey;
  poseNear: boolean;
  poseReady: boolean;
  qualityKind: QualityKind;
  targets: EffectiveTargets;
  allowCapture: boolean;
};

function sameSignAsBest(yaw: number, bestYaw: number): boolean {
  if (bestYaw === 0) return true;
  return Math.sign(yaw) === Math.sign(bestYaw) || Math.abs(yaw) < 1;
}

/** Past the learned peak with a quality drop — ease back, don't keep turning. */
function pastPeakOvershoot(
  yaw: number,
  t: EffectiveTargets,
  quality: EarQuality | null,
  config: PoseConfig,
): boolean {
  if (!t.locked || t.bestYaw === null) return false;
  if (!sameSignAsBest(yaw, t.bestYaw)) return false;
  const past =
    Math.abs(yaw) > Math.abs(t.bestYaw) + config.search.overshootPastBestDeg;
  if (!past) return false;
  if (!quality || t.peakScore === null) return true;
  return (
    frontalQualityScore(quality, yaw, config) <
    t.peakScore * config.ready.scoreRatioOfBest
  );
}

function returningTowardBest(
  yaw: number,
  t: EffectiveTargets,
  yawDeltaSigned: number,
): boolean {
  if (!t.locked || t.bestYaw === null) return false;
  const err = yaw - t.bestYaw;
  if (err === 0 || yawDeltaSigned === 0) return false;
  return Math.sign(yawDeltaSigned) === -Math.sign(err);
}

/**
 * Progressive yaw hints. Unlocked: SWEEP only — never steer vs the prior.
 * Locked: overshoot vs bestYaw + score drop → TURN_BACK_OVERSHOOT;
 * returning toward best → HOLD (NEAR_PEAK), not MORE.
 */
function pickYawPrompt(
  yaw: number,
  t: EffectiveTargets,
  yawDelta: number,
  yawDeltaSigned: number,
  config: PoseConfig,
  quality: EarQuality | null,
  wasReady: boolean,
): PromptKey | null {
  if (t.side === "rightEar" && yaw < -8) return "WRONG_SIDE";
  if (t.side === "leftEar" && yaw > 8) return "WRONG_SIDE";

  if (Math.abs(yaw) >= config.failure.stuckNearOuterEdgeDeg) {
    return "TURN_BACK_OVERSHOOT";
  }

  if (!t.locked) {
    if (yawDelta >= config.search.slowYawDeltaDeg) return "SLOW_DOWN";
    return t.side === "rightEar" ? "SWEEP_RIGHT_EAR" : "SWEEP_LEFT_EAR";
  }

  const err = yaw - t.yawCenter;
  const abs = Math.abs(err);
  const holdBand = wasReady
    ? Math.max(t.fineAbsError, config.ready.exitBandDeg)
    : t.fineAbsError;
  if (abs <= holdBand) return null;

  if (
    yawDelta >= config.search.slowYawDeltaDeg &&
    abs > holdBand
  ) {
    return "SLOW_DOWN";
  }

  if (returningTowardBest(yaw, t, yawDeltaSigned)) {
    return "NEAR_PEAK";
  }

  if (pastPeakOvershoot(yaw, t, quality, config)) {
    return "TURN_BACK_OVERSHOOT";
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
    extras.wasReady === true,
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
  );

  const fail: Omit<GuidanceResult, "prompt"> = {
    poseNear,
    poseReady,
    qualityKind,
    targets,
    allowCapture: false,
  };

  if (
    !input.hasFace ||
    input.facePresence < config.faceGates.minFacePresence ||
    input.trackingConfidence < config.faceGates.minTrackingConfidence
  ) {
    return { ...fail, prompt: "NO_FACE", poseNear: false, poseReady: false };
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

  const yawHint = pickYawPrompt(
    input.yaw,
    targets,
    extras.yawDelta ?? 0,
    extras.yawDeltaSigned ?? 0,
    config,
    input.quality,
    extras.wasReady === true,
  );
  if (yawHint === "WRONG_SIDE") {
    return { ...fail, prompt: yawHint, poseNear: false, poseReady: false };
  }

  const expectEar =
    Math.abs(input.yaw) >= config.search.yawAbsMin || closeOnYaw;
  if (extras.earInFrame === false && expectEar) {
    return {
      ...fail,
      prompt: "EAR_OUT_OF_FRAME",
      poseNear: false,
      poseReady: false,
    };
  }

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
    poseReady && stable && qualityKind === "ok" && nearPeakScore;
  if (allowCapture) {
    return {
      ...fail,
      prompt: extras.softPeak ? "SOFT_READY" : "READY",
      allowCapture: true,
    };
  }
  // Near a locked peak but not stable / not quite the peak score.
  // Never claim "hold still" while capture is still blocked.
  return { ...fail, prompt: "NEAR_PEAK" };
}

/**
 * Dwell can lag the gate: never show READY on a gray shutter.
 * HOLD_STILL is also remapped unless capture is already allowed — learning
 * never uses hold-still; locked-near-peak uses NEAR_PEAK on the overlay.
 */
export function promptForDisplay(
  prompt: PromptKey,
  allowCapture: boolean,
): PromptKey {
  if (
    !allowCapture &&
    (prompt === "READY" || prompt === "HOLD_STILL" || prompt === "SOFT_READY")
  ) {
    return "NEAR_PEAK";
  }
  return prompt;
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
