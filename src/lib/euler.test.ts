import { describe, expect, it } from "vitest";
import {
  composeYxzRowMajor,
  extractYxzRadians,
  matrixToFiswgEuler,
} from "./euler";

const DEG = Math.PI / 180;

function close(a: number, b: number, eps = 1e-6) {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe("YXZ euler round-trip", () => {
  it.each([
    [0, 0, 0],
    [30, 0, 0],
    [0, 12, 0],
    [0, 0, -8],
    [80, -5, 3],
    [-80, 4, -2],
    [70, 8, 8],
  ])("compose/extract yaw=%i pitch=%i roll=%i", (y, p, r) => {
    const m = composeYxzRowMajor(y * DEG, p * DEG, r * DEG);
    const e = extractYxzRadians(m);
    close(e.yaw / DEG, y, 1e-4);
    close(e.pitch / DEG, p, 1e-4);
    close(e.roll / DEG, r, 1e-4);
  });
});

describe("FISWG yaw sign", () => {
  it("+yaw means right ear (subject +X) moves toward the camera (+Z)", () => {
    // Negative raw Ry brings +X toward +Z; FISWG must report positive yaw.
    const towardCamera = composeYxzRowMajor(-80 * DEG, 0, 0);
    const fiswg = matrixToFiswgEuler(towardCamera);
    expect(fiswg.yaw).toBeGreaterThan(75);
    expect(fiswg.yaw).toBeLessThan(85);

    const x = { x: 1, y: 0, z: 0 };
    const r00 = towardCamera[0];
    const r20 = towardCamera[8];
    const zAfter = r20 * x.x; // z' of (1,0,0)
    const xAfter = r00 * x.x;
    expect(zAfter).toBeGreaterThan(0);
    expect(xAfter).toBeGreaterThan(0);
  });

  it("−yaw means left ear visible", () => {
    const leftProfile = composeYxzRowMajor(80 * DEG, 0, 0);
    const fiswg = matrixToFiswgEuler(leftProfile);
    expect(fiswg.yaw).toBeLessThan(-75);
    expect(fiswg.yaw).toBeGreaterThan(-85);
  });

  it("+pitch is nose-up", () => {
    const m = composeYxzRowMajor(0, 10 * DEG, 0);
    const fiswg = matrixToFiswgEuler(m);
    expect(fiswg.pitch).toBeGreaterThan(9);
  });
});
