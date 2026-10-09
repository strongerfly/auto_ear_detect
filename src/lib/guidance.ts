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
  facePresence: number | null;
  trackingConfidence: number | null;
  faceHeightRatio: number;
  yaw: number;
  pitch: number;
  roll: number;
  quality: EarQuality | null;
  faceCount?: number;
};

export type ConditionEvidence = {
  state: "PASS" | "FAIL" | "UNKNOWN";
  reliability: "observed" | "limited" | "unavailable";
  required: boolean;
  source: string;
};

export type CaptureConditions = {
  eligible: boolean;
  reason: PromptKey | null;
  sampledAtMs: number | null;
  evidence: Record<string, ConditionEvidence>;
};

/** Model thresholds are not calibrated probabilities. Missing scores stay unknown. */
export function evaluateCaptureConditions(
  input: GuidanceInput,
  config: PoseConfig,
  context: {
    source?: "camera" | "simulator";
    earInFrame?: boolean;
    roiShortEdgePx?: number;
    timestampMs?: number;
  } = {},
): CaptureConditions {
  const evidence: Record<string, ConditionEvidence> = {};
  let reason: PromptKey | null = null;
  const note = (key: string, state: ConditionEvidence["state"],
    source: string, required: boolean, prompt: PromptKey,
    reliability: ConditionEvidence["reliability"] = "observed") => {
    evidence[key] = { state, source, required, reliability };
    if (required && state !== "PASS" && reason === null) reason = prompt;
  };
  const validUnit = (value: number | null) => value !== null &&
    Number.isFinite(value) && value >= 0 && value <= 1;
  const finitePose = [input.yaw, input.pitch, input.roll].every(Number.isFinite);
  note("tracking", input.hasFace && finitePose && (input.faceCount ?? 1) > 0
    ? "PASS" : "UNKNOWN", "face-landmarks-and-matrix", true, "NO_FACE", "limited");
  note("singleFace", (input.faceCount ?? 1) > 1 ? "FAIL" : "PASS",
    "face-landmarker", true, "MULTI_FACE");
  for (const [key, value, threshold] of [
    ["presence", input.facePresence, config.faceGates.minFacePresence],
    ["confidence", input.trackingConfidence, config.faceGates.minTrackingConfidence],
  ] as const) {
    // Confidence is supplementary when the JS model does not report it.
    // A reported low/invalid score is still a capture blocker.
    const state = value === null ? "UNKNOWN" :
      validUnit(value) && value >= threshold ? "PASS" : "FAIL";
    note(key, state, "landmark-score", value !== null, "NO_FACE",
      value === null ? "unavailable" : "limited");
  }
  if (context.source === "camera") {
    note("inFrame", context.earInFrame === undefined ? "UNKNOWN" :
      context.earInFrame ? "PASS" : "FAIL", "projected-roi", true,
      context.earInFrame === undefined ? "CHECK_EAR" : "EAR_OUT_OF_FRAME", "limited");
    const px = context.roiShortEdgePx;
    note("pixels", px === undefined || !Number.isFinite(px) ? "UNKNOWN" :
      px >= config.captureConditions.minRoiShortEdgePx ? "PASS" : "FAIL",
      "native-video-roi", true, px === undefined || !Number.isFinite(px) ? "CHECK_EAR" : "TOO_FAR");
  } else {
    note("inFrame", context.earInFrame === false ? "FAIL" : "PASS",
      context.source === "simulator" ? "synthetic" : "caller", true,
      "EAR_OUT_OF_FRAME", "limited");
  }
  const ratio = input.faceHeightRatio;
  const distanceState = !Number.isFinite(ratio) || ratio <= 0 ? "UNKNOWN" :
    ratio < config.faceGates.minFaceHeightRatio || ratio > config.faceGates.maxFaceHeightRatio
      ? "FAIL" : "PASS";
  // Face height is a coarse guide. Native ROI pixels and clipping control
  // camera eligibility; a profile-induced size estimate cannot veto them.
  note("distance", distanceState, "face-height-proxy", context.source !== "camera",
    ratio > config.faceGates.maxFaceHeightRatio ? "TOO_CLOSE" : "TOO_FAR", "limited");
  const q = input.quality;
  const known = q !== null && [q.laplacian, q.edgeEnergy, q.brightness]
    .every(Number.isFinite) && q.laplacian >= 0 && q.edgeEnergy >= 0 &&
    q.brightness >= 0 && q.brightness <= 255;
  note("exposure", !known ? "UNKNOWN" :
    q!.brightness < config.ready.brightnessMin || q!.brightness > config.ready.brightnessMax
      ? "FAIL" : "PASS", "roi-luma", true,
    q && q.brightness > config.ready.brightnessMax ? "TOO_BRIGHT" :
      q && q.brightness < config.ready.brightnessMin ? "TOO_DARK" : "CHECK_EAR");
  const center = q?.centerSharpness;
  const centerOk = center === undefined || Number.isFinite(center) &&
    center >= config.score.sharp.laplacianMinRaw * config.captureConditions.minCenterSharpnessRatio;
  note("sharpness", !known ? "UNKNOWN" :
    q!.laplacian >= config.score.sharp.laplacianMinRaw && centerOk ? "PASS" : "FAIL",
    "roi-optical-quality", true, "BLURRY_EAR", "limited");
  note("structure", !known ? "UNKNOWN" :
    q!.edgeEnergy >= config.score.struct.minEdgeEnergy ? "PASS" : "FAIL",
    "roi-edges", true, "CHECK_EAR", "limited");
  // This project has no semantic ear/occlusion model. Optical evidence must
  // never be presented as a calibrated probability of an unobstructed ear.
  note("earVisibility", "UNKNOWN", "ear-model-unavailable", false, "CHECK_EAR", "unavailable");
  return { eligible: reason === null, reason,
    sampledAtMs: context.timestampMs ?? null, evidence };
}

