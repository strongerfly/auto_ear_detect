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

export type CaptureUi = "learning" | "hold" | "ready";

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
  /** Absolute per-frame |Δyaw| for SLOW_DOWN. */
  yawDelta?: number;
  /** Signed Δyaw (current − previous). Positive = yaw increased. */
  yawDeltaSigned?: number;
  /** Previous frame was inside the ready band (enter/exit hysteresis). */
  wasInReadyBand?: boolean;
};

export type GuidanceResult = {
  prompt: PromptKey;
  poseNear: boolean;
  poseReady: boolean;
  qualityKind: QualityKind;
  targets: EffectiveTargets;
  allowCapture: boolean;
  captureUi: CaptureUi;
  overshootPastBestDeg: number;
};

export function captureUiFor(prompt: PromptKey, allowCapture: boolean): CaptureUi {
  if (allowCapture || prompt === "READY") return "ready";
  if (prompt === "HOLD_STILL") return "hold";
  return "learning";
}

function sweepPrompt(side: EffectiveTargets["side"]): PromptKey {
  return side === "rightEar" ? "SWEEP_RIGHT_EAR" : "SWEEP_LEFT_EAR";
}

/**
 * Positive = turned past personal best toward profile
 * (more +yaw for the right ear, more −yaw for the left).
 */
export function pastBestDeg(
  yaw: number,
  bestYaw: number,
  side: EffectiveTargets["side"],
): number {
  return side === "rightEar" ? yaw - bestYaw : bestYaw - yaw;
}

/** True when signed yaw velocity is closing the gap to bestYaw. */
export function movingTowardBest(
  yaw: number,
  bestYaw: number,
  yawDeltaSigned: number,
): boolean {
  if (yawDeltaSigned === 0) return false;
  return Math.sign(yawDeltaSigned) === Math.sign(bestYaw - yaw);
}

function scoreDroppedFromPeak(
  quality: EarQuality | null,
  yaw: number,
  peakScore: number | null,
  config: PoseConfig,
): boolean {
  if (!quality || peakScore === null || peakScore <= 0) return false;
  return (
    frontalQualityScore(quality, yaw, config) <
    peakScore * config.ready.scoreRatioOfBest
  );
}

function wrongSide(
  yaw: number,
  side: EffectiveTargets["side"],
): boolean {
  if (side === "rightEar" && yaw < -8) return true;
  if (side === "leftEar" && yaw > 8) return true;
  return false;
}

/**
 * Unlocked: sweep intro only — never TURN_MORE / TURN_BACK off the soft prior.
 * Locked: overshoot is relative to bestYaw; returning toward best is HOLD.
 */
function pickYawPrompt(
  yaw: number,
  t: EffectiveTargets,
  yawDelta: number,
  yawDeltaSigned: number,
  quality: EarQuality | null,
  config: PoseConfig,
  inBand: boolean,
): PromptKey | null {
  if (wrongSide(yaw, t.side)) return "WRONG_SIDE";

  if (!t.locked || t.bestYaw === null) {
    if (yawDelta >= config.search.slowYawDeltaDeg) return "SLOW_DOWN";
    return sweepPrompt(t.side);
  }

  if (inBand) return null;

  const best = t.bestYaw;
  const past = pastBestDeg(yaw, best, t.side);
  const abs = Math.abs(yaw - best);
  const returning =
    past > t.fineAbsError && movingTowardBest(yaw, best, yawDeltaSigned);

  if (returning) return "HOLD_STILL";

  const overshoot =
    past >= t.overshootPastBestDeg &&
    scoreDroppedFromPeak(quality, yaw, t.peakScore, config);
  if (overshoot) return "TURN_BACK_OVERSHOOT";

  if (abs <= t.fineAbsError) return null;

  if (yawDelta >= config.search.slowYawDeltaDeg) return "SLOW_DOWN";

  if (past > t.fineAbsError) return "TURN_BACK";
  if (abs > t.coarseAbsError) return sweepPrompt(t.side);
  return "TURN_MORE";
}

function withUi(
  result: Omit<GuidanceResult, "captureUi">,
): GuidanceResult {
  return {
    ...result,
    captureUi: captureUiFor(result.prompt, result.allowCapture),
  };
}

