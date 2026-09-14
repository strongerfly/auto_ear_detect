export type ShutterPhase = "idle" | "countdown" | "cooldown";

export type ShutterState = {
  phase: ShutterPhase;
  sinceMs: number;
};

export const INITIAL_SHUTTER: ShutterState = { phase: "idle", sinceMs: 0 };

export type ShutterStep = {
  nowMs: number;
  enabled: boolean;
  allowCapture: boolean;
  cancelled: boolean;
  countdownMs: number;
  cooldownMs: number;
};

export function stepShutter(
  state: ShutterState,
  step: ShutterStep,
): { state: ShutterState; fire: boolean; countdownLeftMs: number } {
  if (!step.enabled || step.cancelled) {
    return { state: { ...INITIAL_SHUTTER, sinceMs: step.nowMs }, fire: false, countdownLeftMs: 0 };
  }
  if (!step.allowCapture) {
    if (state.phase === "cooldown") {
      const left = step.cooldownMs - (step.nowMs - state.sinceMs);
      if (left <= 0) {
        return { state: { phase: "idle", sinceMs: step.nowMs }, fire: false, countdownLeftMs: 0 };
      }
      return { state, fire: false, countdownLeftMs: 0 };
    }
    return { state: { phase: "idle", sinceMs: step.nowMs }, fire: false, countdownLeftMs: 0 };
  }

  if (state.phase === "idle") {
    return {
      state: { phase: "countdown", sinceMs: step.nowMs },
      fire: false,
      countdownLeftMs: step.countdownMs,
    };
  }
  if (state.phase === "countdown") {
    const left = step.countdownMs - (step.nowMs - state.sinceMs);
    if (left <= 0) {
      return {
        state: { phase: "cooldown", sinceMs: step.nowMs },
        fire: true,
        countdownLeftMs: 0,
      };
    }
    return { state, fire: false, countdownLeftMs: left };
  }
  const coolLeft = step.cooldownMs - (step.nowMs - state.sinceMs);
  if (step.allowCapture) {
    return { state, fire: false, countdownLeftMs: 0 };
  }
  if (coolLeft <= 0) {
    return { state: { phase: "idle", sinceMs: step.nowMs }, fire: false, countdownLeftMs: 0 };
  }
  return { state, fire: false, countdownLeftMs: 0 };
}
