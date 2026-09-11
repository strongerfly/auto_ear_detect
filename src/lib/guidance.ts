import type { PromptKey } from "../config";
import type { PoseConfig } from "../config";
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

export type GuidanceInput = {
  hasFace: boolean;
  facePresence: number;
  trackingConfidence: number;
  faceHeightRatio: number;
  yaw: number;
  pitch: number;
  roll: number;
  quality: EarQuality | null;
};

export type GuidanceResult = {
  prompt: PromptKey;
  poseNear: boolean;
  poseReady: boolean;
  qualityKind: QualityKind;
  targets: EffectiveTargets;
  allowCapture: boolean;
};

function pickYawPrompt(yaw: number, t: EffectiveTargets): PromptKey | null {
  if (t.side === "rightEar") {
    if (yaw < (t.turnMoreBelow ?? 55)) return "TURN_LEFT";
    if (yaw < (t.almostBelow ?? 70)) return "TURN_LEFT_MORE";
    if (yaw > (t.tooFarAbove ?? 95)) return "TURN_LEFT_BACK";
    return null;
  }
  if (yaw > (t.turnMoreAbove ?? -55)) return "TURN_RIGHT";
  if (yaw > (t.almostAbove ?? -70)) return "TURN_RIGHT_MORE";
  if (yaw < (t.tooFarBelow ?? -95)) return "TURN_RIGHT_BACK";
  return null;
}

/**
 * Priority: NO_FACE → distance → roll → pitch → yaw turn hints →
 * hair/light/blur → HOLD_STILL → READY.
 */
export function pickPrompt(
  input: GuidanceInput,
  config: PoseConfig,
  targets: EffectiveTargets,
  stableFrames: number,
): GuidanceResult {
  const qualityKind = classifyEarQuality(input.quality, config.earRoiQuality);
  const poseNear = inNearBand(input.yaw, input.pitch, input.roll, targets);
  const poseReady = inReadyBand(
    input.yaw,
    input.pitch,
    input.roll,
    targets,
    config.captureBands,
  );
  const stable = stableFrames >= config.stability.requiredStableFrames;

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
  if (input.faceHeightRatio < config.faceGates.minFaceHeightRatio) {
    return { ...fail, prompt: "TOO_FAR", poseNear: false, poseReady: false };
  }
  if (input.faceHeightRatio > config.faceGates.maxFaceHeightRatio) {
    return { ...fail, prompt: "TOO_CLOSE", poseNear: false, poseReady: false };
  }
  if (Math.abs(input.roll) > config.poseGuidance.rollCorrectAbove) {
    return { ...fail, prompt: "FIX_ROLL", poseNear: false, poseReady: false };
  }
  if (input.pitch > config.poseGuidance.pitchTooHighAbove) {
    return { ...fail, prompt: "PITCH_DOWN", poseNear: false, poseReady: false };
  }
  if (input.pitch < config.poseGuidance.pitchTooLowBelow) {
    return { ...fail, prompt: "PITCH_UP", poseNear: false, poseReady: false };
  }

  const yawHint = pickYawPrompt(input.yaw, targets);
  if (yawHint) {
    return { ...fail, prompt: yawHint, poseNear: false, poseReady: false };
  }

  if (qualityKind === "hair") {
    return { ...fail, prompt: "CLEAR_HAIR" };
  }
  if (qualityKind === "light") {
    return { ...fail, prompt: "BAD_LIGHT" };
  }

  const allowCapture = poseReady && stable && qualityKind === "ok";
  if (allowCapture) {
    return { ...fail, prompt: "READY", allowCapture: true };
  }
  return { ...fail, prompt: "HOLD_STILL" };
}

export function evaluateGuidance(
  input: GuidanceInput,
  config: PoseConfig,
  side: EffectiveTargets["side"],
  offset: number,
  stableFrames: number,
): GuidanceResult {
  const targets = effectiveTargets(side, offset, config);
  return pickPrompt(input, config, targets, stableFrames);
}

export function isAngleStable(
  current: EulerDeg,
  previous: EulerDeg | null,
  config: PoseConfig,
): boolean {
  if (!previous) return false;
  return (
    Math.abs(current.yaw - previous.yaw) < config.stability.maxDeltaYawDeg &&
    Math.abs(current.pitch - previous.pitch) <
      config.stability.maxDeltaPitchDeg &&
    Math.abs(current.roll - previous.roll) < config.stability.maxDeltaRollDeg
  );
}
