import { describe, expect, it } from "vitest";
import { poseConfig } from "../config";
import { evaluateGuidance } from "./guidance";
import { dwellPrompt, INITIAL_DWELL } from "./dwell";
import { effectiveTargets } from "./effective-targets";
import { offsetFromPeakYaw } from "./offsets";
import type { GuidanceInput } from "./guidance";
import type { EarQuality } from "./types";

const sharp: EarQuality = {
  laplacian: 180,
  brightness: 120,
  edgeEnergy: 40,
};

function base(over: Partial<GuidanceInput> = {}): GuidanceInput {
  return {
    hasFace: true,
    facePresence: 0.9,
    trackingConfidence: 0.9,
    faceHeightRatio: 0.4,
    yaw: 80,
    pitch: 0,
    roll: 0,
    quality: sharp,
    ...over,
  };
}

describe("pickPrompt priority", () => {
  it("NO_FACE when missing", () => {
    const r = evaluateGuidance(base({ hasFace: false }), poseConfig, "rightEar", 0, 0);
    expect(r.prompt).toBe("NO_FACE");
    expect(r.allowCapture).toBe(false);
  });

  it("TOO_FAR / TOO_CLOSE", () => {
    expect(
      evaluateGuidance(base({ faceHeightRatio: 0.1 }), poseConfig, "rightEar", 0, 0)
        .prompt,
    ).toBe("TOO_FAR");
    expect(
      evaluateGuidance(base({ faceHeightRatio: 0.8 }), poseConfig, "rightEar", 0, 0)
        .prompt,
    ).toBe("TOO_CLOSE");
  });

  it("FIX_ROLL before pitch/yaw", () => {
    const r = evaluateGuidance(
      base({ roll: 20, pitch: 20, yaw: 0 }),
      poseConfig,
      "rightEar",
      0,
      0,
    );
    expect(r.prompt).toBe("FIX_ROLL");
  });

  it("PITCH_DOWN / PITCH_UP", () => {
    expect(
      evaluateGuidance(base({ pitch: 15 }), poseConfig, "rightEar", 0, 0).prompt,
    ).toBe("PITCH_DOWN");
    expect(
      evaluateGuidance(base({ pitch: -15 }), poseConfig, "rightEar", 0, 0).prompt,
    ).toBe("PITCH_UP");
  });

  it("right-ear turn hints", () => {
    expect(
      evaluateGuidance(base({ yaw: 20 }), poseConfig, "rightEar", 0, 0).prompt,
    ).toBe("TURN_LEFT");
    expect(
      evaluateGuidance(base({ yaw: 60 }), poseConfig, "rightEar", 0, 0).prompt,
    ).toBe("TURN_LEFT_MORE");
    expect(
      evaluateGuidance(base({ yaw: 100 }), poseConfig, "rightEar", 0, 0).prompt,
    ).toBe("TURN_LEFT_BACK");
  });

  it("left-ear turn hints (mirrored)", () => {
    expect(
      evaluateGuidance(base({ yaw: -20 }), poseConfig, "leftEar", 0, 0).prompt,
    ).toBe("TURN_RIGHT");
    expect(
      evaluateGuidance(base({ yaw: -60 }), poseConfig, "leftEar", 0, 0).prompt,
    ).toBe("TURN_RIGHT_MORE");
    expect(
      evaluateGuidance(base({ yaw: -100 }), poseConfig, "leftEar", 0, 0).prompt,
    ).toBe("TURN_RIGHT_BACK");
  });

  it("CLEAR_HAIR then BAD_LIGHT while in band", () => {
    expect(
      evaluateGuidance(
        base({ quality: { laplacian: 10, brightness: 120, edgeEnergy: 40 } }),
        poseConfig,
        "rightEar",
        0,
        0,
      ).prompt,
    ).toBe("CLEAR_HAIR");
    expect(
      evaluateGuidance(
        base({ quality: { laplacian: 180, brightness: 20, edgeEnergy: 40 } }),
        poseConfig,
        "rightEar",
        0,
        0,
      ).prompt,
    ).toBe("BAD_LIGHT");
  });

  it("HOLD_STILL until stable frames, then READY", () => {
    const hold = evaluateGuidance(base(), poseConfig, "rightEar", 0, 3);
    expect(hold.prompt).toBe("HOLD_STILL");
    expect(hold.allowCapture).toBe(false);
    const ready = evaluateGuidance(base(), poseConfig, "rightEar", 0, 12);
    expect(ready.prompt).toBe("READY");
    expect(ready.allowCapture).toBe(true);
  });

  it("left/right modes change copy at the same physical yaw=0", () => {
    const left = evaluateGuidance(base({ yaw: 0 }), poseConfig, "leftEar", 0, 0);
    const right = evaluateGuidance(base({ yaw: 0 }), poseConfig, "rightEar", 0, 0);
    expect(left.prompt).toBe("TURN_RIGHT");
    expect(right.prompt).toBe("TURN_LEFT");
  });
});

describe("personal offset", () => {
  it("shifts the yaw band and clamps", () => {
    const t = effectiveTargets("rightEar", 15, poseConfig);
    expect(t.offset).toBe(15);
    expect(t.yawCenter).toBe(95);
    expect(t.yawMin).toBe(85);
    expect(t.yawMax).toBe(100); // 90+15=105 clamped to 100
  });

  it("clamps offset from peak yaw to ±15", () => {
    expect(offsetFromPeakYaw("rightEar", 80 + 40)).toBe(15);
    expect(offsetFromPeakYaw("rightEar", 80 - 4)).toBe(-4);
    expect(offsetFromPeakYaw("leftEar", -80 + 6)).toBe(6);
  });

  it("offset changes TURN_LEFT_MORE threshold", () => {
    const without = evaluateGuidance(base({ yaw: 60 }), poseConfig, "rightEar", 0, 0);
    const withOff = evaluateGuidance(base({ yaw: 60 }), poseConfig, "rightEar", 10, 0);
    expect(without.prompt).toBe("TURN_LEFT_MORE");
    // 60 < 55+10=65 → still TURN_LEFT_MORE; 60 < 70+10, and 60 > 55+10=65? 60<65 so TURN_LEFT
    expect(withOff.prompt).toBe("TURN_LEFT");
  });
});

describe("prompt dwell", () => {
  it("shows first prompt immediately, then waits 400ms", () => {
    const a = dwellPrompt(INITIAL_DWELL, "NO_FACE", 0, 400);
    expect(a.displayed).toBe("NO_FACE");
    const b = dwellPrompt(a, "TURN_LEFT", 100, 400);
    expect(b.displayed).toBe("NO_FACE");
    const c = dwellPrompt(b, "TURN_LEFT", 500, 400);
    expect(c.displayed).toBe("TURN_LEFT");
  });
});
