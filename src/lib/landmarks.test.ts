import { describe, expect, it } from "vitest";
import { earInFrame, visibleRoiRatio } from "./landmarks";

describe("ear-in-frame cue", () => {
  it("is in frame when the padded box sits inside the image", () => {
    expect(
      visibleRoiRatio({ minX: 20, minY: 20, maxX: 80, maxY: 90 }, 100, 100),
    ).toBe(1);
    expect(earInFrame(1)).toBe(true);
  });

  it("is out of frame when most of the box is clipped", () => {
    const ratio = visibleRoiRatio(
      { minX: -80, minY: 10, maxX: 10, maxY: 90 },
      100,
      100,
    );
    expect(ratio).toBeLessThan(0.65);
    expect(earInFrame(ratio)).toBe(false);
  });
});
