import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EarCaptureApp } from "../components/EarCaptureApp";
import { poseConfig } from "../config";
import {
  captureHintKey,
  captureUiFor,
  evaluateGuidance,
  evaluateCaptureConditions,
  promptForDisplay,
} from "./guidance";
import { dwellMsFor, dwellPrompt, INITIAL_DWELL } from "./dwell";
import { effectiveTargets } from "./effective-targets";
import {
  createPeakMemory,
  qualityNearPeak,
  settlePersonalBest,
  updatePersonalBest,
  yawInSearchWindow,
  type PeakMemory,
  type PeakSample,
} from "./personal-best";
import {
  frontalQualityScore,
  measureEarQuality,
  qualityAlongYawCurve,
} from "./quality";
import type { GuidanceInput } from "./guidance";
import type { EarQuality } from "./types";

const cameraFixture = vi.hoisted(() => ({
  visible: true,
  faceCount: 1,
  heightRatio: 0.4,
  presence: 1,
  tracking: 1,
  reportScores: true,
  roiShortEdge: 100,
  yaw: 45,
  quality: { laplacian: 180, brightness: 120, edgeEnergy: 40 },
  videoRef: { current: null as HTMLVideoElement | null },
}));

vi.mock("../hooks/useWebcam", () => ({
  useWebcam: () => ({
    videoRef: cameraFixture.videoRef, ready: true, error: null,
    start: () => Promise.resolve(), stop: () => {},
  }),
}));
vi.mock("../hooks/useFaceLandmarker", () => {
  const landmarker = {
    detectForVideo: () => ({
      faceLandmarks: Array.from({ length: cameraFixture.faceCount }, () =>
        [cameraFixture.reportScores ? { presence: cameraFixture.presence,
          visibility: cameraFixture.tracking } : {}]),
      facialTransformationMatrixes: [{ data: Array.from({ length: 16 }, (_, i) => i % 5 === 0 ? 1 : 0) }],
    }),
  };
  return { useFaceLandmarker: () => ({ landmarker, error: null, loading: false }) };
});
vi.mock("./euler", () => ({
  matrixToFiswgEuler: () => ({ yaw: cameraFixture.yaw, pitch: 0, roll: 0 }),
}));
vi.mock("./landmarks", () => ({
  earRoiLayout: () => ({ roi: { x: 10, y: 10, w: cameraFixture.roiShortEdge, h: 150 }, visibleRatio: 1 }),
  earInFrame: () => cameraFixture.visible,
  faceHeightRatio: () => cameraFixture.heightRatio,
  meanPresence: () => cameraFixture.presence,
  meanVisibility: () => cameraFixture.tracking,
}));
vi.mock("./quality", async (importOriginal) => ({
  ...await importOriginal<typeof import("./quality")>(),
  measureEarQuality: vi.fn(() => cameraFixture.quality),
}));
vi.mock("../i18n", () => ({
  useLocale: () => ({ locale: "zh", setLocale: () => {}, t: (key: string) => key }),
}));

const sharp: EarQuality = {
  laplacian: 180,
  brightness: 120,
  edgeEnergy: 40,
};

function peakAt(yaw: number, quality: EarQuality = sharp): PeakSample {
  return { yaw, score: frontalQualityScore(quality, yaw) };
}

function base(over: Partial<GuidanceInput> = {}): GuidanceInput {
  return {
    hasFace: true,
    facePresence: 0.9,
    trackingConfidence: 0.9,
    faceHeightRatio: 0.4,
    yaw: 60,
    pitch: 0,
    roll: 0,
    quality: sharp,
    ...over,
  };
}

describe("capture evidence and algorithm disagreement", () => {
  const camera = { source: "camera" as const, earInFrame: true,
    roiShortEdgePx: 100, timestampMs: 250 };

  it("keeps unavailable model scores unknown without inventing confidence", () => {
    const result = evaluateCaptureConditions(base({ facePresence: null,
      trackingConfidence: null }), poseConfig, camera);
    expect(result.eligible).toBe(true);
    expect(result.evidence.presence.state).toBe("UNKNOWN");
    expect(result.evidence.confidence.reliability).toBe("unavailable");
    expect(result.evidence.earVisibility.state).toBe("UNKNOWN");
    expect(result.sampledAtMs).toBe(250);
  });

  it.each([0, NaN, Infinity, -0.2, 1.2])("rejects reported invalid/low confidence %s", (score) => {
    expect(evaluateCaptureConditions(base({ facePresence: score }), poseConfig, camera)
      .eligible).toBe(false);
  });

  it.each([0.1, 0.9])("does not let coarse face size %s overrule usable native pixels", (ratio) => {
    const result = evaluateCaptureConditions(base({ faceHeightRatio: ratio }), poseConfig, camera);
    expect(result.eligible).toBe(true);
    expect(result.evidence.distance.state).toBe("FAIL");
    expect(result.evidence.distance.required).toBe(false);
  });

  it.each([
    [{ ...camera, earInFrame: false }, "EAR_OUT_OF_FRAME"],
    [{ ...camera, roiShortEdgePx: 20 }, "TOO_FAR"],
    [{ ...camera, roiShortEdgePx: undefined }, "CHECK_EAR"],
    [{ ...camera, earInFrame: undefined }, "CHECK_EAR"],
  ])("optical score cannot compensate for missing geometry", (context, reason) => {
    const result = evaluateCaptureConditions(base(), poseConfig, context);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(reason);
  });

  it("rejects a sharp border when the ROI center is blurred", () => {
    const result = evaluateCaptureConditions(base({ quality: { ...sharp,
      centerSharpness: 0, borderSharpness: 900 } }), poseConfig, camera);
    expect(result.reason).toBe("BLURRY_EAR");
  });

  it.each([
    [{ ...sharp, edgeEnergy: 0 }, "CHECK_EAR"],
    [{ ...sharp, brightness: 20 }, "TOO_DARK"],
    [{ ...sharp, brightness: 250 }, "TOO_BRIGHT"],
    [{ ...sharp, laplacian: NaN }, "CHECK_EAR"],
    [null, "CHECK_EAR"],
  ])("quality failures retain their actual reason", (quality, reason) => {
    const result = evaluateCaptureConditions(base({ quality }), poseConfig, camera);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(reason);
  });

  it("never uses an invalid pose as a valid tracking result", () => {
    expect(evaluateCaptureConditions(base({ yaw: NaN }), poseConfig, camera).eligible).toBe(false);
  });
});

