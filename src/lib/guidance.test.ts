import { describe, expect, it } from "vitest";
import { poseConfig } from "../config";
import { evaluateGuidance } from "./guidance";
import { dwellPrompt, INITIAL_DWELL } from "./dwell";
import { effectiveTargets } from "./effective-targets";
import {
  updatePersonalBest,
  yawInSearchWindow,
  type PeakSample,
} from "./personal-best";
import {
  frontalQualityScore,
  qualityAlongYawCurve,
} from "./quality";
import type { GuidanceInput } from "./guidance";
import type { EarQuality } from "./types";

const sharp: EarQuality = {
  laplacian: 180,
  brightness: 120,
  edgeEnergy: 40,
};

const sharpScore = frontalQualityScore(sharp);

function peakAt(yaw: number, quality: EarQuality = sharp): PeakSample {
  return { yaw, score: frontalQualityScore(quality) };
}

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
    const r = evaluateGuidance(base({ hasFace: false }), poseConfig, "rightEar", null, 0);
    expect(r.prompt).toBe("NO_FACE");
    expect(r.allowCapture).toBe(false);
  });

  it("TOO_FAR / TOO_CLOSE", () => {
    expect(
      evaluateGuidance(base({ faceHeightRatio: 0.1 }), poseConfig, "rightEar", null, 0)
        .prompt,
    ).toBe("TOO_FAR");
    expect(
      evaluateGuidance(base({ faceHeightRatio: 0.8 }), poseConfig, "rightEar", null, 0)
        .prompt,
    ).toBe("TOO_CLOSE");
  });

  it("FIX_ROLL before pitch/yaw", () => {
    const r = evaluateGuidance(
      base({ roll: 20, pitch: 20, yaw: 0 }),
      poseConfig,
      "rightEar",
      null,
      0,
    );
    expect(r.prompt).toBe("FIX_ROLL");
  });

  it("PITCH_DOWN / PITCH_UP", () => {
    expect(
      evaluateGuidance(base({ pitch: 15 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("PITCH_DOWN");
    expect(
      evaluateGuidance(base({ pitch: -15 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("PITCH_UP");
  });

  it("right-ear turn hints vs prior ~80° before a personal peak exists", () => {
    expect(
      evaluateGuidance(base({ yaw: 20 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("TURN_LEFT");
    expect(
      evaluateGuidance(base({ yaw: 60 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("TURN_LEFT_MORE");
    expect(
      evaluateGuidance(base({ yaw: 100 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("TURN_LEFT_BACK");
  });

  it("left-ear turn hints (mirrored) vs prior ~−80°", () => {
    expect(
      evaluateGuidance(base({ yaw: -20 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("TURN_RIGHT");
    expect(
      evaluateGuidance(base({ yaw: -60 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("TURN_RIGHT_MORE");
    expect(
      evaluateGuidance(base({ yaw: -100 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("TURN_RIGHT_BACK");
  });

  it("CLEAR_HAIR then BAD_LIGHT while near the personal peak", () => {
    const best = peakAt(80);
    expect(
      evaluateGuidance(
        base({ quality: { laplacian: 10, brightness: 120, edgeEnergy: 40 } }),
        poseConfig,
        "rightEar",
        best,
        0,
      ).prompt,
    ).toBe("CLEAR_HAIR");
    expect(
      evaluateGuidance(
        base({ quality: { laplacian: 180, brightness: 20, edgeEnergy: 40 } }),
        poseConfig,
        "rightEar",
        best,
        0,
      ).prompt,
    ).toBe("BAD_LIGHT");
  });

  it("HOLD_STILL until stable frames, then READY near a locked 80° peak", () => {
    const best = peakAt(80);
    const hold = evaluateGuidance(base(), poseConfig, "rightEar", best, 3);
    expect(hold.prompt).toBe("HOLD_STILL");
    expect(hold.allowCapture).toBe(false);
    const ready = evaluateGuidance(base(), poseConfig, "rightEar", best, 12);
    expect(ready.prompt).toBe("READY");
    expect(ready.allowCapture).toBe(true);
  });

  it("left/right modes change copy at the same physical yaw=0", () => {
    const left = evaluateGuidance(base({ yaw: 0 }), poseConfig, "leftEar", null, 0);
    const right = evaluateGuidance(base({ yaw: 0 }), poseConfig, "rightEar", null, 0);
    expect(left.prompt).toBe("TURN_RIGHT");
    expect(right.prompt).toBe("TURN_LEFT");
  });
});

describe("quality-driven personal best yaw", () => {
  it("search window includes 45° and excludes near-frontal", () => {
    expect(yawInSearchWindow(45, "rightEar")).toBe(true);
    expect(yawInSearchWindow(35, "rightEar")).toBe(true);
    expect(yawInSearchWindow(20, "rightEar")).toBe(false);
    expect(yawInSearchWindow(-45, "rightEar")).toBe(false);
    expect(yawInSearchWindow(-45, "leftEar")).toBe(true);
  });

  it("bestYaw tracks the yaw at the highest quality score in the window", () => {
    let best: PeakSample | null = null;
    const samples: Array<[number, EarQuality]> = [
      [40, { laplacian: 80, brightness: 120, edgeEnergy: 20 }],
      [45, { laplacian: 220, brightness: 120, edgeEnergy: 50 }],
      [60, { laplacian: 140, brightness: 120, edgeEnergy: 30 }],
      [80, { laplacian: 100, brightness: 120, edgeEnergy: 20 }],
      [20, { laplacian: 400, brightness: 120, edgeEnergy: 80 }],
    ];
    for (const [yaw, quality] of samples) {
      best = updatePersonalBest(best, {
        yaw,
        pitch: 0,
        roll: 0,
        quality,
        side: "rightEar",
      });
    }
    expect(best).not.toBeNull();
    expect(best!.yaw).toBe(45);
    expect(best!.score).toBeGreaterThan(frontalQualityScore(samples[0][1]));
  });

  it("ignores a higher score when pitch/roll are out of guidance range", () => {
    const first = updatePersonalBest(null, {
      yaw: 50,
      pitch: 0,
      roll: 0,
      quality: sharp,
      side: "rightEar",
    });
    const next = updatePersonalBest(first, {
      yaw: 70,
      pitch: 0,
      roll: 20,
      quality: { laplacian: 400, brightness: 120, edgeEnergy: 80 },
      side: "rightEar",
    });
    expect(next?.yaw).toBe(50);
  });

  it("READY near a personal peak at 45° without yaw in 70–90", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ yaw: 45, quality: sharp }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(r.targets.locked).toBe(true);
    expect(r.targets.bestYaw).toBe(45);
    expect(r.prompt).toBe("READY");
    expect(r.allowCapture).toBe(true);
    expect(r.poseReady).toBe(true);
  });

  it("fixed 70–90 band alone is not sufficient for READY", () => {
    const r = evaluateGuidance(base({ yaw: 80 }), poseConfig, "rightEar", null, 12);
    expect(r.allowCapture).toBe(false);
    expect(r.prompt).not.toBe("READY");
    expect(r.poseReady).toBe(false);
    expect(r.prompt).toBe("HOLD_STILL");
  });

  it("yaw=80 is not READY when the personal peak is 45°", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ yaw: 80, quality: sharp }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(r.allowCapture).toBe(false);
    expect(r.prompt).toBe("TURN_LEFT_BACK");
  });

  it("guides toward the personal best, not the 80° prior", () => {
    const best = peakAt(45);
    expect(
      evaluateGuidance(base({ yaw: 15 }), poseConfig, "rightEar", best, 0).prompt,
    ).toBe("TURN_LEFT");
    expect(
      evaluateGuidance(base({ yaw: 28 }), poseConfig, "rightEar", best, 0).prompt,
    ).toBe("TURN_LEFT_MORE");
    expect(
      evaluateGuidance(base({ yaw: 70 }), poseConfig, "rightEar", best, 0).prompt,
    ).toBe("TURN_LEFT_BACK");
  });

  it("synthetic path peaking at 45° becomes READY after returning to the peak", () => {
    let best: PeakSample | null = null;
    const path = [20, 30, 35, 40, 45, 50, 60, 70, 80, 70, 60, 50, 45];
    for (const yaw of path) {
      const quality = qualityAlongYawCurve(yaw, 45, sharp);
      best = updatePersonalBest(best, {
        yaw,
        pitch: 0,
        roll: 0,
        quality,
        side: "rightEar",
      });
    }
    expect(best?.yaw).toBe(45);

    const at45 = evaluateGuidance(
      base({ yaw: 45, quality: qualityAlongYawCurve(45, 45, sharp) }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(at45.prompt).toBe("READY");
    expect(at45.allowCapture).toBe(true);

    const at80 = evaluateGuidance(
      base({ yaw: 80, quality: qualityAlongYawCurve(80, 45, sharp) }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(at80.allowCapture).toBe(false);
    expect(at80.prompt).not.toBe("READY");
  });

  it("left-ear path peaking at −45° can READY", () => {
    let best: PeakSample | null = null;
    for (const yaw of [-20, -35, -45, -60, -80, -45]) {
      best = updatePersonalBest(best, {
        yaw,
        pitch: 0,
        roll: 0,
        quality: qualityAlongYawCurve(yaw, -45, sharp),
        side: "leftEar",
      });
    }
    expect(best?.yaw).toBe(-45);
    const r = evaluateGuidance(
      base({ yaw: -45, quality: sharp }),
      poseConfig,
      "leftEar",
      best,
      12,
    );
    expect(r.prompt).toBe("READY");
  });

  it("collapsing quality near the peak is not READY", () => {
    const best = { yaw: 45, score: sharpScore };
    const weak = { laplacian: 110, brightness: 120, edgeEnergy: 16 };
    expect(frontalQualityScore(weak)).toBeLessThan(
      sharpScore * poseConfig.personalBest.qualityCollapseRatio,
    );
    const r = evaluateGuidance(
      base({ yaw: 45, quality: weak }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(r.allowCapture).toBe(false);
    expect(r.prompt).not.toBe("READY");
  });

  it("prior center stays ~80 until a peak is locked; 45 is not clamped away", () => {
    const prior = effectiveTargets("rightEar", null, poseConfig);
    expect(prior.yawCenter).toBe(80);
    expect(prior.locked).toBe(false);
    const personal = effectiveTargets("rightEar", peakAt(45), poseConfig);
    expect(personal.yawCenter).toBe(45);
    expect(personal.locked).toBe(true);
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
