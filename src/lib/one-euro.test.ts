import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "./one-euro";

describe("OneEuroFilter", () => {
  it("passes through a constant signal", () => {
    const f = new OneEuroFilter(1, 0.007, 1);
    expect(f.filter(10, 0)).toBe(10);
    expect(f.filter(10, 16)).toBe(10);
    expect(f.filter(10, 32)).toBe(10);
  });

  it("smooths a step without exploding", () => {
    const f = new OneEuroFilter(1, 0.007, 1);
    f.filter(0, 0);
    const y = f.filter(10, 16);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(10);
  });
});
