import { describe, expect, it } from "vitest";
import { startRelearnHoldoff, stepRelearnHoldoff } from "./relearn";

describe("relearn sweep intro", () => {
  it("stays in holdoff until yaw moves relearnSweepMinDeg", () => {
    let hold = startRelearnHoldoff("rightEar", 46);
    hold = stepRelearnHoldoff(hold, "rightEar", 46, 15);
    expect(hold).not.toBeNull();
    hold = stepRelearnHoldoff(hold, "rightEar", 50, 15);
    expect(hold).not.toBeNull();
    hold = stepRelearnHoldoff(hold, "rightEar", 62, 15);
    expect(hold).toBeNull();
  });

  it("anchors fromYaw on the first seen pose", () => {
    let hold = startRelearnHoldoff("rightEar", null);
    hold = stepRelearnHoldoff(hold, "rightEar", 45, 15);
    expect(hold?.fromYaw).toBe(45);
    hold = stepRelearnHoldoff(hold, "rightEar", 45, 15);
    expect(hold).not.toBeNull();
  });
});
