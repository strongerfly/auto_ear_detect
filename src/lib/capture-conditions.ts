import type { EarSide } from "../config";
import type { EulerDeg } from "./types";

export type TimedStabilityConfig = {
  stableMs: number;
  velocityWindowMs: number;
  minVelocityWindowMs: number;
  maxGapMs: number;
  maxAngularSpeedDegPerSec: number;
  maxAngularRangeDeg: number;
};

export type TimedStabilityInput = {
  timestampMs: number;
  /** Unsmoothed pose from this distinct camera or simulator sample. */
  angles: EulerDeg | null;
  /** All current capture gates except the duration/motion gate passed. */
  eligible: boolean;
  source: string;
  side: EarSide;
};

export type TimedAngleSample = {
  timestampMs: number;
  angles: EulerDeg;
};

export type TimedStabilityState = {
  source: string | null;
  side: EarSide | null;
  lastTimestampMs: number | null;
  /** Motion survives quality failure so guidance can still explain a fast turn. */
  samples: readonly TimedAngleSample[];
  /** Only this uninterrupted eligible hold can contribute range or duration. */
  qualifiedSamples: readonly TimedAngleSample[];
  qualifiedSinceMs: number | null;
  stableMs: number;
  stable: boolean;
  /** Signed degrees/second; yaw sign also supports return-toward-peak guidance. */
  velocityDegPerSec: EulerDeg;
  velocityAvailable: boolean;
};

const AXES = ["yaw", "pitch", "roll"] as const;
const EPSILON = 1e-6;

export function createTimedStability(): TimedStabilityState {
  return {
    source: null,
    side: null,
    lastTimestampMs: null,
    samples: [],
    qualifiedSamples: [],
    qualifiedSinceMs: null,
    stableMs: 0,
    stable: false,
    velocityDegPerSec: { yaw: 0, pitch: 0, roll: 0 },
    velocityAvailable: false,
  };
}

function clearQualification(state: TimedStabilityState): TimedStabilityState {
  return {
    ...state,
    qualifiedSamples: [],
    qualifiedSinceMs: null,
    stableMs: 0,
    stable: false,
  };
}

function newSession(input: TimedStabilityInput): TimedStabilityState {
  return {
    ...createTimedStability(),
    source: input.source,
    side: input.side,
  };
}

function validConfig(config: TimedStabilityConfig): boolean {
  return (
    [
      config.stableMs, config.velocityWindowMs, config.minVelocityWindowMs,
      config.maxGapMs, config.maxAngularSpeedDegPerSec, config.maxAngularRangeDeg,
    ].every((value) => Number.isFinite(value) && value > 0) &&
    config.minVelocityWindowMs <= config.velocityWindowMs
  );
}

/** Keep one observed sample before the boundary for low-frame-rate cameras. */
function retainWindow(
  samples: readonly TimedAngleSample[],
  cutoffMs: number,
): TimedAngleSample[] {
  const first = samples.findIndex((sample) => sample.timestampMs >= cutoffMs);
  if (first === -1) return samples.length ? [samples[samples.length - 1]] : [];
  const start = first > 0 && samples[first].timestampMs > cutoffMs ? first - 1 : first;
  return samples.slice(start);
}

/**
 * Interpolate the boundary only for measuring a time window. Stored samples
 * remain actual observations; the extra fraction cannot add hold duration.
 */
