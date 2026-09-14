import { afterEach, describe, expect, it } from "vitest";
import {
  SIDE_STORAGE_KEY,
  gateCapture,
  loadChosenSide,
  parseChosenSide,
  saveChosenSide,
} from "./chosen-side";

afterEach(() => {
  localStorage.removeItem(SIDE_STORAGE_KEY);
});

describe("chosen side persistence", () => {
  it("starts unset on a cold start", () => {
    expect(loadChosenSide()).toBeNull();
    expect(parseChosenSide(null)).toBeNull();
    expect(parseChosenSide("")).toBeNull();
    expect(parseChosenSide("both")).toBeNull();
  });

  it("persists left and right body-side picks", () => {
    saveChosenSide("leftEar");
    expect(localStorage.getItem(SIDE_STORAGE_KEY)).toBe("leftEar");
    expect(loadChosenSide()).toBe("leftEar");
    saveChosenSide("rightEar");
    expect(loadChosenSide()).toBe("rightEar");
  });

  it("ignores invalid stored values so capture stays gated", () => {
    localStorage.setItem(SIDE_STORAGE_KEY, "mirror-right");
    expect(loadChosenSide()).toBeNull();
  });
});

describe("gated capture until a side is chosen", () => {
  it("blocks capture even when guidance is READY", () => {
    expect(
      gateCapture({ side: null, guidanceAllowCapture: true }),
    ).toBe(false);
    expect(
      gateCapture({ side: undefined, guidanceAllowCapture: true }),
    ).toBe(false);
  });

  it("allows capture only after a side is chosen and guidance agrees", () => {
    expect(
      gateCapture({ side: "leftEar", guidanceAllowCapture: true }),
    ).toBe(true);
    expect(
      gateCapture({ side: "rightEar", guidanceAllowCapture: true }),
    ).toBe(true);
    expect(
      gateCapture({ side: "rightEar", guidanceAllowCapture: false }),
    ).toBe(false);
  });

  it("still respects stuck and already-captured on the chosen side", () => {
    expect(
      gateCapture({
        side: "leftEar",
        guidanceAllowCapture: true,
        stuck: true,
      }),
    ).toBe(false);
    expect(
      gateCapture({
        side: "leftEar",
        guidanceAllowCapture: true,
        capturedThisSide: true,
      }),
    ).toBe(false);
  });
});
