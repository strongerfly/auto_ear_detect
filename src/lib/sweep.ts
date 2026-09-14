export function sweepCoverageRatio(
  minAbsYaw: number | null,
  maxAbsYaw: number | null,
  yawAbsMin: number,
  yawAbsMax: number,
): number {
  if (minAbsYaw === null || maxAbsYaw === null) return 0;
  const span = Math.max(0, maxAbsYaw - minAbsYaw);
  const band = Math.max(1, yawAbsMax - yawAbsMin);
  return Math.min(1, span / band);
}

export function extendSweepAbs(
  minAbs: number | null,
  maxAbs: number | null,
  yaw: number,
): { minAbs: number; maxAbs: number } {
  const abs = Math.abs(yaw);
  return {
    minAbs: minAbs === null ? abs : Math.min(minAbs, abs),
    maxAbs: maxAbs === null ? abs : Math.max(maxAbs, abs),
  };
}

/** After relearn, ignore peak updates until the head actually moves. */
export function stillResweeping(
  fromYaw: number | null,
  yaw: number | null,
  minMoveDeg: number,
): boolean {
  if (fromYaw === null) return false;
  if (yaw === null) return true;
  return Math.abs(yaw - fromYaw) < minMoveDeg;
}
