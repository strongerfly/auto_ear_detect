import { pickBurstByScore, type BurstFrame } from "./burst";

export type AutoshutterPhase = "idle" | "arming" | "counting" | "cancelled";

export type AutoshutterState = {
  phase: AutoshutterPhase;
  startedAtMs: number;
  burst: BurstFrame[];
};

export const INITIAL_AUTOSHUTTER: AutoshutterState = {
  phase: "idle",
  startedAtMs: 0,
  burst: [],
};

export type AutoshutterTick = {
  now: number;
  enabled: boolean;
  allowCapture: boolean;
  cancelClick: boolean;
  frame: BurstFrame | null;
  burstFrames: number;
  autoshutterMs: number;
};

export type AutoshutterStep = {
  state: AutoshutterState;
  fire: BurstFrame | null;
  remainingMs: number;
};

/**
 * Cancelable countdown after a score-picked burst is full.
 * Leaving READY resets; a cancel click holds until the user leaves READY.
 */
export function stepAutoshutter(
  state: AutoshutterState,
  input: AutoshutterTick,
): AutoshutterStep {
  if (!input.enabled || !input.allowCapture) {
    return { state: INITIAL_AUTOSHUTTER, fire: null, remainingMs: 0 };
  }

  let burst = state.burst;
  if (input.frame && state.phase !== "cancelled" && state.phase !== "counting") {
    if (burst.length < input.burstFrames) {
      burst = [...burst, input.frame];
    }
  }

  if (input.cancelClick || state.phase === "cancelled") {
    return {
      state: { phase: "cancelled", startedAtMs: 0, burst },
      fire: null,
      remainingMs: 0,
    };
  }

  if (burst.length < input.burstFrames) {
    return {
      state: { phase: "arming", startedAtMs: 0, burst },
      fire: null,
      remainingMs: input.autoshutterMs,
    };
  }

  const startedAtMs =
    state.phase === "counting" && state.startedAtMs > 0
      ? state.startedAtMs
      : input.now;
  const remainingMs = Math.max(0, input.autoshutterMs - (input.now - startedAtMs));
  if (remainingMs <= 0) {
    return {
      state: INITIAL_AUTOSHUTTER,
      fire: pickBurstByScore(burst),
      remainingMs: 0,
    };
  }
  return {
    state: { phase: "counting", startedAtMs, burst },
    fire: null,
    remainingMs,
  };
}

export const AUTOSHUTTER_STORAGE_KEY = "auto-ear-detect:auto-shutter:v1";

/** First run: off. After that, the last checkbox value. */
export function loadAutoShutterEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(AUTOSHUTTER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveAutoShutterEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(AUTOSHUTTER_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore quota / privacy errors
  }
}
