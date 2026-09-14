import { describe, expect, it } from "vitest";
import {
  LEFT_EAR_LANDMARKS,
  RIGHT_EAR_LANDMARKS,
  measureEarRoi,
} from "./landmarks";
import type { Landmark } from "./types";

function meshWithEar(
  indices: readonly number[],
  nx: number,
  ny: number,
): Landmark[] {
  const pts: Landmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
  indices.forEach((i, n) => {
    pts[i] = {
      x: nx + (n % 3) * 0.02,
      y: ny + Math.floor(n / 3) * 0.03,
      z: 0,
    };
  });
  return pts;
}

describe("measureEarRoi", () => {
  it("marks the crop clipped when the padded ear box leaves the frame", () => {
    const right = measureEarRoi(
      meshWithEar(RIGHT_EAR_LANDMARKS, 0.001, 0.45),
      "rightEar",
      640,
      480,
    );
    expect(right).not.toBeNull();
    expect(right?.clipped).toBe(true);

    const inFrame = measureEarRoi(
      meshWithEar(LEFT_EAR_LANDMARKS, 0.45, 0.4),
      "leftEar",
      640,
      480,
    );
    expect(inFrame).not.toBeNull();
    expect(inFrame?.clipped).toBe(false);
  });
});