function insideWindow(
  samples: readonly TimedAngleSample[],
  cutoffMs: number,
): TimedAngleSample[] {
  const window = retainWindow(samples, cutoffMs);
  if (window.length < 2 || window[0].timestampMs >= cutoffMs) return window;
  const before = window[0];
  const after = window[1];
  const fraction = (cutoffMs - before.timestampMs) /
    (after.timestampMs - before.timestampMs);
  const interpolate = (axis: typeof AXES[number]) =>
    before.angles[axis] + fraction * (after.angles[axis] - before.angles[axis]);
  return [{
    timestampMs: cutoffMs,
    angles: { yaw: interpolate("yaw"), pitch: interpolate("pitch"), roll: interpolate("roll") },
  }, ...window.slice(1)];
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

/** Long-baseline median slopes avoid dividing tracker jitter by a 16 ms frame. */
function measureVelocity(
  samples: readonly TimedAngleSample[],
  config: TimedStabilityConfig,
): Pick<TimedStabilityState, "velocityDegPerSec" | "velocityAvailable"> {
  const slopes: Record<typeof AXES[number], number[]> = { yaw: [], pitch: [], roll: [] };
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const elapsedMs = samples[j].timestampMs - samples[i].timestampMs;
      if (elapsedMs + EPSILON < config.minVelocityWindowMs) continue;
      for (const axis of AXES) {
        slopes[axis].push(
          (samples[j].angles[axis] - samples[i].angles[axis]) * 1_000 / elapsedMs,
        );
      }
    }
  }
  if (!slopes.yaw.length || !AXES.every((axis) => slopes[axis].every(Number.isFinite))) {
    return { velocityDegPerSec: { yaw: 0, pitch: 0, roll: 0 }, velocityAvailable: false };
  }
  return {
    velocityDegPerSec: {
      yaw: median(slopes.yaw), pitch: median(slopes.pitch), roll: median(slopes.roll),
    },
    velocityAvailable: true,
  };
}

function hasAcceptableRange(
  samples: readonly TimedAngleSample[],
  maxRangeDeg: number,
): boolean {
  return AXES.every((axis) => {
    const values = samples.map((sample) => sample.angles[axis]);
    const range = Math.max(...values) - Math.min(...values);
    return Number.isFinite(range) && range <= maxRangeDeg + EPSILON;
  });
}

/**
 * Observe distinct, monotonic samples from one ear/source. READY requires a
 * continuous qualified duration, enough motion evidence and a narrow angle
 * range across the whole hold window. Quality recovery cannot reuse credit.
 */
export function stepTimedStability(
  previous: TimedStabilityState,
  input: TimedStabilityInput,
  config: TimedStabilityConfig,
): TimedStabilityState {
  const now = input.timestampMs;
  const angles = input.angles;
  let state = previous.source === input.source && previous.side === input.side
    ? previous
    : newSession(input);
  if (!validConfig(config) || !Number.isFinite(now) || now < 0) return newSession(input);
  if (!angles || !AXES.every((axis) => Number.isFinite(angles[axis]))) {
    return { ...newSession(input), lastTimestampMs: now };
  }
  if (state.lastTimestampMs !== null) {
    if (now === state.lastTimestampMs) {
      return input.eligible ? state : clearQualification(state);
    }
    if (now < state.lastTimestampMs) {
      return { ...newSession(input), lastTimestampMs: now };
    }
    if (now - state.lastTimestampMs > config.maxGapMs) state = newSession(input);
  }

  const sample: TimedAngleSample = { timestampMs: now, angles: { ...angles } };
  const motionSamples = retainWindow([...state.samples, sample], now - config.velocityWindowMs);
  const velocity = measureVelocity(insideWindow(motionSamples, now - config.velocityWindowMs), config);
  const next: TimedStabilityState = {
    ...state,
    ...velocity,
    lastTimestampMs: now,
    samples: motionSamples,
  };
  if (!input.eligible || (velocity.velocityAvailable && AXES.some((axis) =>
    Math.abs(velocity.velocityDegPerSec[axis]) > config.maxAngularSpeedDegPerSec + EPSILON,
  ))) {
    return clearQualification(next);
  }

  const qualifiedSamples = retainWindow(
    [...state.qualifiedSamples, sample], now - config.stableMs,
  );
  if (!hasAcceptableRange(insideWindow(qualifiedSamples, now - config.stableMs), config.maxAngularRangeDeg)) {
    return clearQualification(next);
  }
  const qualifiedSinceMs = state.qualifiedSinceMs ?? now;
  const stableMs = now - qualifiedSinceMs;
  return {
    ...next,
    qualifiedSamples,
    qualifiedSinceMs,
    stableMs,
    stable: velocity.velocityAvailable && stableMs + EPSILON >= config.stableMs,
  };
}
