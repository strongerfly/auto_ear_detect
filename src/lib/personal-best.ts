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
  if (!poseConfig.personalBest.persist) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bests));
}

export function yawInSearchWindow(
  yaw: number,
  side: EarSide,
  config: PoseConfig = poseConfig,
): boolean {
  const abs = Math.abs(yaw);
  if (abs < config.search.yawAbsMin || abs > config.search.yawAbsMax) {
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
  /** Per-frame |Δyaw|. Fast turns do not update bestYaw even if quality looks easy. */
  yawDelta?: number;
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
 *
 * `tieBreakMinDeg` keeps sub-degree noise from walking the stored yaw inward.
 * The instant helper passes 0 so a true 45-vs-80 tie still moves.
 */
function applyPeakScore(
  current: PeakSample | null,
  yaw: number,
  score: number,
  config: PoseConfig,
  tieBreakMinDeg: number,
): PeakSample | null {
  const minImprove = config.personalBest.minScoreImprove;
  if (!current) return { yaw, score };
  if (score > current.score + minImprove) return { yaw, score };
  const nearTie = Math.abs(score - current.score) <= minImprove;
  const smallerAbs =
    tieBreakMinDeg <= 0
      ? Math.abs(yaw) < Math.abs(current.yaw)
      : Math.abs(yaw) <= Math.abs(current.yaw) - tieBreakMinDeg;
  if (nearTie && config.search.tieBreak === "smallerAbsYaw" && smallerAbs) {
    return { yaw, score: Math.max(score, current.score) };
  }
  return current;
}

export function updatePersonalBest(
  current: PeakSample | null,
  sample: BestYawSample,
  config: PoseConfig = poseConfig,
): PeakSample | null {
  const { yaw, pitch, roll, quality, side } = sample;
  if (!yawInSearchWindow(yaw, side, config)) return current;
  if (!poseOkForBest(pitch, roll, config)) return current;
  if ((sample.yawDelta ?? 0) >= config.search.slowYawDeltaDeg) return current;

  const score = frontalQualityScore(quality, yaw, config);
  if (score < config.score.scoreMinAbsolute) return current;
  return applyPeakScore(current, yaw, score, config, 0);
}

export type PeakMemory = {
  /** Recent in-window samples that still sit inside the confirm yaw band. */
  recent: Array<{ yaw: number; score: number }>;
};

export function createPeakMemory(): PeakMemory {
  return { recent: [] };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export type SettledPeak = {
  peak: PeakSample | null;
  memory: PeakMemory;
};

/**
 * Lock bestYaw from the median of a short steady cluster, not one sharp frame.
 * A lone hair/background spike cannot move the peak. While the user holds the
 * remembered angle, alwaysRescore can lower a moderately inflated score so
 * the 92% gate is reachable again. Not a yaw refusal.
 */
export function settlePersonalBest(
  current: PeakSample | null,
  memory: PeakMemory,
  sample: BestYawSample,
  config: PoseConfig = poseConfig,
): SettledPeak {
  const keep = { peak: current, memory };
  const { yaw, pitch, roll, quality, side } = sample;
  if (!yawInSearchWindow(yaw, side, config)) return keep;
  if (!poseOkForBest(pitch, roll, config)) return keep;
  if ((sample.yawDelta ?? 0) >= config.search.slowYawDeltaDeg) return keep;

  const score = frontalQualityScore(quality, yaw, config);
  if (score < config.score.scoreMinAbsolute) return keep;

  const band = config.personalBest.confirmYawDeg;
  const recent = [
    ...memory.recent.filter((item) => Math.abs(item.yaw - yaw) <= band),
    { yaw, score },
  ].slice(-config.personalBest.confirmFrames);
  const nextMemory: PeakMemory = { recent };
  if (recent.length < config.personalBest.confirmFrames) {
    return { peak: current, memory: nextMemory };
  }

  const confirmedYaw = median(recent.map((item) => item.yaw));
  const confirmedScore = median(recent.map((item) => item.score));

  let peak = current;
  if (
    peak &&
    config.personalBest.alwaysRescore &&
    Math.abs(confirmedYaw - peak.yaw) <= config.ready.bandDegAroundBest &&
    confirmedScore + config.personalBest.minScoreImprove < peak.score &&
    confirmedScore < peak.score * config.ready.scoreRatioOfBest &&
    confirmedScore >= peak.score * config.personalBest.rescoreFloorRatio
  ) {
    peak = { yaw: peak.yaw, score: confirmedScore };
  }

  return {
    peak: applyPeakScore(
      peak,
      confirmedYaw,
      confirmedScore,
      config,
      band / 2,
    ),
    memory: nextMemory,
  };
}

export function qualityNearPeak(
  quality: EarQuality | null,
  peak: PeakSample | null,
  yaw: number | undefined,
  config: PoseConfig = poseConfig,
  ratioOfBest: number = config.ready.scoreRatioOfBest,
): boolean {
  if (!quality || !peak || peak.score <= 0) return false;
  return frontalQualityScore(quality, yaw, config) >= peak.score * ratioOfBest;
}
