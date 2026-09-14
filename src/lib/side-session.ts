import type { EarSide, PromptKey } from "../config";
import { poseConfig } from "../config";
import type { PersonalBestMap } from "./personal-best";

export function introPromptFor(side: EarSide): PromptKey {
  return side === "rightEar" ? "INTRO_RIGHT" : "INTRO_LEFT";
}

/**
 * Side switch resets shutter / dwell / intro in the session, but peaks are
 * per-ear and must pass through unchanged.
 */
export function keepPeaksOnSideSwitch(
  bests: PersonalBestMap,
): PersonalBestMap {
  return { leftEar: bests.leftEar, rightEar: bests.rightEar };
}

/** Relearn clears only this ear’s peak; the opposite side is kept. */
export function clearPeakForSide(
  bests: PersonalBestMap,
  side: EarSide,
): PersonalBestMap {
  return { ...bests, [side]: null };
}

export function sideIntroUntil(
  nowMs: number,
  introMs: number = poseConfig.promptUx.sideIntroMs,
): number {
  return nowMs + introMs;
}

/**
 * After a left/right switch, keep the body-side intro on screen for the
 * whole intro window so the user sees which ear they just picked (body L/R).
 * Stuck recovery can still interrupt.
 */
export function pickPromptDuringIntro(
  nowMs: number,
  introUntilMs: number,
  introPrompt: PromptKey,
  guidancePrompt: PromptKey,
): PromptKey {
  if (nowMs >= introUntilMs) return guidancePrompt;
  if (guidancePrompt === "STUCK_NO_PROGRESS") return guidancePrompt;
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
