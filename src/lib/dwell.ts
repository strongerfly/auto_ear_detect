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

export type DwellUx = {
  minDwellMs: number;
  crossFamilyDwellMs?: number;
  readyPromoteMs?: number;
};

type Family = "face" | "dist" | "pose" | "yaw" | "quality" | "hold" | "ready";

function familyOf(prompt: PromptKey): Family {
  switch (prompt) {
    case "NO_FACE":
    case "MULTI_FACE":
      return "face";
    case "TOO_FAR":
    case "TOO_CLOSE":
      return "dist";
    case "FIX_ROLL":
    case "PITCH_DOWN":
    case "PITCH_UP":
      return "pose";
    case "SWEEP_RIGHT_EAR":
    case "SWEEP_LEFT_EAR":
    case "TURN_MORE":
    case "TURN_BACK":
    case "TURN_BACK_OVERSHOOT":
    case "SLOW_DOWN":
    case "WRONG_SIDE":
      return "yaw";
    case "CLEAR_HAIR":
    case "BAD_LIGHT":
    case "TOO_DARK":
    case "TOO_BRIGHT":
      return "quality";
    case "HOLD_STILL":
      return "hold";
    case "READY":
      return "ready";
  }
}

export function dwellMsFor(
  from: PromptKey | null,
  to: PromptKey,
  ux: DwellUx,
): number {
  if (from === null) return 0;
  if (to === "READY" || to === "HOLD_STILL") return ux.readyPromoteMs ?? 200;
  if (familyOf(from) === familyOf(to)) return ux.minDwellMs;
  return ux.crossFamilyDwellMs ?? ux.minDwellMs;
}

/** Hold a prompt before switching (anti-flicker). READY promotes faster. */
export function dwellPrompt(
  state: DwellState,
  picked: PromptKey,
  nowMs: number,
  ux: DwellUx | number,
): DwellState {
  const resolved: DwellUx =
    typeof ux === "number" ? { minDwellMs: ux } : ux;
  if (state.displayed === null) {
    return { displayed: picked, candidate: picked, candidateSinceMs: nowMs };
  }
  let { displayed, candidate, candidateSinceMs } = state;
  if (picked !== candidate) {
    candidate = picked;
    candidateSinceMs = nowMs;
  }
  const need = dwellMsFor(displayed, picked, resolved);
  if (picked !== displayed && nowMs - candidateSinceMs >= need) {
    displayed = picked;
  }
  return { displayed, candidate, candidateSinceMs };
}
