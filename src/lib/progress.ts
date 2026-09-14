import type { PoseConfig } from "../config";
import { poseConfig } from "../config";

export type ProgressState = {
  lastImproveAtMs: number;
  lastPeakScore: number | null;
  stuck: boolean;
};

export function createProgress(nowMs: number): ProgressState {
  return {
    lastImproveAtMs: nowMs,
    lastPeakScore: null,
    stuck: false,
  };
}

export type ProgressInput = {
  now: number;
  peakScore: number | null;
  allowCapture: boolean;
  timeoutMs?: number;
  minImprove?: number;
  /** Side intro / already captured this side — do not declare stuck. */
  paused?: boolean;
};

/**
 * No-progress clock. Improving the stored peak (or first lock) resets it.
 * READY also resets so leaving the band does not instantly dump into stuck.
 * Timeout is a recovery narrative, not a hard fail.
 */
export function stepProgress(
  state: ProgressState,
  input: ProgressInput,
  config: PoseConfig = poseConfig,
): ProgressState {
  const timeoutMs = input.timeoutMs ?? config.failure.timeoutMs;
  const minImprove = input.minImprove ?? config.personalBest.minScoreImprove;
  let { lastImproveAtMs, lastPeakScore, stuck } = state;

  const improved =
    input.peakScore != null &&
    (lastPeakScore == null || input.peakScore >= lastPeakScore + minImprove);

  if (improved) {
    lastPeakScore = input.peakScore;
    lastImproveAtMs = input.now;
    stuck = false;
  }

  if (input.allowCapture) {
    return {
      lastImproveAtMs: input.now,
      lastPeakScore,
      stuck: false,
    };
  }

  if (input.paused) {
    if (!stuck) lastImproveAtMs = input.now;
    return { lastImproveAtMs, lastPeakScore, stuck: false };
  }

  if (!stuck && input.now - lastImproveAtMs >= timeoutMs) {
    stuck = true;
  }

  return { lastImproveAtMs, lastPeakScore, stuck };
}

export function retryProgress(state: ProgressState, nowMs: number): ProgressState {
  return {
    lastImproveAtMs: nowMs,
    lastPeakScore: state.lastPeakScore,
    stuck: false,
  };
}
