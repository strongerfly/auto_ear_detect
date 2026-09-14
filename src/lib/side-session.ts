import type { EarSide, PromptKey } from "../config";
import { poseConfig } from "../config";

export function introPromptFor(side: EarSide): PromptKey {
  return side === "rightEar" ? "INTRO_RIGHT" : "INTRO_LEFT";
}

export function sideIntroUntil(
  nowMs: number,
  introMs: number = poseConfig.promptUx.sideIntroMs,
): number {
  return nowMs + introMs;
}

const INTRO_PREEMPT: ReadonlySet<PromptKey> = new Set([
  "WRONG_SIDE",
  "STUCK_NO_PROGRESS",
]);

/**
 * After a left/right switch, keep the body-side intro on screen briefly.
 * Wrong-way turns still interrupt; face-missing stays on the intro so the
 * user knows which ear they just selected.
 */
export function pickPromptDuringIntro(
  nowMs: number,
  introUntilMs: number,
  introPrompt: PromptKey,
  guidancePrompt: PromptKey,
): PromptKey {
  if (nowMs >= introUntilMs) return guidancePrompt;
  if (INTRO_PREEMPT.has(guidancePrompt)) return guidancePrompt;
  return introPrompt;
}

export type SweepStats = {
  samples: number;
  minScore: number;
  maxScore: number;
  minYaw: number;
  maxYaw: number;
};

export const EMPTY_SWEEP: SweepStats = {
  samples: 0,
  minScore: Infinity,
  maxScore: -Infinity,
  minYaw: Infinity,
  maxYaw: -Infinity,
};

export function noteSweepSample(
  stats: SweepStats,
  yaw: number,
  score: number,
): SweepStats {
  if (!Number.isFinite(yaw) || !Number.isFinite(score)) return stats;
  return {
    samples: stats.samples + 1,
    minScore: Math.min(stats.minScore, score),
    maxScore: Math.max(stats.maxScore, score),
    minYaw: Math.min(stats.minYaw, yaw),
    maxYaw: Math.max(stats.maxYaw, yaw),
  };
}

/**
 * Distinct from READY: a weak absolute peak, or a wide sweep whose score
 * barely moved. Capture is still allowed; the copy should not sound like
 * a confident lock.
 */
export function isSoftPeak(
  stats: SweepStats,
  peakScore: number | null,
  config = poseConfig,
): boolean {
  if (peakScore != null && peakScore < config.score.softSuccessBelow) {
    return true;
  }
  if (stats.samples < config.failure.lowStructAcrossSweep) return false;
  const yawSpan = stats.maxYaw - stats.minYaw;
  const scoreSpan = stats.maxScore - stats.minScore;
  return (
    yawSpan >= config.failure.flatPeakRangeDeg &&
    scoreSpan <= config.failure.flatScoreSpan
  );
}
