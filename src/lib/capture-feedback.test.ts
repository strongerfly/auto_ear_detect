import { describe, expect, it } from "vitest";
import {
  captureFeedbackFor,
  captureResultKey,
  gradeCapture,
  otherEar,
} from "./capture-feedback";

describe("post-capture grade vs peak", () => {
  it("calls a shot near the peak when score stays at/above the ready ratio", () => {
    expect(gradeCapture(0.92, 1, 0.92)).toBe("nearPeak");
    expect(gradeCapture(1, 1, 0.92)).toBe("nearPeak");
  });

  it("calls a shot off-peak when the score dropped below the ready ratio", () => {
    expect(gradeCapture(0.7, 1, 0.92)).toBe("offPeak");
  });

  it("does not require a stored peak (treat as near)", () => {
    expect(gradeCapture(0.4, null)).toBe("nearPeak");
  });

  it("records the side and the other-ear target without degrees", () => {
    const fb = captureFeedbackFor("rightEar", 0.95, 1);
    expect(fb.side).toBe("rightEar");
    expect(fb.grade).toBe("nearPeak");
    expect(otherEar(fb.side)).toBe("leftEar");
    expect(otherEar("leftEar")).toBe("rightEar");
    expect(fb.soft).toBe(false);
    expect(captureResultKey(fb)).toBe("captureNearPeak");
  });

  it("uses the soft sentence when the shutter fired on a weak/flat peak", () => {
    const soft = captureFeedbackFor("leftEar", 0.5, 0.52, 0.92, true);
    expect(soft.soft).toBe(true);
    expect(soft.grade).toBe("nearPeak");
    expect(captureResultKey(soft)).toBe("captureSoftSuccess");
    expect(captureResultKey({ grade: "offPeak", soft: false })).toBe(
      "captureOffPeak",
    );
  });
});
