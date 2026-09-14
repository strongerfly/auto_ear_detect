import type { EarSide, PoseConfig } from "../config";
import { poseConfig } from "../config";
import { frontalQualityScore } from "./quality";
import type { EarQuality } from "./types";

const STORAGE_KEY = "auto-ear-detect:best-yaw:v1";

export type PeakSample = {
  yaw: number;
  score: number;
};

export type PersonalBestMap = {
  leftEar: PeakSample | null;
  rightEar: PeakSample | null;
};

export function defaultPersonalBests(): PersonalBestMap {
  return { leftEar: null, rightEar: null };
}

function isPeakSample(value: unknown): value is PeakSample {
  if (!value || typeof value !== "object") return false;
  const v = value as PeakSample;
  return Number.isFinite(v.yaw) && Number.isFinite(v.score);
}

export function loadPersonalBests(): PersonalBestMap {
  const fallback = defaultPersonalBests();
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersonalBestMap>;
    return {
      leftEar: isPeakSample(parsed.leftEar) ? parsed.leftEar : null,
      rightEar: isPeakSample(parsed.rightEar) ? parsed.rightEar : null,
    };
  } catch {
    return fallback;
  }
}

export function savePersonalBests(bests: PersonalBestMap): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bests));
}

export function yawInSearchWindow(
  yaw: number,
  side: EarSide,
  config: PoseConfig = poseConfig,
): boolean {
  const abs = Math.abs(yaw);
  if (
    abs < config.personalBest.searchYawMinAbs ||
    abs > config.personalBest.searchYawMaxAbs
  ) {
    return false;
  }
  return side === "rightEar" ? yaw > 0 : yaw < 0;
}

export type BestYawSample = {
  yaw: number;
  pitch: number;
  roll: number;
  quality: EarQuality;
  side: EarSide;
};

/**
 * Running max: bestYaw is the yaw at the highest frontal-quality score seen
 * in the per-side search window. Pitch/roll outliers are ignored so a tilted
 * frame cannot steal the peak.
 */
export function updatePersonalBest(
  current: PeakSample | null,
  sample: BestYawSample,
  config: PoseConfig = poseConfig,
): PeakSample | null {
  const { yaw, pitch, roll, quality, side } = sample;
  if (!yawInSearchWindow(yaw, side, config)) return current;
  if (Math.abs(roll) > config.poseGuidance.rollCorrectAbove) return current;
  if (pitch > config.poseGuidance.pitchTooHighAbove) return current;
  if (pitch < config.poseGuidance.pitchTooLowBelow) return current;

  const score = frontalQualityScore(quality);
  const minImprove = config.personalBest.minScoreImprove;
  if (!current || score > current.score + minImprove) {
    return { yaw, score };
  }
  return current;
}

export function qualityCollapsing(
  quality: EarQuality | null,
  peak: PeakSample | null,
  config: PoseConfig = poseConfig,
): boolean {
  if (!quality || !peak || peak.score <= 0) return false;
  return (
    frontalQualityScore(quality) <
    peak.score * config.personalBest.qualityCollapseRatio
  );
}
