import { describe, expect, it } from "vitest";
import {
  createTimedStability,
  stepTimedStability,
  type TimedStabilityConfig,
  type TimedStabilityInput,
  type TimedStabilityState,
} from "./capture-conditions";
import type { EulerDeg } from "./types";

const config: TimedStabilityConfig = {
  stableMs: 700,
  velocityWindowMs: 200,
  minVelocityWindowMs: 150,
  maxGapMs: 500,
  maxAngularSpeedDegPerSec: 8,
  maxAngularRangeDeg: 2.5,
};
const fpsValues = [5, 10, 15, 30, 60];

function sample(timestampMs: number, over: Partial<TimedStabilityInput> = {}): TimedStabilityInput {
  return {
    timestampMs,
    angles: { yaw: 45, pitch: 0, roll: 0 },
    eligible: true,
    source: "camera:front",
    side: "rightEar",
    ...over,
  };
}

function hold(untilMs = 1_000, everyMs = 100): TimedStabilityState {
  let state = createTimedStability();
  for (let at = 0; at <= untilMs; at += everyMs) {
    state = stepTimedStability(state, sample(at), config);
  }
  return state;
}

describe("timed ear stability", () => {
  it.each(fpsValues)("requires the same qualified duration at %i FPS", (fps) => {
    let state = createTimedStability();
    let readyAt: number | null = null;
    for (let frame = 0; frame <= fps * 2; frame++) {
      const at = frame * 1_000 / fps;
      state = stepTimedStability(state, sample(at), config);
      if (at < config.stableMs - 1e-6) expect(state.stable).toBe(false);
      if (state.stable) {
        readyAt = at;
        break;
      }
    }
    expect(readyAt).not.toBeNull();
    expect(readyAt!).toBeGreaterThanOrEqual(config.stableMs);
    expect(readyAt!).toBeLessThan(config.stableMs + 1_000 / fps + 1e-6);
    expect(state.velocityAvailable).toBe(true);
    expect(state.velocityDegPerSec).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  it("requires enough elapsed motion evidence before reporting zero velocity", () => {
    let state = stepTimedStability(createTimedStability(), sample(0), config);
    expect(state.velocityAvailable).toBe(false);
    state = stepTimedStability(state, sample(149), config);
    expect(state.velocityAvailable).toBe(false);
    expect(state.stable).toBe(false);
    state = stepTimedStability(state, sample(150), config);
    expect(state.velocityAvailable).toBe(true);
    expect(state.stableMs).toBe(150);
    expect(state.stable).toBe(false);
  });

  it.each(fpsValues)("reports signed degrees/second for the same motion at %i FPS", (fps) => {
    let state = createTimedStability();
    for (let frame = 0; frame <= fps; frame++) {
      const at = frame * 1_000 / fps;
      state = stepTimedStability(state, sample(at, {
        eligible: false,
        angles: { yaw: 45 - 20 * at / 1_000, pitch: 12 * at / 1_000, roll: -6 * at / 1_000 },
      }), config);
    }
    expect(state.velocityAvailable).toBe(true);
    expect(state.velocityDegPerSec.yaw).toBeCloseTo(-20, 8);
    expect(state.velocityDegPerSec.pitch).toBeCloseTo(12, 8);
    expect(state.velocityDegPerSec.roll).toBeCloseTo(-6, 8);
    expect(state.stableMs).toBe(0);
    expect(state.stable).toBe(false);
  });

  it.each(fpsValues)("rejects continuous slow turning across the whole hold at %i FPS", (fps) => {
    let state = createTimedStability();
    for (let frame = 0; frame <= fps * 3; frame++) {
      const at = frame * 1_000 / fps;
      state = stepTimedStability(state, sample(at, {
        angles: { yaw: 45 + 5 * at / 1_000, pitch: 0, roll: 0 },
      }), config);
      expect(state.stable).toBe(false);
    }
    expect(state.velocityDegPerSec.yaw).toBeCloseTo(5, 8);
    expect(state.velocityDegPerSec.yaw).toBeLessThan(config.maxAngularSpeedDegPerSec);
  });

  it.each(fpsValues)("allows a narrow gradual drift without an extra low-FPS range penalty at %i FPS", (fps) => {
    let state = createTimedStability();
    for (let frame = 0; frame <= fps * 3; frame++) {
      const at = frame * 1_000 / fps;
      state = stepTimedStability(state, sample(at, {
        angles: { yaw: 45 + 3.4 * at / 1_000, pitch: 0, roll: 0 },
      }), config);
      if (at >= config.stableMs) expect(state.stable).toBe(true);
    }
    expect(state.velocityDegPerSec.yaw).toBeCloseTo(3.4, 8);
  });

  it.each(fpsValues)("rejects back-and-forth movement even when its net angle cancels at %i FPS", (fps) => {
    let state = createTimedStability();
    for (let frame = 0; frame <= fps * 3; frame++) {
      const at = frame * 1_000 / fps;
      const phase = at % 1_000;
      const yawOffset = phase <= 500 ? phase * 7 / 1_000 : (1_000 - phase) * 7 / 1_000;
      state = stepTimedStability(state, sample(at, {
        angles: { yaw: 45 + yawOffset, pitch: 0, roll: 0 },
      }), config);
      expect(state.stable).toBe(false);
    }
  });

  it.each(["yaw", "pitch", "roll"] as const)("rejects a fast %s motion even when other axes hold", (axis) => {
    let state = createTimedStability();
    for (let at = 0; at <= 1_000; at += 50) {
      const angles: EulerDeg = { yaw: 45, pitch: 0, roll: 0 };
      angles[axis] += 20 * at / 1_000;
      state = stepTimedStability(state, sample(at, { angles }), config);
      expect(state.stable).toBe(false);
    }
    expect(state.velocityDegPerSec[axis]).toBeCloseTo(20, 8);
    expect(state.qualifiedSinceMs).toBeNull();
  });

  it.each(fpsValues)("does not amplify sub-degree tracking jitter at %i FPS", (fps) => {
    let state = createTimedStability();
    for (let frame = 0; frame <= fps * 2; frame++) {
      const at = frame * 1_000 / fps;
      const jitter = Math.sin(at * 2 * Math.PI * 3 / 1_000) * 0.2;
      state = stepTimedStability(state, sample(at, {
        angles: { yaw: 45 + jitter, pitch: jitter, roll: -jitter },
      }), config);
    }
    expect(state.stable).toBe(true);
    expect(Math.abs(state.velocityDegPerSec.yaw)).toBeLessThan(config.maxAngularSpeedDegPerSec);
  });

  it("clears a qualified hold immediately on a large angle excursion", () => {
    const state = stepTimedStability(hold(), sample(1_016, {
      angles: { yaw: 49, pitch: 0, roll: 0 },
    }), config);
    expect(state.stable).toBe(false);
    expect(state.stableMs).toBe(0);
    expect(state.qualifiedSinceMs).toBeNull();
  });

  it("does not reuse a stationary blurry or distant interval after quality recovers", () => {
    let state = hold();
    state = stepTimedStability(state, sample(1_100, { eligible: false }), config);
    expect(state.stable).toBe(false);
    expect(state.qualifiedSinceMs).toBeNull();
    expect(state.velocityAvailable).toBe(true);
    for (let at = 1_200; at <= 2_500; at += 100) {
      state = stepTimedStability(state, sample(at, { eligible: false }), config);
      expect(state.stableMs).toBe(0);
    }
    for (let at = 2_600; at <= 3_300; at += 100) {
      state = stepTimedStability(state, sample(at), config);
      expect(state.qualifiedSinceMs).toBe(2_600);
      expect(state.stable).toBe(at >= 3_300);
    }
  });

  it("retains fast motion evidence while quality is ineligible", () => {
    let state = hold();
    state = stepTimedStability(state, sample(1_200, {
      eligible: false, angles: { yaw: 57, pitch: 0, roll: 0 },
    }), config);
    expect(state.velocityAvailable).toBe(true);
    expect(state.velocityDegPerSec.yaw).toBeGreaterThan(45);
    expect(state.qualifiedSinceMs).toBeNull();
    expect(state.stable).toBe(false);
  });

  it("ignores duplicate samples without adding duration or learning new angles", () => {
    const state = hold(300);
    const repeated = stepTimedStability(state, sample(300, {
      angles: { yaw: 70, pitch: 0, roll: 0 },
    }), config);
    expect(repeated).toBe(state);
    expect(repeated.stableMs).toBe(300);
    expect(repeated.samples).toHaveLength(state.samples.length);
  });

  it("invalidates eligibility even when the failure arrives at a duplicate timestamp", () => {
    const state = stepTimedStability(hold(), sample(1_000, { eligible: false }), config);
    expect(state.stable).toBe(false);
    expect(state.stableMs).toBe(0);
    expect(state.qualifiedSinceMs).toBeNull();
    expect(state.velocityAvailable).toBe(true);
  });

  it("resets on an out-of-order timestamp instead of retaining READY", () => {
    let state = stepTimedStability(hold(), sample(900), config);
    expect(state.stable).toBe(false);
    expect(state.stableMs).toBe(0);
    expect(state.velocityAvailable).toBe(false);
    expect(state.samples).toHaveLength(0);
    state = stepTimedStability(state, sample(1_000), config);
    expect(state.qualifiedSinceMs).toBe(1_000);
    expect(state.stableMs).toBe(0);
  });

  it("starts a fresh hold after a camera pause rather than crediting the gap", () => {
    let state = stepTimedStability(hold(), sample(1_501), config);
    expect(state.stable).toBe(false);
    expect(state.stableMs).toBe(0);
    expect(state.velocityAvailable).toBe(false);
    expect(state.samples).toHaveLength(1);
    for (let at = 1_601; at <= 2_201; at += 100) {
      state = stepTimedStability(state, sample(at), config);
    }
    expect(state.qualifiedSinceMs).toBe(1_501);
    expect(state.stable).toBe(true);
  });

  it("accepts the configured maximum interval without falsely labeling it a pause", () => {
    const state = stepTimedStability(hold(), sample(1_500), config);
    expect(state.qualifiedSinceMs).toBe(0);
    expect(state.stable).toBe(true);
  });

  it.each([
    ["simulator", { source: "simulator" }],
    ["another camera", { source: "camera:rear" }],
    ["another ear", { side: "leftEar" as const }],
  ])("does not carry READY into %s even at the same timestamp", (_label, over) => {
    const state = stepTimedStability(hold(), sample(1_000, over), config);
    expect(state.stable).toBe(false);
    expect(state.stableMs).toBe(0);
    expect(state.velocityAvailable).toBe(false);
    expect(state.samples).toHaveLength(1);
    expect(state.qualifiedSinceMs).toBe(1_000);
  });

  it.each([
    ["no angles", { angles: null }],
    ["non-finite yaw", { angles: { yaw: Number.NaN, pitch: 0, roll: 0 } }],
    ["non-finite pitch", { angles: { yaw: 45, pitch: Number.POSITIVE_INFINITY, roll: 0 } }],
    ["non-finite roll", { angles: { yaw: 45, pitch: 0, roll: Number.NEGATIVE_INFINITY } }],
    ["non-finite time", { timestampMs: Number.NaN }],
    ["negative time", { timestampMs: -1 }],
  ])("fails closed on %s", (_label, over) => {
    const state = stepTimedStability(hold(), sample(1_100, over), config);
    expect(state.stable).toBe(false);
    expect(state.stableMs).toBe(0);
    expect(state.velocityAvailable).toBe(false);
    expect(state.samples).toHaveLength(0);
  });

  it("fails closed for malformed timing thresholds", () => {
    const state = stepTimedStability(hold(), sample(1_100), {
      ...config, minVelocityWindowMs: 300,
    });
    expect(state.stable).toBe(false);
    expect(state.qualifiedSinceMs).toBeNull();
  });

  it("keeps bounded windows and does not mutate old state or caller-owned angles", () => {
    const angles = { yaw: 45, pitch: 0, roll: 0 };
    const first = stepTimedStability(createTimedStability(), sample(0, { angles }), config);
    const snapshot = JSON.stringify(first);
    angles.yaw = 90;
    expect(first.samples[0].angles.yaw).toBe(45);
    let state = first;
    for (let frame = 1; frame <= 60 * 10; frame++) {
      state = stepTimedStability(state, sample(frame * 1_000 / 60), config);
    }
    expect(state.stable).toBe(true);
    expect(state.samples.length).toBeLessThanOrEqual(14);
    expect(state.qualifiedSamples.length).toBeLessThanOrEqual(44);
    expect(JSON.stringify(first)).toBe(snapshot);
  });
});
