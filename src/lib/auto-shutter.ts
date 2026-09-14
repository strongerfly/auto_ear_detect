export type AutoShutterInput = {
  allowCapture: boolean;
  autoShutter: boolean;
  cancelled: boolean;
  latched: boolean;
  startedAt: number | null;
  now: number;
  countdownMs: number;
  burstCount: number;
  burstNeeded: number;
};

export type AutoShutterStep = {
  remainingMs: number | null;
  fire: boolean;
  startedAt: number | null;
};

/**
 * Visible auto-shutter countdown. Fires once after READY is held for
 * `burstNeeded` frames and `countdownMs` have elapsed. Cancelled stays
 * off until the caller resets it (typically when READY drops).
 */
export function stepAutoShutter(input: AutoShutterInput): AutoShutterStep {
  const idle: AutoShutterStep = {
    remainingMs: null,
    fire: false,
    startedAt: null,
  };
  if (
    !input.allowCapture ||
    !input.autoShutter ||
    input.cancelled ||
    input.latched ||
    input.burstCount < input.burstNeeded
  ) {
    return idle;
  }
  const startedAt = input.startedAt ?? input.now;
  const remaining = input.countdownMs - (input.now - startedAt);
  if (remaining <= 0) {
    return { remainingMs: 0, fire: true, startedAt };
  }
  return { remainingMs: remaining, fire: false, startedAt };
}

export function countdownSeconds(remainingMs: number): number {
  return Math.max(1, Math.ceil(remainingMs / 1000));
}
