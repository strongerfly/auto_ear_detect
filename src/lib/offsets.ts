import type { EarSide } from "../config";
import { poseConfig } from "../config";

const STORAGE_KEY = "auto-ear-detect:offset:v1";

export type OffsetMap = {
  leftEar: number;
  rightEar: number;
};

function clampOffset(value: number): number {
  const lim = poseConfig.personalOffset.clampDeg;
  return Math.min(lim, Math.max(-lim, value));
}

export function defaultOffsets(): OffsetMap {
  return {
    leftEar: poseConfig.personalOffset.defaultOffset.leftEar,
    rightEar: poseConfig.personalOffset.defaultOffset.rightEar,
  };
}

export function loadOffsets(): OffsetMap {
  const fallback = defaultOffsets();
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<OffsetMap>;
    return {
      leftEar: clampOffset(Number(parsed.leftEar) || 0),
      rightEar: clampOffset(Number(parsed.rightEar) || 0),
    };
  } catch {
    return fallback;
  }
}

export function saveOffsets(offsets: OffsetMap): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      leftEar: clampOffset(offsets.leftEar),
      rightEar: clampOffset(offsets.rightEar),
    }),
  );
}

/**
 * Personal yaw offset: measured yaw at peak ear-ROI Laplacian, minus the
 * side's yawCenter, clamped to ±clampDeg.
 */
export function offsetFromPeakYaw(
  side: EarSide,
  yawAtPeak: number,
): number {
  const center = poseConfig.poseTargets[side].yawCenter;
  return clampOffset(yawAtPeak - center);
}

export function yawInCalibrationBand(yaw: number): boolean {
  const absYaw = Math.abs(yaw);
  return (
    absYaw >= poseConfig.personalOffset.calibrationYawMinAbs &&
    absYaw <= poseConfig.personalOffset.calibrationYawMaxAbs
  );
}
