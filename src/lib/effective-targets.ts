import type { EarSide, PoseConfig } from "../config";
import type { PeakSample } from "./personal-best";

export type EffectiveTargets = {
  side: EarSide;
  locked: boolean;
  bestYaw: number | null;
  peakScore: number | null;
  yawCenter: number;
  yawMin: number;
  yawMax: number;
  pitchMin: number;
  pitchMax: number;
  rollMin: number;
  rollMax: number;
  coarseAbsError: number;
  fineAbsError: number;
};

/**
 * Guidance center is the personal best yaw when one has been observed,
 * otherwise the soft prior (search.priorYawAbs). Ready gating uses `locked`
 * so the prior band alone cannot fire capture.
 */
export function effectiveTargets(
  side: EarSide,
  best: PeakSample | null,
  config: PoseConfig,
): EffectiveTargets {
  const prior =
    side === "rightEar" ? config.search.priorYawAbs : -config.search.priorYawAbs;
  const readyErr = config.ready.bandDegAroundBest;
  const yawCenter = best ? best.yaw : prior;
  return {
    side,
    locked: best !== null,
    bestYaw: best?.yaw ?? null,
    peakScore: best?.score ?? null,
    yawCenter,
    yawMin: yawCenter - readyErr,
    yawMax: yawCenter + readyErr,
    pitchMin: -config.ready.pitchMaxAbs,
    pitchMax: config.ready.pitchMaxAbs,
    rollMin: -config.ready.rollMaxAbs,
    rollMax: config.ready.rollMaxAbs,
    coarseAbsError: config.search.guidanceCoarseAbsError,
    fineAbsError: readyErr,
  };
}

export function inNearBand(
  yaw: number,
  pitch: number,
  roll: number,
  t: EffectiveTargets,
): boolean {
  return (
    yaw >= t.yawMin &&
    yaw <= t.yawMax &&
    pitch >= t.pitchMin &&
    pitch <= t.pitchMax &&
    roll >= t.rollMin &&
    roll <= t.rollMax
  );
}

export function inReadyBand(
  yaw: number,
  pitch: number,
  roll: number,
  t: EffectiveTargets,
  config: PoseConfig,
): boolean {
  if (!t.locked || t.bestYaw === null) return false;
  return (
    Math.abs(yaw - t.bestYaw) <= config.ready.bandDegAroundBest &&
    Math.abs(pitch) <= config.ready.pitchMaxAbs &&
    Math.abs(roll) <= config.ready.rollMaxAbs
  );
}
