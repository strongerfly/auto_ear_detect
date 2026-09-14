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
 * otherwise the soft prior (~±80°). Ready gating uses `locked` so the prior
 * band alone cannot fire capture.
 */
export function effectiveTargets(
  side: EarSide,
  best: PeakSample | null,
  config: PoseConfig,
): EffectiveTargets {
  const t = config.poseTargets[side];
  const readyErr = config.captureBands.readyMaxAbsYawError;
  const nearErr = config.captureBands.nearMaxAbsYawError;
  const yawCenter = best ? best.yaw : t.yawCenter;
  return {
    side,
    locked: best !== null,
    bestYaw: best?.yaw ?? null,
    peakScore: best?.score ?? null,
    yawCenter,
    yawMin: yawCenter - nearErr,
    yawMax: yawCenter + nearErr,
    pitchMin: t.pitchMin,
    pitchMax: t.pitchMax,
    rollMin: t.rollMin,
    rollMax: t.rollMax,
    coarseAbsError: config.personalBest.guidanceCoarseAbsError,
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
  bands: PoseConfig["captureBands"],
): boolean {
  if (!t.locked || t.bestYaw === null) return false;
  return (
    Math.abs(yaw - t.bestYaw) <= bands.readyMaxAbsYawError &&
    Math.abs(pitch) <= bands.readyMaxAbsPitchError &&
    Math.abs(roll) <= bands.readyMaxAbsRollError
  );
}
