import { describe, expect, it } from "vitest";
import { poseConfig } from "../config";
import {
  EMPTY_SWEEP,
  clearPeakForSide,
  introPromptFor,
  isSoftPeak,
  keepPeaksOnSideSwitch,
  noteSweepSample,
  pickPromptDuringIntro,
  showSoftSuccess,
  sideIntroUntil,
  stepSoftSuccessLatch,
} from "./side-session";

describe("side switch intro", () => {
  it("names body left vs right", () => {
    expect(introPromptFor("leftEar")).toBe("INTRO_LEFT");
    expect(introPromptFor("rightEar")).toBe("INTRO_RIGHT");
  });

  it("holds the intro until the dwell window, including wrong-way", () => {
    const until = sideIntroUntil(0, 1800);
    expect(
      pickPromptDuringIntro(500, until, "INTRO_RIGHT", "SWEEP_RIGHT_EAR"),
    ).toBe("INTRO_RIGHT");
    expect(
      pickPromptDuringIntro(500, until, "INTRO_RIGHT", "NO_FACE"),
    ).toBe("INTRO_RIGHT");
    expect(
      pickPromptDuringIntro(500, until, "INTRO_RIGHT", "WRONG_SIDE"),
    ).toBe("INTRO_RIGHT");
    expect(
      pickPromptDuringIntro(1800, until, "INTRO_RIGHT", "SWEEP_RIGHT_EAR"),
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      pickPromptDuringIntro(500, until, "INTRO_RIGHT", "STUCK_NO_PROGRESS"),
    ).toBe("STUCK_NO_PROGRESS");
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

  it("keeps soft-success visible through capture and clears if you leave first", () => {
    expect(stepSoftSuccessLatch(false, true, false)).toBe(true);
    expect(showSoftSuccess(true, true, false)).toBe(true);
    const held = stepSoftSuccessLatch(true, false, true);
    expect(held).toBe(true);
    expect(showSoftSuccess(held, false, true)).toBe(true);
    expect(stepSoftSuccessLatch(true, false, false)).toBe(false);
    expect(showSoftSuccess(false, false, true)).toBe(false);
    expect(showSoftSuccess(false, false, false)).toBe(false);
  });
});

describe("keep the other side’s best", () => {
  const map = {
    leftEar: { yaw: -45, score: 0.8 },
    rightEar: { yaw: 45, score: 0.9 },
  };

  it("side switch keeps both peaks (session reset does not wipe them)", () => {
    expect(keepPeaksOnSideSwitch(map)).toEqual(map);
    expect(keepPeaksOnSideSwitch(map).leftEar).toEqual(map.leftEar);
    expect(keepPeaksOnSideSwitch(map).rightEar).toEqual(map.rightEar);
  });

  it("relearn / clear on one side leaves the opposite peak", () => {
    const afterRightReset = clearPeakForSide(map, "rightEar");
    expect(afterRightReset.leftEar).toEqual(map.leftEar);
    expect(afterRightReset.rightEar).toBeNull();
    const afterLeftReset = clearPeakForSide(map, "leftEar");
    expect(afterLeftReset.rightEar).toEqual(map.rightEar);
    expect(afterLeftReset.leftEar).toBeNull();
  });
});
