import { describe, expect, it } from "vitest";
import { classifyEarQuality, measureEarQuality } from "./quality";
import { poseConfig } from "../config";

function solid(
  w: number,
  h: number,
  rgb: [number, number, number],
): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("ear ROI quality", () => {
  it("flat gray is blurry / low edge", () => {
    const q = measureEarQuality(solid(32, 32, [128, 128, 128]));
    expect(q.laplacian).toBeLessThan(1);
    expect(q.edgeEnergy).toBeLessThan(1);
    expect(q.brightness).toBeCloseTo(128, 0);
    expect(classifyEarQuality(q, poseConfig.earRoiQuality)).toBe("hair");
  });

  it("striped pattern is sharp with mid brightness", () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const on = x % 8 < 4;
        const i = (y * w + x) * 4;
        const v = on ? 220 : 40;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    const q = measureEarQuality({ data, width: w, height: h });
    expect(q.laplacian).toBeGreaterThan(100);
    expect(q.edgeEnergy).toBeGreaterThan(15);
    expect(classifyEarQuality(q, poseConfig.earRoiQuality)).toBe("ok");
  });
});
