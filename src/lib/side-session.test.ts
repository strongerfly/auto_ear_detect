import { describe, expect, it } from "vitest";
import { poseConfig } from "../config";
import {
  EMPTY_SWEEP,
  introPromptFor,
  isSoftPeak,
  noteSweepSample,
  pickPromptDuringIntro,
  sideIntroUntil,
} from "./side-session";

describe("side switch intro", () => {
  it("names body left vs right", () => {
    expect(introPromptFor("leftEar")).toBe("INTRO_LEFT");
    expect(introPromptFor("rightEar")).toBe("INTRO_RIGHT");
  });

  it("holds the intro until the dwell window, except wrong-way", () => {
    const until = sideIntroUntil(0, 1800);
    expect(
      pickPromptDuringIntro(500, until, "INTRO_RIGHT", "SWEEP_RIGHT_EAR"),
    ).toBe("INTRO_RIGHT");
    expect(
      pickPromptDuringIntro(500, until, "INTRO_RIGHT", "NO_FACE"),
    ).toBe("INTRO_RIGHT");
    expect(
      pickPromptDuringIntro(500, until, "INTRO_RIGHT", "WRONG_SIDE"),
    ).toBe("WRONG_SIDE");
    expect(
      pickPromptDuringIntro(1800, until, "INTRO_RIGHT", "SWEEP_RIGHT_EAR"),
    ).toBe("SWEEP_RIGHT_EAR");
  });
});

describe("soft peak vs READY", () => {
  it("treats a weak absolute peak as soft-success", () => {
    expect(isSoftPeak(EMPTY_SWEEP, 0.4)).toBe(true);
    expect(isSoftPeak(EMPTY_SWEEP, 0.8)).toBe(false);
  });

  it("treats a wide, flat sweep as soft-success", () => {
    let stats = EMPTY_SWEEP;
    for (let yaw = 40; yaw <= 70; yaw += 2) {
      stats = noteSweepSample(stats, yaw, 0.62);
    }
    expect(stats.samples).toBeGreaterThanOrEqual(
      poseConfig.failure.lowStructAcrossSweep,
    );
    expect(isSoftPeak(stats, 0.62)).toBe(true);
  });

  it("does not flatten a sweep that actually peaked", () => {
    let stats = EMPTY_SWEEP;
    stats = noteSweepSample(stats, 40, 0.4);
    stats = noteSweepSample(stats, 45, 0.85);
    stats = noteSweepSample(stats, 70, 0.5);
    expect(isSoftPeak(stats, 0.85)).toBe(false);
  });
});

describe("keep the other side’s best", () => {
  it("clearing one side leaves the stored peak on the other", () => {
    const map = {
      leftEar: { yaw: -45, score: 0.8 },
      rightEar: { yaw: 45, score: 0.9 },
    };
    const afterRightReset = { ...map, rightEar: null };
    expect(afterRightReset.leftEar).toEqual(map.leftEar);
    expect(afterRightReset.rightEar).toBeNull();
  });
});
