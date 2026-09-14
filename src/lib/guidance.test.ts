import { describe, expect, it } from "vitest";
import { poseConfig } from "../config";
import { evaluateGuidance, promptForDisplay } from "./guidance";
import { dwellMsFor, dwellPrompt, INITIAL_DWELL } from "./dwell";
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

describe("pickPrompt priority", () => {
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

  it("SLOW_DOWN when yaw jumps while still hunting", () => {
    expect(
      evaluateGuidance(
        base({ yaw: 20 }),
        poseConfig,
        "rightEar",
        null,
        0,
        { yawDelta: 20 },
      ).prompt,
    ).toBe("SLOW_DOWN");
  });

  it("CLEAR_HAIR then TOO_DARK only once near the personal peak", () => {
    const best = peakAt(60);
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

  it("NEAR_PEAK until stable frames, then READY near a locked peak", () => {
    const best = peakAt(60);
    const hold = evaluateGuidance(base(), poseConfig, "rightEar", best, 3);
    expect(hold.prompt).toBe("NEAR_PEAK");
    expect(hold.allowCapture).toBe(false);
    const ready = evaluateGuidance(base(), poseConfig, "rightEar", best, 12);
    expect(ready.prompt).toBe("READY");
    expect(ready.allowCapture).toBe(true);
  });

  it("cold start (unlocked) cannot capture and only sweeps", () => {
    const r = evaluateGuidance(base({ yaw: 0 }), poseConfig, "rightEar", null, 12);
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
      12,
    );
    expect(r.targets.locked).toBe(true);
    expect(r.targets.bestYaw).toBe(45);
    expect(Math.abs(45 - 80)).toBeGreaterThan(5);
    expect(r.prompt).toBe("READY");
    expect(r.allowCapture).toBe(true);
    expect(r.poseReady).toBe(true);
  });

  it("yaw at 80 with ok quality is not READY without a locked personal best", () => {
    const r = evaluateGuidance(base({ yaw: 80 }), poseConfig, "rightEar", null, 12);
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
      12,
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

  it("score must stay near the personal peak to READY", () => {
    const best = peakAt(45);
    const weak = { laplacian: 90, brightness: 120, edgeEnergy: 16 };
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

  it("±5° ready band: 51° is too far from a 45° peak", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ yaw: 51, quality: sharp }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(r.allowCapture).toBe(false);
    expect(r.poseReady).toBe(false);
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
      12,
      { softPeak: true },
    );
    expect(soft.allowCapture).toBe(true);
    expect(soft.prompt).toBe("SOFT_READY");
    const ready = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(ready.prompt).toBe("READY");
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
      { yawDelta: 50 }, // 20° → 70° in one frame
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
      { yawDelta: 0 },
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
