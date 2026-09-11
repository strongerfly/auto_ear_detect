import type { EarSide, PoseConfig } from "../config";

export type EffectiveTargets = {
  side: EarSide;
  offset: number;
  yawCenter: number;
  yawMin: number;
  yawMax: number;
  pitchMin: number;
  pitchMax: number;
  rollMin: number;
  rollMax: number;
  turnMoreBelow?: number;
  almostBelow?: number;
  tooFarAbove?: number;
  turnMoreAbove?: number;
  almostAbove?: number;
  tooFarBelow?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Translate the yaw band by a personal offset, then clamp so the band stays
 * in a plausible profile range (does not cross the face or go past ~100°).
 */
export function effectiveTargets(
  side: EarSide,
  rawOffset: number,
  config: PoseConfig,
): EffectiveTargets {
  const t = config.poseTargets[side];
  const clampDeg = config.personalOffset.clampDeg;
  const offset = config.personalOffset.enabled
    ? clamp(rawOffset, -clampDeg, clampDeg)
    : 0;

  if (side === "rightEar") {
    const g = config.poseGuidance.rightEar;
    const limMin = 50;
    const limMax = 100;
    let yawMin = clamp(t.yawMin + offset, limMin, limMax);
    let yawMax = clamp(t.yawMax + offset, limMin, limMax);
    if (yawMin > yawMax) {
      const tmp = yawMin;
      yawMin = yawMax;
      yawMax = tmp;
    }
    const yawCenter = clamp(t.yawCenter + offset, yawMin, yawMax);
    return {
      side,
      offset,
      yawCenter,
      yawMin,
      yawMax,
      pitchMin: t.pitchMin,
      pitchMax: t.pitchMax,
      rollMin: t.rollMin,
      rollMax: t.rollMax,
      turnMoreBelow: g.turnMoreBelow + offset,
      almostBelow: g.almostBelow + offset,
      tooFarAbove: g.tooFarAbove + offset,
    };
  }

  const g = config.poseGuidance.leftEar;
  const limMin = -100;
  const limMax = -50;
  let yawMin = clamp(t.yawMin + offset, limMin, limMax);
  let yawMax = clamp(t.yawMax + offset, limMin, limMax);
  if (yawMin > yawMax) {
    const tmp = yawMin;
    yawMin = yawMax;
    yawMax = tmp;
  }
  const yawCenter = clamp(t.yawCenter + offset, yawMin, yawMax);
  return {
    side,
    offset,
    yawCenter,
    yawMin,
    yawMax,
    pitchMin: t.pitchMin,
    pitchMax: t.pitchMax,
    rollMin: t.rollMin,
    rollMax: t.rollMax,
    turnMoreAbove: g.turnMoreAbove + offset,
    almostAbove: g.almostAbove + offset,
    tooFarBelow: g.tooFarBelow + offset,
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
  return (
    Math.abs(yaw - t.yawCenter) <= bands.readyMaxAbsYawError &&
    Math.abs(pitch) <= bands.readyMaxAbsPitchError &&
    Math.abs(roll) <= bands.readyMaxAbsRollError
  );
}