export type GuidanceExtras = {
  /** Previous frame was inside the READY band (enter ±5° / leave ±8°). */
  wasReady?: boolean;
  /** False when the ear ROI is mostly clipped. Undefined = unknown (simulator). */
  earInFrame?: boolean;
  /** Weak/flat peak: capture allowed, copy distinct from READY. */
  softPeak?: boolean;
  /** Previous frame allowed capture. Score hysteresis never relaxes stable time. */
  wasCapturable?: boolean;
  conditions?: CaptureConditions;
  angularVelocityDegPerSec?: EulerDeg | null;
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
  /** Current qualification, before the continuous stable-time requirement. */
  captureEligible: boolean;
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
  yawSpeed: number,
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
    if (yawSpeed >= config.captureConditions.slowYawSpeedDegPerSec) return "SLOW_DOWN";
    return t.side === "rightEar" ? "SWEEP_RIGHT_EAR" : "SWEEP_LEFT_EAR";
  }

  const err = yaw - t.yawCenter;
  const abs = Math.abs(err);
  const holdBand = wasReady
    ? Math.max(t.fineAbsError, config.ready.exitBandDeg)
    : t.fineAbsError;
  if (abs <= holdBand) return null;

  if (
    yawSpeed >= config.captureConditions.slowYawSpeedDegPerSec &&
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
  stableMs: number,
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
  const wasCapturable = extras.wasCapturable === true;
  const stable = Number.isFinite(stableMs) && stableMs >= config.captureConditions.stableMs;
  const conditions = extras.conditions ?? evaluateCaptureConditions(input, config, {
    earInFrame: extras.earInFrame,
  });
  const peak =
    targets.locked && targets.bestYaw !== null && targets.peakScore !== null
      ? { yaw: targets.bestYaw, score: targets.peakScore }
      : null;
  const scoreRatio = wasCapturable
    ? Math.min(config.ready.scoreRatioOfBest, config.ready.scoreRatioExit)
    : config.ready.scoreRatioOfBest;
  const nearPeakScore = qualityNearPeak(
    input.quality,
    peak,
    input.yaw,
    config,
    scoreRatio,
  );

  const fail: Omit<GuidanceResult, "prompt"> = {
    poseNear,
    poseReady,
    qualityKind,
    targets,
    allowCapture: false,
    captureEligible: false,
  };

  if (
    conditions.reason === "NO_FACE"
  ) {
    return { ...fail, prompt: "NO_FACE", poseNear: false, poseReady: false };
  }
  if (conditions.reason === "MULTI_FACE") {
    return { ...fail, prompt: "MULTI_FACE", poseNear: false, poseReady: false };
  }
  if (conditions.reason === "TOO_FAR") {
    return { ...fail, prompt: "TOO_FAR", poseNear: false, poseReady: false };
  }
  if (conditions.reason === "TOO_CLOSE") {
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
    Math.abs(extras.angularVelocityDegPerSec?.yaw ?? 0),
    extras.angularVelocityDegPerSec?.yaw ?? 0,
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

  // Once the ear should be observable, a cold-start quality failure must
  // explain the blocked learning instead of endlessly asking for a sweep.
  if (expectEar && !conditions.eligible && (!targets.locked || yawHint === null)) {
    const movingBlur = conditions.reason === "BLURRY_EAR" &&
      extras.angularVelocityDegPerSec !== null &&
      extras.angularVelocityDegPerSec !== undefined &&
      Object.values(extras.angularVelocityDegPerSec).some((v) =>
        Math.abs(v) > config.captureConditions.maxAngularSpeedDegPerSec);
    return { ...fail, prompt: movingBlur ? "SLOW_DOWN" : conditions.reason ?? "CHECK_EAR" };
  }

  if (yawHint) {
    return { ...fail, prompt: yawHint, poseNear: false, poseReady: false };
  }

  if (!conditions.eligible) {
    return { ...fail, prompt: conditions.reason ?? "CHECK_EAR" };
  }

  const captureEligible = poseReady && qualityKind === "ok" && nearPeakScore;
  const allowCapture = captureEligible && stable;
  if (allowCapture) {
    return {
      ...fail,
      prompt: extras.softPeak ? "SOFT_READY" : "READY",
      allowCapture: true,
      captureEligible: true,
    };
  }
  // Near a locked peak but not stable / not quite the peak score.
  // Never claim "hold still" while capture is still blocked.
  return { ...fail, prompt: "NEAR_PEAK", captureEligible };
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
  stableMs: number,
  extras: GuidanceExtras = {},
): GuidanceResult {
  const targets = effectiveTargets(side, personalBest, config);
  return pickPrompt(input, config, targets, stableMs, extras);
}
