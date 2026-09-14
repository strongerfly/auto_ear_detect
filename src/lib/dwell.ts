import type { PromptKey } from "../config";

export type DwellState = {
  displayed: PromptKey | null;
  candidate: PromptKey | null;
  candidateSinceMs: number;
};

export const INITIAL_DWELL: DwellState = {
  displayed: null,
  candidate: null,
  candidateSinceMs: 0,
};

/** Hold a prompt at least `minDwellMs` before switching (anti-flicker). */
export function dwellPrompt(
  state: DwellState,
  picked: PromptKey,
  nowMs: number,
  minDwellMs: number,
): DwellState {
  if (state.displayed === null) {
    return { displayed: picked, candidate: picked, candidateSinceMs: nowMs };
  }
  let { displayed, candidate, candidateSinceMs } = state;
  if (picked !== candidate) {
    candidate = picked;
    candidateSinceMs = nowMs;
  }
  if (picked !== displayed && nowMs - candidateSinceMs >= minDwellMs) {
    displayed = picked;
  }
  return { displayed, candidate, candidateSinceMs };
}