/**
 * Natural order: keep the user turning, then fix pose/hair only when close.
 * READY = near bestYaw (enter ±5°, stay until ±8°) + score near peak + stable.
 * Turn-back only after a personal peak is locked.
 */
export function pickPrompt(
  input: GuidanceInput,
  config: PoseConfig,
  targets: EffectiveTargets,
  stableFrames: number,
  extras: GuidanceExtras = {},
): GuidanceResult {
  const qualityKind = classifyEarQuality(input.quality, config);
  const wasInside = extras.wasInReadyBand === true;
  const poseNear = inNearBand(
    input.yaw,
    input.pitch,
    input.roll,
    targets,
    wasInside,
  );
  const poseReady = inReadyBand(
    input.yaw,
    input.pitch,
    input.roll,
    targets,
    config,
    wasInside,
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

  const fail: Omit<GuidanceResult, "prompt" | "captureUi"> = {
    poseNear,
    poseReady,
    qualityKind,
    targets,
    allowCapture: false,
    overshootPastBestDeg: targets.overshootPastBestDeg,
  };

  if (
    !input.hasFace ||
    input.facePresence < config.faceGates.minFacePresence ||
    input.trackingConfidence < config.faceGates.minTrackingConfidence
  ) {
    return withUi({
      ...fail,
      prompt: "NO_FACE",
      poseNear: false,
      poseReady: false,
    });
  }
  if ((input.faceCount ?? 1) > 1) {
    return withUi({
      ...fail,
      prompt: "MULTI_FACE",
      poseNear: false,
      poseReady: false,
    });
  }
  if (input.faceHeightRatio < config.faceGates.minFaceHeightRatio) {
    return withUi({
      ...fail,
      prompt: "TOO_FAR",
      poseNear: false,
      poseReady: false,
    });
  }
  if (input.faceHeightRatio > config.faceGates.maxFaceHeightRatio) {
    return withUi({
      ...fail,
      prompt: "TOO_CLOSE",
      poseNear: false,
      poseReady: false,
    });
  }

  const severeRoll =
    Math.abs(input.roll) >= config.poseGuidance.rollSevereAbove;
  if (severeRoll) {
    return withUi({
      ...fail,
      prompt: "FIX_ROLL",
      poseNear: false,
      poseReady: false,
    });
  }

  const closeOnYaw =
    targets.locked &&
    Math.abs(input.yaw - targets.yawCenter) <= targets.coarseAbsError;

  if (closeOnYaw && Math.abs(input.roll) > config.poseGuidance.rollCorrectAbove) {
    return withUi({
      ...fail,
      prompt: "FIX_ROLL",
      poseNear: false,
      poseReady: false,
    });
  }
  if (closeOnYaw && input.pitch > config.poseGuidance.pitchTooHighAbove) {
    return withUi({
      ...fail,
      prompt: "PITCH_DOWN",
      poseNear: false,
      poseReady: false,
    });
  }
  if (closeOnYaw && input.pitch < config.poseGuidance.pitchTooLowBelow) {
    return withUi({
      ...fail,
      prompt: "PITCH_UP",
      poseNear: false,
      poseReady: false,
    });
  }

  const yawHint = pickYawPrompt(
    input.yaw,
    targets,
    extras.yawDelta ?? 0,
    extras.yawDeltaSigned ?? 0,
    input.quality,
    config,
    poseReady,
  );
  if (yawHint) {
    return withUi({
      ...fail,
      prompt: yawHint,
      poseNear: false,
      poseReady: false,
    });
  }

  if (qualityKind === "hair") {
    return withUi({ ...fail, prompt: "CLEAR_HAIR" });
  }
  if (qualityKind === "light") {
    if (
      input.quality &&
      input.quality.brightness > config.ready.brightnessMax
    ) {
      return withUi({ ...fail, prompt: "TOO_BRIGHT" });
    }
    if (
      input.quality &&
      input.quality.brightness < config.ready.brightnessMin
    ) {
      return withUi({ ...fail, prompt: "TOO_DARK" });
    }
    return withUi({ ...fail, prompt: "BAD_LIGHT" });
  }

  const allowCapture =
    poseReady && stable && qualityKind === "ok" && nearPeakScore;
  if (allowCapture) {
    return withUi({ ...fail, prompt: "READY", allowCapture: true });
  }
  return withUi({ ...fail, prompt: "HOLD_STILL" });
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
