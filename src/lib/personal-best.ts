import type { EarSide, PoseConfig } from "../config";
import { poseConfig } from "../config";
import { frontalQualityScore } from "./quality";
import { earSearch } from "./search-band";
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
  if (!poseConfig.personalBest.persistSessionOffset) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bests));
}

export function yawInSearchWindow(
  yaw: number,
  side: EarSide,
  config: PoseConfig = poseConfig,
): boolean {
  const abs = Math.abs(yaw);
  const band = earSearch(side, config);
  if (abs < band.yawAbsMin || abs > band.yawAbsMax) {
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

function poseOkForBest(
  pitch: number,
  roll: number,
  config: PoseConfig,
): boolean {
  if (!config.score.updateBestOnlyIfPoseOk) return true;
  return (
    pitch >= config.search.pitchMin &&
    pitch <= config.search.pitchMax &&
    roll >= config.search.rollMin &&
    roll <= config.search.rollMax
  );
}

/**
 * Running max: bestYaw is the yaw at the highest frontal-quality score seen
 * in the per-side search window. Near-ties prefer the smaller |yaw|
 * (a 45° peak wins over an equally sharp 80°). Pitch/roll outliers ignored.
 */
export function updatePersonalBest(
  current: PeakSample | null,
  sample: BestYawSample,
  config: PoseConfig = poseConfig,
): PeakSample | null {
  const { yaw, pitch, roll, quality, side } = sample;
  if (!yawInSearchWindow(yaw, side, config)) return current;
  if (!poseOkForBest(pitch, roll, config)) return current;

  const score = frontalQualityScore(quality, yaw, config, side);
  if (score < config.score.scoreMinAbsolute) return current;

  const minImprove = config.personalBest.minScoreImprove;
  if (!current) return { yaw, score };

  if (score > current.score + minImprove) {
    return { yaw, score };
  }

  const nearTie = Math.abs(score - current.score) <= minImprove;
  if (
    nearTie &&
    config.search.tieBreak === "smallerAbsYaw" &&
    Math.abs(yaw) < Math.abs(current.yaw)
  ) {
    return { yaw, score: Math.max(score, current.score) };
  }

  // alwaysRescore: never freeze the window to last session's yaw.
  return current;
}

export function qualityNearPeak(
  quality: EarQuality | null,
  peak: PeakSample | null,
  yaw: number | undefined,
  config: PoseConfig = poseConfig,
  side: EarSide = "rightEar",
): boolean {
  if (!quality || !peak || peak.score <= 0) return false;
  return (
    frontalQualityScore(quality, yaw, config, side) >=
    peak.score * config.ready.scoreRatioOfBest
  );
}
