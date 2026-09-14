import { describe, expect, it } from "vitest";
import { extendSweepAbs, sweepCoverageRatio } from "./sweep";
import { poseConfig } from "../config";

describe("sweep coverage", () => {
  const band = poseConfig.search.rightEar;

  it("is 0 until a yaw sample exists", () => {
    expect(sweepCoverageRatio(null, null, band.yawAbsMin, band.yawAbsMax)).toBe(0);
  });

  it("a 35→45 hold covers well under 60% of 35–90", () => {
    const a = extendSweepAbs(null, null, 35);
    const b = extendSweepAbs(a.minAbs, a.maxAbs, 45);
    const ratio = sweepCoverageRatio(
      b.minAbs,
      b.maxAbs,
      band.yawAbsMin,
      band.yawAbsMax,
    );
    expect(ratio).toBeLessThan(poseConfig.search.minSweepCoverageRatio);
    expect(ratio).toBeCloseTo(10 / 55, 5);
  });

  it("35→80 covers more than 60%", () => {
    const a = extendSweepAbs(null, null, 35);
    const b = extendSweepAbs(a.minAbs, a.maxAbs, 80);
    expect(
      sweepCoverageRatio(b.minAbs, b.maxAbs, band.yawAbsMin, band.yawAbsMax),
    ).toBeGreaterThan(poseConfig.search.minSweepCoverageRatio);
  });
});
