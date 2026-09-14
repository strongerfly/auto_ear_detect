import type { EarSide, PoseConfig } from "../config";
import type { PeakSample } from "./personal-best";

export type EffectiveTargets = {
  side: EarSide;
  locked: boolean;
  bestYaw: number | null;
  peakScore: number | null;
  /** Guidance/ready center. Meaningful only when `locked`. */
  yawCenter: number;
  yawMin: number;
  yawMax: number;
  yawExitMin: number;
  yawExitMax: number;
  pitchMin: number;
  pitchMax: number;
  rollMin: number;
  rollMax: number;
  coarseAbsError: number;
  fineAbsError: number;
  overshootPastBestDeg: number;
  exitBandDeg: number;
};

/**
 * When a personal peak is locked, guidance and READY center on that yaw.
 * While unlocked the soft prior is **not** a turn target — callers must keep
 * the sweep intro until `locked`. Ready gating still requires `locked`.
 */
export function effectiveTargets(
  side: EarSide,
  best: PeakSample | null,
  config: PoseConfig,
): EffectiveTargets {
  const enter = config.ready.bandDegAroundBest;
  const exit = Math.max(enter, config.ready.exitBandDeg);
  const overshoot = config.ready.overshootPastBestDeg;
  const yawCenter = best ? best.yaw : 0;
  return {
    side,
    locked: best !== null,
    bestYaw: best?.yaw ?? null,
    peakScore: best?.score ?? null,
    yawCenter,
    yawMin: yawCenter - enter,
    yawMax: yawCenter + enter,
    yawExitMin: yawCenter - exit,
    yawExitMax: yawCenter + exit,
    pitchMin: -config.ready.pitchMaxAbs,
    pitchMax: config.ready.pitchMaxAbs,
    rollMin: -config.ready.rollMaxAbs,
    rollMax: config.ready.rollMaxAbs,
    coarseAbsError: config.search.guidanceCoarseAbsError,
    fineAbsError: enter,
    overshootPastBestDeg: overshoot,
    exitBandDeg: exit,
  };
}

export function inNearBand(
  yaw: number,
  pitch: number,
  roll: number,
  t: EffectiveTargets,
  wasInside = false,
): boolean {
  if (!t.locked) return false;
  const min = wasInside ? t.yawExitMin : t.yawMin;
  const max = wasInside ? t.yawExitMax : t.yawMax;
  return (
    yaw >= min &&
    yaw <= max &&
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
  wasInside = false,
): boolean {
  if (!t.locked || t.bestYaw === null) return false;
  const band = wasInside
    ? t.exitBandDeg
    : config.ready.bandDegAroundBest;
  return (
    Math.abs(yaw - t.bestYaw) <= band &&
    Math.abs(pitch) <= config.ready.pitchMaxAbs &&
    Math.abs(roll) <= config.ready.rollMaxAbs
  );
}