describe("pickPrompt priority", () => {
  it.each([
    [{ ...sharp, brightness: 20 }, "TOO_DARK"],
    [{ ...sharp, brightness: 250 }, "TOO_BRIGHT"],
    [{ ...sharp, laplacian: 0 }, "BLURRY_EAR"],
    [{ ...sharp, edgeEnergy: 0 }, "CHECK_EAR"],
  ])("explains a cold-start quality failure in the observable ear range", (quality, prompt) => {
    const result = evaluateGuidance(base({ yaw: 45, quality }), poseConfig, "rightEar", null, 0);
    expect(result.prompt).toBe(prompt);
    expect(result.captureEligible).toBe(false);
  });

  it("asks to slow down when blur has current motion evidence", () => {
    const result = evaluateGuidance(base({ yaw: 45, quality: { ...sharp, laplacian: 0 } }),
      poseConfig, "rightEar", peakAt(45), 0,
      { angularVelocityDegPerSec: { yaw: 10, pitch: 0, roll: 0 } });
    expect(result.prompt).toBe("SLOW_DOWN");
  });
  it("NO_FACE when missing", () => {
    const r = evaluateGuidance(base({ hasFace: false }), poseConfig, "rightEar", null, 0);
    expect(r.prompt).toBe("NO_FACE");
    expect(r.allowCapture).toBe(false);
  });

  it("MULTI_FACE when more than one face is tracked", () => {
    expect(
      evaluateGuidance(base({ faceCount: 2, yaw: 60 }), poseConfig, "rightEar", null, 0)
        .prompt,
    ).toBe("MULTI_FACE");
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

  it("severe roll interrupts even while far from yaw", () => {
    const r = evaluateGuidance(
      base({ roll: 22, pitch: 20, yaw: 0 }),
      poseConfig,
      "rightEar",
      null,
      0,
    );
    expect(r.prompt).toBe("FIX_ROLL");
  });

  it("mild roll while far away does not preempt the sweep", () => {
    expect(
      evaluateGuidance(base({ roll: 14, yaw: 0 }), poseConfig, "rightEar", null, 0)
        .prompt,
    ).toBe("SWEEP_RIGHT_EAR");
  });

  it("PITCH_DOWN / PITCH_UP when already close on yaw", () => {
    expect(
      evaluateGuidance(base({ pitch: 15, yaw: 60 }), poseConfig, "rightEar", null, 0)
        .prompt,
    ).toBe("PITCH_DOWN");
    expect(
      evaluateGuidance(base({ pitch: -15, yaw: 60 }), poseConfig, "rightEar", null, 0)
        .prompt,
    ).toBe("PITCH_UP");
  });

  it("right-ear sweep stays on SWEEP until a peak is locked (no prior TURN_MORE / TURN_BACK)", () => {
    expect(
      evaluateGuidance(base({ yaw: 20 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      evaluateGuidance(base({ yaw: 45 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      evaluateGuidance(base({ yaw: 75 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      evaluateGuidance(base({ yaw: 90 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("TURN_BACK_OVERSHOOT");
  });

  it("left-ear sweep (mirrored) stays on SWEEP until a peak is locked", () => {
    expect(
      evaluateGuidance(base({ yaw: -20 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("SWEEP_LEFT_EAR");
    expect(
      evaluateGuidance(base({ yaw: -45 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("SWEEP_LEFT_EAR");
    expect(
      evaluateGuidance(base({ yaw: -90 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("TURN_BACK_OVERSHOOT");
  });

  it("WRONG_SIDE if turning the opposite way", () => {
    expect(
      evaluateGuidance(base({ yaw: -20 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("WRONG_SIDE");
  });

  it("SLOW_DOWN uses degrees per second while hunting", () => {
    expect(
      evaluateGuidance(
        base({ yaw: 20 }),
        poseConfig,
        "rightEar",
        null,
        0,
        { angularVelocityDegPerSec: { yaw: 60, pitch: 0, roll: 0 } },
      ).prompt,
    ).toBe("SLOW_DOWN");
  });

  it("distinguishes blur from lighting without claiming hair obstruction", () => {
    const best = peakAt(60);
    expect(
      evaluateGuidance(
        base({ quality: { laplacian: 10, brightness: 120, edgeEnergy: 40 } }),
        poseConfig,
        "rightEar",
        best,
        0,
      ).prompt,
    ).toBe("BLURRY_EAR");
    expect(
      evaluateGuidance(
        base({ quality: { laplacian: 180, brightness: 20, edgeEnergy: 40 } }),
        poseConfig,
        "rightEar",
        best,
        0,
      ).prompt,
    ).toBe("TOO_DARK");
  });

  it("does not nag hair while still far from the peak", () => {
    const best = peakAt(45);
    expect(
      evaluateGuidance(
        base({
          yaw: 15,
          quality: { laplacian: 10, brightness: 120, edgeEnergy: 4 },
        }),
        poseConfig,
        "rightEar",
        best,
        0,
      ).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
  });

  it("NEAR_PEAK until stable time, then READY near a locked peak", () => {
    const best = peakAt(60);
    const hold = evaluateGuidance(base(), poseConfig, "rightEar", best, 3);
    expect(hold.prompt).toBe("NEAR_PEAK");
    expect(hold.allowCapture).toBe(false);
    const ready = evaluateGuidance(base(), poseConfig, "rightEar", best, poseConfig.captureConditions.stableMs);
    expect(ready.prompt).toBe("READY");
    expect(ready.allowCapture).toBe(true);
  });

  it("cold start (unlocked) cannot capture and only sweeps", () => {
    const r = evaluateGuidance(base({ yaw: 0 }), poseConfig, "rightEar", null, poseConfig.captureConditions.stableMs);
    expect(r.allowCapture).toBe(false);
    expect(r.targets.locked).toBe(false);
    expect(r.prompt).toBe("SWEEP_RIGHT_EAR");
    expect(r.prompt).not.toBe("READY");
    expect(r.prompt).not.toBe("HOLD_STILL");
    expect(r.prompt).not.toBe("TURN_MORE");
    expect(r.prompt).not.toBe("TURN_BACK");
  });

  it("unlocked never steers TURN_MORE / TURN_BACK against the prior", () => {
    for (const yaw of [0, 20, 45, 60, 75, 80]) {
      const p = evaluateGuidance(base({ yaw }), poseConfig, "rightEar", null, 0)
        .prompt;
      expect(p).not.toBe("TURN_MORE");
      expect(p).not.toBe("TURN_BACK");
    }
  });

  it("TURN_BACK only after a peak is locked", () => {
    expect(
      evaluateGuidance(base({ yaw: 80 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      evaluateGuidance(base({ yaw: 80 }), poseConfig, "rightEar", peakAt(45), 0)
        .prompt,
    ).toBe("TURN_BACK");
  });

  it("never returns HOLD_STILL while capture is blocked", () => {
    const unlocked = evaluateGuidance(base({ yaw: 60 }), poseConfig, "rightEar", null, 3);
    const near = evaluateGuidance(base(), poseConfig, "rightEar", peakAt(60), 3);
    expect(unlocked.allowCapture).toBe(false);
    expect(near.allowCapture).toBe(false);
    expect(unlocked.prompt).not.toBe("HOLD_STILL");
    expect(near.prompt).not.toBe("HOLD_STILL");
    expect(near.prompt).toBe("NEAR_PEAK");
  });

  it("promptForDisplay never shows READY on a gray shutter", () => {
    expect(promptForDisplay("READY", false)).toBe("NEAR_PEAK");
    expect(promptForDisplay("HOLD_STILL", false)).toBe("NEAR_PEAK");
    expect(promptForDisplay("SOFT_READY", false)).toBe("NEAR_PEAK");
    expect(promptForDisplay("READY", true)).toBe("READY");
    expect(promptForDisplay("SOFT_READY", true)).toBe("SOFT_READY");
    expect(promptForDisplay("SWEEP_RIGHT_EAR", false)).toBe("SWEEP_RIGHT_EAR");
  });

  it("left/right modes change copy at the same physical yaw=0", () => {
    const left = evaluateGuidance(base({ yaw: 0 }), poseConfig, "leftEar", null, 0);
    const right = evaluateGuidance(base({ yaw: 0 }), poseConfig, "rightEar", null, 0);
    expect(left.prompt).toBe("SWEEP_LEFT_EAR");
    expect(right.prompt).toBe("SWEEP_RIGHT_EAR");
  });
});

describe("quality-driven personal best yaw", () => {
  it("search window is |yaw| 35–90 and excludes near-frontal", () => {
    expect(yawInSearchWindow(45, "rightEar")).toBe(true);
    expect(yawInSearchWindow(35, "rightEar")).toBe(true);
    expect(yawInSearchWindow(90, "rightEar")).toBe(true);
    expect(yawInSearchWindow(95, "rightEar")).toBe(false);
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
  });

  it("near-tie prefers the smaller |yaw| (45° over 80°)", () => {
    const even: EarQuality = { laplacian: 160, brightness: 120, edgeEnergy: 40 };
    let best = updatePersonalBest(null, {
      yaw: 80,
      pitch: 0,
      roll: 0,
      quality: even,
      side: "rightEar",
    });
    best = updatePersonalBest(best, {
      yaw: 45,
      pitch: 0,
      roll: 0,
      quality: even,
      side: "rightEar",
    });
    expect(best?.yaw).toBe(45);
  });

  it("ignores a higher score when pitch/roll are out of search range", () => {
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
      poseConfig.captureConditions.stableMs,
    );
    expect(r.targets.locked).toBe(true);
    expect(r.targets.bestYaw).toBe(45);
    expect(Math.abs(45 - 80)).toBeGreaterThan(5);
    expect(r.prompt).toBe("READY");
    expect(r.allowCapture).toBe(true);
    expect(r.poseReady).toBe(true);
  });

  it("yaw at 80 with ok quality is not READY without a locked personal best", () => {
    const r = evaluateGuidance(base({ yaw: 80 }), poseConfig, "rightEar", null, poseConfig.captureConditions.stableMs);
    expect(r.allowCapture).toBe(false);
    expect(r.prompt).not.toBe("READY");
    expect(r.poseReady).toBe(false);
  });

  it("yaw=80 is not READY when the personal peak is 45°", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ yaw: 80, quality: sharp }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
    );
    expect(r.allowCapture).toBe(false);
    expect(r.prompt).toBe("TURN_BACK");
  });

  it("guides toward the personal best, not a 70–90 band", () => {
    const best = peakAt(45);
    expect(
      evaluateGuidance(base({ yaw: 15 }), poseConfig, "rightEar", best, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      evaluateGuidance(base({ yaw: 28 }), poseConfig, "rightEar", best, 0).prompt,
    ).toBe("TURN_MORE");
    expect(
      evaluateGuidance(base({ yaw: 70 }), poseConfig, "rightEar", best, 0).prompt,
    ).toBe("TURN_BACK");
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
      poseConfig.captureConditions.stableMs,
    );
    expect(at45.prompt).toBe("READY");
    expect(at45.allowCapture).toBe(true);

    const at80 = evaluateGuidance(
      base({ yaw: 80, quality: qualityAlongYawCurve(80, 45, sharp) }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
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
      poseConfig.captureConditions.stableMs,
    );
    expect(r.prompt).toBe("READY");
  });

  it("score must stay near the personal peak to READY", () => {
    const best = peakAt(45);
    const weak = { laplacian: 90, brightness: 120, edgeEnergy: 16 };
    const r = evaluateGuidance(
      base({ yaw: 45, quality: weak }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
    );
    expect(r.allowCapture).toBe(false);
    expect(r.prompt).not.toBe("READY");
  });

  it("±5° ready band: 51° is too far from a 45° peak", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ yaw: 51, quality: sharp }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
    );
    expect(r.allowCapture).toBe(false);
    expect(r.poseReady).toBe(false);
  });

  it("exitBandDeg hysteresis: 51° stays READY after entering at 45°", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ yaw: 51, quality: sharp }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
      { wasReady: true },
    );
    expect(r.poseReady).toBe(true);
    expect(r.allowCapture).toBe(true);
    expect(r.prompt).toBe("READY");
  });

  it("locked overshoot past bestYaw with a score drop is TURN_BACK_OVERSHOOT", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ yaw: 80, quality: qualityAlongYawCurve(80, 45, sharp) }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
    );
    expect(r.allowCapture).toBe(false);
    expect(r.prompt).toBe("TURN_BACK_OVERSHOOT");
    expect(r.prompt).not.toBe("TURN_MORE");
  });

  it("returning toward bestYaw is HOLD (NEAR_PEAK), not TURN_MORE", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ yaw: 60, quality: qualityAlongYawCurve(60, 45, sharp) }),
      poseConfig,
      "rightEar",
      best,
      0,
      { angularVelocityDegPerSec: { yaw: -10, pitch: 0, roll: 0 } },
    );
    expect(r.prompt).toBe("NEAR_PEAK");
    expect(r.prompt).not.toBe("TURN_MORE");
    expect(r.allowCapture).toBe(false);
  });

  it("fast-turn frames do not update bestYaw even if quality looks easy", () => {
    const easy: EarQuality = { laplacian: 400, brightness: 120, edgeEnergy: 80 };
    const first = updatePersonalBest(null, {
      yaw: 45,
      pitch: 0,
      roll: 0,
      quality: sharp,
      side: "rightEar",
      yawDelta: 0,
    });
    expect(first?.yaw).toBe(45);
    const skipped = updatePersonalBest(first, {
      yaw: 70,
      pitch: 0,
      roll: 0,
      quality: easy,
      side: "rightEar",
      yawDelta: poseConfig.search.slowYawDeltaDeg,
    });
    expect(skipped?.yaw).toBe(45);
    const stillNull = updatePersonalBest(null, {
      yaw: 50,
      pitch: 0,
      roll: 0,
      quality: easy,
      side: "rightEar",
      yawDelta: 20,
    });
    expect(stillNull).toBeNull();
  });

  it("grey capture UI is learning vs hold vs ready; never hold while learning", () => {
    expect(captureUiFor(false, false)).toBe("learning");
    expect(captureUiFor(true, false)).toBe("hold");
    expect(captureUiFor(true, true)).toBe("ready");
    expect(captureHintKey("learning")).toBe("learningNote");
    expect(captureHintKey("hold")).toBe("NEAR_PEAK");
    expect(captureHintKey("hold")).not.toBe("HOLD_STILL");
    expect(captureHintKey("ready")).toBe("READY");
    expect(captureUiFor(true, true, true)).toBe("soft");
    expect(captureHintKey("soft")).toBe("softCaptureHint");
    expect(captureHintKey("soft")).not.toBe("READY");
    const learning = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      null,
      poseConfig.captureConditions.stableMs,
    );
    expect(learning.targets.locked).toBe(false);
    expect(learning.prompt).not.toBe("HOLD_STILL");
    expect(learning.prompt).not.toBe("TURN_MORE");
    expect(learning.prompt).not.toBe("TURN_BACK");
    expect(captureUiFor(learning.targets.locked, learning.allowCapture)).toBe(
      "learning",
    );
    expect(
      captureHintKey(
        captureUiFor(learning.targets.locked, learning.allowCapture),
      ),
    ).not.toBe("HOLD_STILL");
    const near = evaluateGuidance(base(), poseConfig, "rightEar", peakAt(60), 3);
    expect(near.allowCapture).toBe(false);
    expect(
      captureHintKey(captureUiFor(near.targets.locked, near.allowCapture)),
    ).toBe("NEAR_PEAK");
  });

  it("prior is a soft center until a peak is locked; 45 is not refused", () => {
    const prior = effectiveTargets("rightEar", null, poseConfig);
    expect(prior.yawCenter).toBe(poseConfig.search.priorYawAbs);
    expect(prior.locked).toBe(false);
    const personal = effectiveTargets("rightEar", peakAt(45), poseConfig);
    expect(personal.yawCenter).toBe(45);
    expect(personal.locked).toBe(true);
  });

  it("EAR_OUT_OF_FRAME when the ear should be visible but the ROI is clipped", () => {
    const best = peakAt(45);
    expect(
      evaluateGuidance(
        base({ yaw: 45 }),
        poseConfig,
        "rightEar",
        best,
        0,
        { earInFrame: false },
      ).prompt,
    ).toBe("EAR_OUT_OF_FRAME");
    expect(
      evaluateGuidance(
        base({ yaw: 10 }),
        poseConfig,
        "rightEar",
        null,
        0,
        { earInFrame: false },
      ).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
  });

  it("SOFT_READY is distinct from READY when the peak is weak/flat", () => {
    const best = peakAt(45);
    const soft = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
      { softPeak: true },
    );
    expect(soft.allowCapture).toBe(true);
    expect(soft.prompt).toBe("SOFT_READY");
    const ready = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
    );
    expect(ready.prompt).toBe("READY");
  });

  it("previous READY never bypasses the stable-time requirement", () => {
    const best = peakAt(45);
    const held = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      best,
      1,
      { wasCapturable: true },
    );
    expect(held.allowCapture).toBe(false);
    expect(held.prompt).toBe("NEAR_PEAK");
    const cold = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      best,
      1,
    );
    expect(cold.allowCapture).toBe(false);
    const lost = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      best,
      0,
      { wasCapturable: true },
    );
    expect(lost.allowCapture).toBe(false);
    expect(lost.prompt).not.toBe("READY");
  });

  it("holds capture between the exit score ratio and the enter ratio", () => {
    const best = peakAt(45);
    const dipped: EarQuality = {
      laplacian: 110,
      brightness: 120,
      edgeEnergy: 40,
    };
    const ratio = frontalQualityScore(dipped, 45) / (best.score || 1);
    expect(ratio).toBeGreaterThan(poseConfig.ready.scoreRatioExit);
    expect(ratio).toBeLessThan(poseConfig.ready.scoreRatioOfBest);
    const blocked = evaluateGuidance(
      base({ yaw: 45, quality: dipped }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
    );
    expect(blocked.allowCapture).toBe(false);
    const held = evaluateGuidance(
      base({ yaw: 45, quality: dipped }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
      { wasCapturable: true },
    );
    expect(held.allowCapture).toBe(true);
    expect(held.prompt).toBe("READY");
  });

  it("a qualified soft peak remains SOFT_READY after the full stable time", () => {
    const best = peakAt(45);
    const held = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      best,
      poseConfig.captureConditions.stableMs,
      { wasCapturable: true, softPeak: true },
    );
    expect(held.allowCapture).toBe(true);
    expect(held.prompt).toBe("SOFT_READY");
    expect(held.prompt).not.toBe("READY");
  });
});

describe("settled personal peak", () => {
  function sampleAt(timestampMs: number, over = {}) {
    return {
      yaw: 45,
      pitch: 0,
      roll: 0,
      quality: sharp,
      side: "rightEar" as const,
      yawDelta: 0,
      timestampMs,
      ...over,
    };
  }

  function partialCluster() {
    let memory = createPeakMemory();
    for (const timestamp of [0, 100, 200]) {
      memory = settlePersonalBest(null, memory, sampleAt(timestamp)).memory;
    }
    return memory;
  }

  it.each([
    ["wrong side", { yaw: -45 }],
    ["invalid pitch", { pitch: 20 }],
    ["invalid roll", { roll: 20 }],
    ["fast turn", { yawDelta: 30 }],
    ["low score", { quality: { ...sharp, laplacian: 0, edgeEnergy: 0 } }],
    ["blurred but edged ROI", { quality: { ...sharp, laplacian: 0 } }],
    ["sharp but structureless ROI", { quality: { ...sharp, edgeEnergy: 0 } }],
    ["dark frame", { quality: { ...sharp, brightness: 20 } }],
    ["overexposed frame", { quality: { ...sharp, brightness: 240 } }],
    ["non-finite angle", { yaw: Number.NaN }],
    ["non-finite quality", { quality: { ...sharp, laplacian: Number.NaN } }],
    ["non-finite turn delta", { yawDelta: Number.POSITIVE_INFINITY }],
    ["non-finite timestamp", { timestampMs: Number.NaN }],
  ])("starts a new confirmation after a %s", (_name, over) => {
    const confirmed = peakAt(60);
    const rejected = settlePersonalBest(confirmed, partialCluster(), sampleAt(300, over));
    expect(rejected.peak).toBe(confirmed);
    expect(rejected.memory.recent).toHaveLength(0);
    const resumed = settlePersonalBest(null, rejected.memory, sampleAt(400));
    expect(resumed.peak).toBeNull();
    expect(resumed.memory.recent).toHaveLength(1);
  });

  it("does not combine samples across a camera pause", () => {
    const resumed = settlePersonalBest(null, partialCluster(), sampleAt(2_000));
    expect(resumed.peak).toBeNull();
    expect(resumed.memory.recent).toHaveLength(1);
  });

  it("does not count a duplicate timestamp as a new frame", () => {
    const memory = partialCluster();
    const duplicate = settlePersonalBest(null, memory, sampleAt(200));
    expect(duplicate.peak).toBeNull();
    expect(duplicate.memory.recent).toHaveLength(3);
    expect(settlePersonalBest(null, duplicate.memory, sampleAt(300)).peak?.yaw).toBe(45);
  });

  it("starts a new cluster when the sample clock goes backwards", () => {
    const restarted = settlePersonalBest(null, partialCluster(), sampleAt(50));
    expect(restarted.peak).toBeNull();
    expect(restarted.memory.recent).toHaveLength(1);
  });

  it("bounds the total confirmation duration even with regular samples", () => {
    let memory = createPeakMemory();
    let peak: PeakSample | null = null;
    const config = {
      ...poseConfig,
      personalBest: { ...poseConfig.personalBest, confirmFrames: 6 },
    };
    for (const timestamp of [0, 400, 800, 1_200, 1_600, 2_000]) {
      const settled = settlePersonalBest(peak, memory, sampleAt(timestamp), config);
      peak = settled.peak;
      memory = settled.memory;
    }
    expect(peak).toBeNull();
    expect(memory.recent).toHaveLength(4);
  });

  it("still confirms a continuous 45-degree hold at a low sample rate", () => {
    let memory = createPeakMemory();
    let peak: PeakSample | null = null;
    for (const timestamp of [0, 400, 800, 1_200]) {
      const settled = settlePersonalBest(peak, memory, sampleAt(timestamp));
      peak = settled.peak;
      memory = settled.memory;
    }
    expect(peak?.yaw).toBe(45);
  });

  function hold(
    peak: PeakSample | null,
    memory: PeakMemory,
    yaw: number,
    quality: EarQuality,
    frames = poseConfig.personalBest.confirmFrames,
  ) {
    let nextPeak = peak;
    let nextMemory = memory;
    for (let i = 0; i < frames; i++) {
      const settled = settlePersonalBest(nextPeak, nextMemory, {
        yaw,
        pitch: 0,
        roll: 0,
        quality,
        side: "rightEar",
        yawDelta: 0,
      });
      nextPeak = settled.peak;
      nextMemory = settled.memory;
    }
    return { peak: nextPeak, memory: nextMemory };
  }

  it("ignores a one-frame spike that the instant updater would lock", () => {
    const spike: EarQuality = {
      laplacian: 200,
      brightness: 120,
      edgeEnergy: 48,
    };
    const instant = updatePersonalBest(null, {
      yaw: 70,
      pitch: 0,
      roll: 0,
      quality: spike,
      side: "rightEar",
      yawDelta: 0,
    });
    expect(instant?.yaw).toBe(70);
    const settled = settlePersonalBest(null, createPeakMemory(), {
      yaw: 70,
      pitch: 0,
      roll: 0,
      quality: spike,
      side: "rightEar",
      yawDelta: 0,
    });
    expect(settled.peak).toBeNull();
  });

  it("locks the median of a steady cluster and ignores one sharp outlier", () => {
    const steady: EarQuality = {
      laplacian: 140,
      brightness: 120,
      edgeEnergy: 28,
    };
    const spike: EarQuality = {
      laplacian: 400,
      brightness: 120,
      edgeEnergy: 80,
    };
    let peak: PeakSample | null = null;
    let memory = createPeakMemory();
    const yaws = [44, 45, 46, 45];
    const qualities = [steady, steady, spike, steady];
    for (let i = 0; i < yaws.length; i++) {
      const settled = settlePersonalBest(peak, memory, {
        yaw: yaws[i],
        pitch: 0,
        roll: 0,
        quality: qualities[i],
        side: "rightEar",
        yawDelta: 1,
      });
      peak = settled.peak;
      memory = settled.memory;
    }
    expect(peak).not.toBeNull();
    expect(peak!.yaw).toBeGreaterThan(44);
    expect(peak!.yaw).toBeLessThan(47);
    expect(peak!.score).toBeLessThan(frontalQualityScore(spike, 45));
    expect(peak!.score).toBeCloseTo(frontalQualityScore(steady, 45), 1);
  });

  it("lowers an inflated stored score so a good hold can capture again", () => {
    const modest: EarQuality = {
      laplacian: 110,
      brightness: 120,
      edgeEnergy: 40,
    };
    const inflated: PeakSample = { yaw: 45, score: 1 };
    expect(qualityNearPeak(modest, inflated, 45)).toBe(false);
    const settled = hold(inflated, createPeakMemory(), 45, modest);
    expect(settled.peak).not.toBeNull();
    expect(settled.peak!.yaw).toBe(45);
    expect(settled.peak!.score).toBeLessThan(poseConfig.ready.scoreRatioOfBest);
    expect(settled.peak!.score).toBeGreaterThan(
      poseConfig.personalBest.rescoreFloorRatio,
    );
    expect(qualityNearPeak(modest, settled.peak, 45)).toBe(true);
    const ready = evaluateGuidance(
      base({ yaw: 45, quality: modest }),
      poseConfig,
      "rightEar",
      settled.peak,
      poseConfig.captureConditions.stableMs,
    );
    expect(ready.allowCapture).toBe(true);
    expect(ready.prompt).toBe("READY");
  });

  it("does not deflate a real peak down to a much worse cluster", () => {
    const weak: EarQuality = {
      laplacian: 100,
      brightness: 120,
      edgeEnergy: 20,
    };
    const inflated: PeakSample = { yaw: 45, score: 1 };
    const settled = hold(inflated, createPeakMemory(), 45, weak);
    expect(settled.peak?.score).toBe(1);
    expect(qualityNearPeak(weak, settled.peak, 45)).toBe(false);
  });

  it("still prefers a steady smaller-abs tie over a far equally sharp angle", () => {
    const even: EarQuality = {
      laplacian: 160,
      brightness: 120,
      edgeEnergy: 40,
    };
    const far = hold(null, createPeakMemory(), 80, even);
    expect(far.peak?.yaw).toBe(80);
    const nearer = hold(far.peak, createPeakMemory(), 45, even);
    expect(nearer.peak?.yaw).toBe(45);
  });
});

describe("camera peak learning and capture", () => {
  let container: HTMLDivElement;
  let root: Root;
  let nextFrame: FrameRequestCallback | null;
  let now: number;
  let videoTime: number;
  let cameraReady: number;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("auto-ear-detect:chosen-side:v1", "rightEar");
    Object.assign(cameraFixture, {
      visible: true, faceCount: 1, heightRatio: 0.4, presence: 1, tracking: 1,
      reportScores: true, roiShortEdge: 100, yaw: 45,
      quality: { ...sharp },
    });
    vi.mocked(measureEarQuality).mockClear();
    now = 0;
    videoTime = 0;
    cameraReady = 2;
    nextFrame = null;
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextFrame = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => { nextFrame = null; });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const context = new Proxy({
      getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
      measureText: () => ({ width: 100 }),
    }, {
      get: (target, key) => key in target
        ? Reflect.get(target, key)
        : () => {},
    }) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,dGVzdA==");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(createElement(EarCaptureApp)));
    const video = cameraFixture.videoRef.current!;
    Object.defineProperties(video, {
      readyState: { configurable: true, get: () => cameraReady },
      videoWidth: { configurable: true, value: 640 },
      videoHeight: { configurable: true, value: 480 },
      currentTime: { configurable: true, get: () => videoTime },
    });
    // Warm up motion while quality is ineligible; this must not learn a peak
    // or earn any stable-time credit.
    cameraFixture.quality.laplacian = 0;
    for (let i = 0; i < 6; i++) frame();
    cameraFixture.quality = { ...sharp };
    vi.mocked(measureEarQuality).mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function frame(gapMs = 33) {
    now += gapMs;
    videoTime += gapMs / 1_000;
    const callback = nextFrame;
    expect(callback).not.toBeNull();
    act(() => callback!(now));
  }

  function captureButton() {
    return container.querySelector<HTMLButtonElement>("button.capture")!;
  }

  function reachReady() {
    for (let i = 0; i < 65 && captureButton().disabled; i++) frame();
    expect(captureButton().disabled).toBe(false);
  }

  it.each([
    ["clipped ROI", () => { cameraFixture.visible = false; }],
    ["multiple returned faces", () => { cameraFixture.faceCount = 2; }],
    ["insufficient native ROI pixels", () => { cameraFixture.roiShortEdge = 20; }],
    ["low presence", () => { cameraFixture.presence = 0.1; }],
    ["low tracking", () => { cameraFixture.tracking = 0.1; }],
    ["dark ROI", () => { cameraFixture.quality.brightness = 20; }],
    ["blurred ROI with clear edges", () => { cameraFixture.quality.laplacian = 0; }],
    ["sharp ROI without structure", () => { cameraFixture.quality.edgeEnergy = 0; }],
  ])("does not learn across a %s", (_name, interrupt) => {
    for (let i = 0; i < 3; i++) frame();
    interrupt();
    frame();
    Object.assign(cameraFixture, {
      visible: true, faceCount: 1, heightRatio: 0.4, presence: 1, tracking: 1,
      reportScores: true, roiShortEdge: 100, yaw: 45,
      quality: { ...sharp },
    });
    frame();
    expect(container.querySelector(".calib-note")?.textContent).toBe("learningNote");
    expect(localStorage.getItem("auto-ear-detect:best-yaw:v1")).toBeNull();
    for (let i = 0; i < 3; i++) frame();
    const peaks = JSON.parse(localStorage.getItem("auto-ear-detect:best-yaw:v1")!);
    expect(peaks.rightEar.yaw).toBe(45);
  });

  it("restarts confirmation after a gap in actual camera frames", () => {
    for (let i = 0; i < 3; i++) frame();
    frame(2_000);
    expect(container.querySelector(".calib-note")?.textContent).toBe("learningNote");
    expect(localStorage.getItem("auto-ear-detect:best-yaw:v1")).toBeNull();
  });

  it("does not manufacture a simulator image when the real camera stops", () => {
    reachReady();
    cameraReady = 0;
    act(() => captureButton().click());
    expect(container.querySelector(".preview img")).toBeNull();
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
  });

  it("rejects a stale ready candidate before the next camera callback", () => {
    reachReady();
    now += 2_000;
    act(() => captureButton().click());
    expect(container.querySelector(".preview img")).toBeNull();
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
  });

  it("requires a new complete hold after blurred frames recover", () => {
    reachReady();
    cameraFixture.quality.laplacian = 0;
    for (let i = 0; i < 30; i++) frame();
    cameraFixture.quality = { ...sharp };
    frame();
    expect(captureButton().disabled).toBe(true);
    for (let i = 0; i < 10; i++) frame();
    expect(captureButton().disabled).toBe(true);
    reachReady();
  });

  it("invalidates READY on a frozen video without resampling the frozen pixels", () => {
    reachReady();
    const measured = vi.mocked(measureEarQuality).mock.calls.length;
    for (let i = 0; i < 3; i++) {
      now += 600;
      const callback = nextFrame!;
      act(() => callback(now));
    }
    expect(captureButton().disabled).toBe(true);
    expect(measureEarQuality).toHaveBeenCalledTimes(measured);
    frame();
    expect(captureButton().disabled).toBe(true);
  });

  it("accepts geometric tracking when scores are genuinely absent", () => {
    cameraFixture.reportScores = false;
    reachReady();
  });

  it("does not treat protobuf default-zero visibility as a reported confidence", () => {
    cameraFixture.tracking = 0;
    reachReady();
  });

  it.each([0.1, 0.9])("uses native ROI evidence with a coarse face ratio of %s", (ratio) => {
    cameraFixture.heightRatio = ratio;
    reachReady();
  });

  it("immediately invalidates the shutter when the camera is explicitly closed", () => {
    reachReady();
    const close = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "closeCamera")!;
    act(() => close.click());
    expect(captureButton().disabled).toBe(true);
  });

  it("isolates simulator timing and peaks from the real camera", () => {
    reachReady();
    const saved = localStorage.getItem("auto-ear-detect:best-yaw:v1");
    const toggle = container.querySelector<HTMLInputElement>("details.sim input[type=checkbox]")!;
    act(() => toggle.click());
    expect(captureButton().disabled).toBe(true);
    expect(container.querySelector(".calib-note")?.textContent).toBe("learningNote");
    for (let i = 0; i < 12; i++) frame();
    expect(localStorage.getItem("auto-ear-detect:best-yaw:v1")).toBe(saved);
    act(() => toggle.click());
    expect(captureButton().disabled).toBe(true);
    expect(localStorage.getItem("auto-ear-detect:best-yaw:v1")).toBe(saved);
    reachReady();
  });

  it("auto-captures the validated burst without remeasuring with stale pose", () => {
    let frames = 0;
    while (!container.querySelector(".preview img") && frames < 150) {
      frame();
      frames++;
    }
    expect(container.querySelector(".preview img")).not.toBeNull();
    expect(measureEarQuality).toHaveBeenCalledTimes(frames);
    const retake = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "retake")!;
    act(() => retake.click());
    expect(container.querySelector(".preview img")).toBeNull();
    expect(captureButton().disabled).toBe(true);
    reachReady();
  });
});

describe("prompt dwell", () => {
  it("shows first prompt immediately, then waits 400ms", () => {
    const a = dwellPrompt(INITIAL_DWELL, "NO_FACE", 0, 400);
    expect(a.displayed).toBe("NO_FACE");
    const b = dwellPrompt(a, "SWEEP_RIGHT_EAR", 100, 400);
    expect(b.displayed).toBe("NO_FACE");
    const c = dwellPrompt(b, "SWEEP_RIGHT_EAR", 500, 400);
    expect(c.displayed).toBe("SWEEP_RIGHT_EAR");
  });

  it("promotes READY faster than cross-family switches", () => {
    const ux = poseConfig.promptUx;
    expect(dwellMsFor("TURN_MORE", "READY", ux)).toBe(ux.readyPromoteMs);
    expect(dwellMsFor("TURN_MORE", "SOFT_READY", ux)).toBe(ux.readyPromoteMs);
    expect(dwellMsFor("TURN_MORE", "STUCK_NO_PROGRESS", ux)).toBe(
      ux.readyPromoteMs,
    );
    expect(dwellMsFor("TURN_MORE", "TURN_BACK", ux)).toBe(ux.minDwellMs);
    expect(dwellMsFor("NO_FACE", "TURN_MORE", ux)).toBe(ux.crossFamilyDwellMs);
  });

  it("SLOW_DOWN preempts SWEEP/TURN_MORE dwell, not TURN_BACK or NEAR_PEAK", () => {
    const ux = poseConfig.promptUx;
    expect(dwellMsFor("SWEEP_RIGHT_EAR", "SLOW_DOWN", ux)).toBe(
      ux.slowDownPreemptMs,
    );
    expect(dwellMsFor("SWEEP_LEFT_EAR", "SLOW_DOWN", ux)).toBe(
      ux.slowDownPreemptMs,
    );
    expect(dwellMsFor("TURN_MORE", "SLOW_DOWN", ux)).toBe(ux.slowDownPreemptMs);
    expect(dwellMsFor("TURN_BACK", "SLOW_DOWN", ux)).toBe(ux.minDwellMs);
    expect(dwellMsFor("TURN_BACK_OVERSHOOT", "SLOW_DOWN", ux)).toBe(
      ux.minDwellMs,
    );
    expect(dwellMsFor("NEAR_PEAK", "SLOW_DOWN", ux)).toBe(ux.crossFamilyDwellMs);
    // Yield back to SWEEP on the short promote window, not yaw-family minDwell.
    expect(dwellMsFor("SLOW_DOWN", "SWEEP_RIGHT_EAR", ux)).toBe(ux.slowDownHoldMs);
    expect(dwellMsFor("SLOW_DOWN", "SWEEP_LEFT_EAR", ux)).toBe(ux.slowDownHoldMs);
    expect(dwellMsFor("SLOW_DOWN", "TURN_MORE", ux)).toBe(ux.slowDownHoldMs);
    expect(dwellMsFor("SLOW_DOWN", "SWEEP_RIGHT_EAR", ux)).toBeLessThan(
      ux.minDwellMs,
    );
    expect(ux.slowDownHoldMs).toBeLessThan(ux.minDwellMs);
    expect(dwellMsFor("SLOW_DOWN", "TURN_BACK", ux)).toBe(ux.minDwellMs);
  });

  it("large per-frame Δyaw surfaces SLOW_DOWN despite active SWEEP dwell", () => {
    const ux = poseConfig.promptUx;
    // Unlocked hunt: SWEEP is on screen and still inside its dwell window.
    let dwell = dwellPrompt(INITIAL_DWELL, "SWEEP_RIGHT_EAR", 0, ux);
    dwell = dwellPrompt(dwell, "SWEEP_RIGHT_EAR", 200, ux);
    expect(dwell.displayed).toBe("SWEEP_RIGHT_EAR");

    const jumped = evaluateGuidance(
      base({ yaw: 70 }),
      poseConfig,
      "rightEar",
      null,
      0,
      { angularVelocityDegPerSec: { yaw: 50, pitch: 0, roll: 0 } }, // 20° → 70° in one frame
    );
    expect(jumped.prompt).toBe("SLOW_DOWN");
    expect(jumped.allowCapture).toBe(false);
    expect(jumped.targets.locked).toBe(false);

    dwell = dwellPrompt(dwell, jumped.prompt, 216, ux);
    expect(dwell.displayed).toBe("SLOW_DOWN");

    // Next frame Δyaw settles; SWEEP is picked again. SLOW_DOWN may stay for
    // the short promote window, then must yield — not a full yaw-family dwell.
    const settled = evaluateGuidance(
      base({ yaw: 70 }),
      poseConfig,
      "rightEar",
      null,
      0,
      { angularVelocityDegPerSec: { yaw: 0, pitch: 0, roll: 0 } },
    );
    expect(settled.prompt).toBe("SWEEP_RIGHT_EAR");
    dwell = dwellPrompt(dwell, settled.prompt, 250, ux);
    expect(dwell.displayed).toBe("SLOW_DOWN");
    expect(settled.allowCapture).toBe(false);

    const holdUntil = 250 + ux.slowDownHoldMs;
    dwell = dwellPrompt(dwell, settled.prompt, holdUntil - 1, ux);
    expect(dwell.displayed).toBe("SLOW_DOWN");
    dwell = dwellPrompt(dwell, settled.prompt, holdUntil, ux);
    expect(dwell.displayed).toBe("SWEEP_RIGHT_EAR");
    // Old same-family minDwell (400ms from candidate start at 250) would still
    // be holding SLOW_DOWN here; the short window must already have yielded.
    expect(holdUntil).toBeLessThan(250 + ux.minDwellMs);
  });
});
