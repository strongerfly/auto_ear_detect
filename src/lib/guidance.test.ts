import { describe, expect, it } from "vitest";
import { poseConfig } from "../config";
import { evaluateGuidance, isAngleStable } from "./guidance";
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

  it("near a locked peak, roll beats pitch, pitch beats yaw", () => {
    const best = peakAt(45);
    expect(
      evaluateGuidance(
        base({ yaw: 45, roll: 14, pitch: 16 }),
        poseConfig,
        "rightEar",
        best,
        12,
      ).prompt,
    ).toBe("FIX_ROLL");
    expect(
      evaluateGuidance(
        base({ yaw: 45, roll: 0, pitch: 16 }),
        poseConfig,
        "rightEar",
        best,
        12,
      ).prompt,
    ).toBe("PITCH_DOWN");
    expect(
      evaluateGuidance(
        base({ yaw: 28, roll: 0, pitch: 0 }),
        poseConfig,
        "rightEar",
        best,
        0,
      ).prompt,
    ).toBe("TURN_MORE");
  });

  it("right-ear sweep / more / back vs the soft prior", () => {
    expect(
      evaluateGuidance(base({ yaw: 20 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      evaluateGuidance(base({ yaw: 45 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      evaluateGuidance(base({ yaw: 90 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
  });

  it("left-ear sweep (mirrored) vs the soft prior", () => {
    expect(
      evaluateGuidance(base({ yaw: -20 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("SWEEP_LEFT_EAR");
    expect(
      evaluateGuidance(base({ yaw: -45 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("SWEEP_LEFT_EAR");
    expect(
      evaluateGuidance(base({ yaw: -90 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("SWEEP_LEFT_EAR");
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

  it("HOLD_NEAR_PEAK until stable frames, then READY near a locked peak", () => {
    const best = peakAt(60);
    const hold = evaluateGuidance(base(), poseConfig, "rightEar", best, 3);
    expect(hold.prompt).toBe("HOLD_NEAR_PEAK");
    expect(hold.allowCapture).toBe(false);
    const ready = evaluateGuidance(base(), poseConfig, "rightEar", best, 12);
    expect(ready.prompt).toBe("READY");
    expect(ready.allowCapture).toBe(true);
    expect(poseConfig.ready.requireUserConfirm).toBe(false);
  });

  it("FAIL_TRACKING after a face was already seen", () => {
    expect(
      evaluateGuidance(
        base({ hasFace: false }),
        poseConfig,
        "rightEar",
        null,
        0,
        { hadTrackedFace: true },
      ).prompt,
    ).toBe("FAIL_TRACKING");
  });

  it("FAIL_TIMEOUT only when stuck with no peak — a 45° peak still READYs", () => {
    const timedOut = evaluateGuidance(
      base({ yaw: 0 }),
      poseConfig,
      "rightEar",
      null,
      12,
      { searchElapsedMs: poseConfig.failure.timeoutMs, yawDelta: 0 },
    );
    expect(timedOut.prompt).toBe("FAIL_TIMEOUT");
    expect(timedOut.allowCapture).toBe(false);

    const best = peakAt(45);
    const ready = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      best,
      12,
      { searchElapsedMs: poseConfig.failure.timeoutMs, yawDelta: 0 },
    );
    expect(ready.prompt).toBe("READY");
    expect(ready.allowCapture).toBe(true);
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
    expect(poseConfig.search.rightEar.yawAbsMax).toBe(90);
    expect(poseConfig.search.leftEar.yawAbsMax).toBe(90);
    expect(poseConfig.ready.bandDegAroundBest).toBe(5);
    expect(poseConfig.captureMode).toBe("qualityPeakYaw");
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
    expect(r.prompt).not.toBe("HOLD_NEAR_PEAK");
    expect(r.prompt).toBe("SWEEP_RIGHT_EAR");
    expect(r.phase).toBe("learning");
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

  it("unlocked peak does not use the prior to TURN_BACK or TURN_MORE", () => {
    expect(
      evaluateGuidance(base({ yaw: 90 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      evaluateGuidance(base({ yaw: 48 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
  });

  it("locked overshoot past the search edge is TURN_BACK_OVERSHOOT, not a 70–90 READY", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ yaw: 90, quality: sharp }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(r.allowCapture).toBe(false);
    expect(r.prompt).toBe("TURN_BACK_OVERSHOOT");
  });

  it("exit-band hysteresis keeps READY a bit past ±5° once already ready", () => {
    const best = peakAt(45);
    const entering = evaluateGuidance(
      base({ yaw: 51 }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(entering.poseReady).toBe(false);
    const staying = evaluateGuidance(
      base({ yaw: 51 }),
      poseConfig,
      "rightEar",
      best,
      12,
      { wasPoseReady: true },
    );
    expect(staying.poseReady).toBe(true);
  });

  it("prior is a soft center until a peak is locked; 45 is not refused", () => {
    const prior = effectiveTargets("rightEar", null, poseConfig);
    expect(prior.yawCenter).toBe(poseConfig.search.priorYawAbs);
    expect(prior.locked).toBe(false);
    const personal = effectiveTargets("rightEar", peakAt(45), poseConfig);
    expect(personal.yawCenter).toBe(45);
    expect(personal.locked).toBe(true);
  });
});

describe("QA precheck: search 35–90, READY ±5°, never 70–90 alone", () => {
  it("keeps exit ±8 for hysteresis; does not keep search max 100 or user confirm", () => {
    expect(poseConfig.search.rightEar.yawAbsMin).toBe(35);
    expect(poseConfig.search.rightEar.yawAbsMax).toBe(90);
    expect(poseConfig.search.leftEar.yawAbsMin).toBe(35);
    expect(poseConfig.search.leftEar.yawAbsMax).toBe(90);
    expect(yawInSearchWindow(90, "rightEar")).toBe(true);
    expect(yawInSearchWindow(100, "rightEar")).toBe(false);
    expect(yawInSearchWindow(95, "rightEar")).toBe(false);
    expect(poseConfig.ready.bandDegAroundBest).toBe(5);
    expect(poseConfig.ready.exitBandDeg).toBe(8);
    expect(poseConfig.ready.requireUserConfirm).toBe(false);
    expect(poseConfig.search.overshootTurnBackDeg).toBe(6);
    expect(poseConfig.search.fastTurnDegPerFrame).toBe(18);
    expect(poseConfig.failure.wrongSideFrames).toBe(8);
    expect(poseConfig.ready.countdownMs).toBe(1000);
    expect(poseConfig.ready.cooldownMs).toBe(2000);
    expect(poseConfig.search.uxNote.toLowerCase()).toContain("100");
    expect(poseConfig.ready.uxNote.toLowerCase()).toContain("hysteresis");
  });

  it("readyMaxAbsYawError / bandDegAroundBest is 5 (exit 8 is hysteresis only)", () => {
    expect(poseConfig.ready.bandDegAroundBest).toBe(5);
    expect(poseConfig.ready.exitBandDeg).toBe(8);
    const best = peakAt(45);
    const enterAt51 = evaluateGuidance(
      base({ yaw: 51 }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(enterAt51.poseReady).toBe(false);
    expect(enterAt51.allowCapture).toBe(false);
    const enterAt50 = evaluateGuidance(
      base({ yaw: 50 }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(enterAt50.poseReady).toBe(true);
    expect(enterAt50.allowCapture).toBe(true);
  });

  it("peak ~45° can READY; yaw 70–90 with no locked peak cannot", () => {
    const at45 = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      peakAt(45),
      12,
    );
    expect(at45.prompt).toBe("READY");
    expect(at45.allowCapture).toBe(true);

    for (const yaw of [70, 80, 90]) {
      const r = evaluateGuidance(base({ yaw }), poseConfig, "rightEar", null, 12);
      expect(r.allowCapture).toBe(false);
      expect(r.prompt).not.toBe("READY");
      expect(r.prompt).toBe("SWEEP_RIGHT_EAR");
    }
  });

  it("stability gates: first frame is never stable; deltas under 3° are", () => {
    const now = { yaw: 45, pitch: 0, roll: 0 };
    expect(isAngleStable(now, null, poseConfig)).toBe(false);
    expect(
      isAngleStable(now, { yaw: 47, pitch: 1, roll: -1 }, poseConfig),
    ).toBe(true);
    expect(
      isAngleStable(now, { yaw: 50, pitch: 0, roll: 0 }, poseConfig),
    ).toBe(false);
    const unstable = evaluateGuidance(base({ yaw: 45 }), poseConfig, "rightEar", peakAt(45), 3);
    expect(unstable.allowCapture).toBe(false);
    expect(unstable.prompt).toBe("HOLD_NEAR_PEAK");
  });
});

describe("interaction coverage (coherent pass)", () => {
  it("under-rotate past a locked peak → TURN_MORE", () => {
    expect(
      evaluateGuidance(base({ yaw: 38 }), poseConfig, "rightEar", peakAt(45), 0)
        .prompt,
    ).toBe("TURN_MORE");
  });

  it("over-rotate past personal best → TURN_BACK; approaching the peak HOLDs", () => {
    const best = peakAt(45);
    expect(
      evaluateGuidance(base({ yaw: 55 }), poseConfig, "rightEar", best, 0).prompt,
    ).toBe("TURN_BACK");
    const hold = evaluateGuidance(base({ yaw: 48 }), poseConfig, "rightEar", best, 3);
    expect(hold.prompt).toBe("HOLD_NEAR_PEAK");
    expect(hold.prompt).not.toBe("TURN_MORE");
    expect(hold.allowCapture).toBe(false);
  });

  it("wrong side / reverse turn on both ears", () => {
    expect(
      evaluateGuidance(base({ yaw: -20 }), poseConfig, "rightEar", null, 0).prompt,
    ).toBe("WRONG_SIDE");
    expect(
      evaluateGuidance(base({ yaw: 20 }), poseConfig, "leftEar", null, 0).prompt,
    ).toBe("WRONG_SIDE");
  });

  it("hair / bad light / too fast near the peak", () => {
    const best = peakAt(45);
    expect(
      evaluateGuidance(
        base({
          yaw: 45,
          quality: { laplacian: 10, brightness: 120, edgeEnergy: 4 },
        }),
        poseConfig,
        "rightEar",
        best,
        0,
      ).prompt,
    ).toBe("CLEAR_HAIR");
    expect(
      evaluateGuidance(
        base({
          yaw: 45,
          quality: { laplacian: 180, brightness: 220, edgeEnergy: 40 },
        }),
        poseConfig,
        "rightEar",
        best,
        0,
      ).prompt,
    ).toBe("TOO_BRIGHT");
    expect(
      evaluateGuidance(base({ yaw: 20 }), poseConfig, "rightEar", null, 0, {
        yawDelta: 20,
      }).prompt,
    ).toBe("SLOW_DOWN");
  });

  it("face lost keeps the locked peak (caller must not clear bestYaw)", () => {
    const best = peakAt(45);
    const r = evaluateGuidance(
      base({ hasFace: false, yaw: 45 }),
      poseConfig,
      "rightEar",
      best,
      0,
      { hadTrackedFace: true },
    );
    expect(r.prompt).toBe("FAIL_TRACKING");
    expect(r.allowCapture).toBe(false);
    expect(r.targets.bestYaw).toBe(45);
    expect(r.targets.locked).toBe(true);
  });

  it("too near / far", () => {
    expect(
      evaluateGuidance(base({ faceHeightRatio: 0.1 }), poseConfig, "rightEar", null, 0)
        .prompt,
    ).toBe("TOO_FAR");
    expect(
      evaluateGuidance(base({ faceHeightRatio: 0.8 }), poseConfig, "rightEar", null, 0)
        .prompt,
    ).toBe("TOO_CLOSE");
  });

  it("flat score curve still locks the smaller |yaw| and can READY; relearn is sweep", () => {
    const even: EarQuality = { laplacian: 160, brightness: 120, edgeEnergy: 40 };
    let best: PeakSample | null = null;
    for (const yaw of [40, 45, 55, 70]) {
      best = updatePersonalBest(best, {
        yaw,
        pitch: 0,
        roll: 0,
        quality: even,
        side: "rightEar",
      });
    }
    expect(best?.yaw).toBe(40);
    const ready = evaluateGuidance(
      base({ yaw: 40, quality: even }),
      poseConfig,
      "rightEar",
      best,
      12,
    );
    expect(ready.prompt).toBe("READY");
    expect(ready.phase).toBe("ready");
    const afterRelearn = evaluateGuidance(
      base({ yaw: 40, quality: even }),
      poseConfig,
      "rightEar",
      null,
      12,
    );
    expect(afterRelearn.allowCapture).toBe(false);
    expect(afterRelearn.prompt).toBe("SWEEP_RIGHT_EAR");
    expect(afterRelearn.phase).toBe("learning");
  });

  it("READY only near the personal best — never a lone 70–90 hold", () => {
    const at45 = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      peakAt(45),
      12,
    );
    expect(at45.prompt).toBe("READY");
    expect(at45.allowCapture).toBe(true);
    const lone80 = evaluateGuidance(base({ yaw: 80 }), poseConfig, "rightEar", null, 12);
    expect(lone80.allowCapture).toBe(false);
    expect(lone80.prompt).toBe("SWEEP_RIGHT_EAR");
  });

  it("overshoot 6°+ past personal best TURN_BACK even if still sharp", () => {
    const best = peakAt(45);
    expect(
      evaluateGuidance(base({ yaw: 52, quality: sharp }), poseConfig, "rightEar", best, 0)
        .prompt,
    ).toBe("TURN_BACK");
    expect(
      evaluateGuidance(
        base({ yaw: -52, quality: sharp }),
        poseConfig,
        "leftEar",
        peakAt(-45),
        0,
      ).prompt,
    ).toBe("TURN_BACK");
  });

  it("approaching the peak from overshoot HOLDs, not TURN_MORE", () => {
    const best = peakAt(45);
    const hold = evaluateGuidance(
      base({ yaw: 51, quality: sharp }),
      poseConfig,
      "rightEar",
      best,
      3,
      { signedYawDelta: -2 },
    );
    expect(hold.prompt).toBe("HOLD_NEAR_PEAK");
    expect(hold.prompt).not.toBe("TURN_MORE");
    expect(hold.allowCapture).toBe(false);
    expect(
      evaluateGuidance(
        base({ yaw: -51, quality: sharp }),
        poseConfig,
        "leftEar",
        peakAt(-45),
        3,
        { signedYawDelta: 2 },
      ).prompt,
    ).toBe("HOLD_NEAR_PEAK");
  });

  it("weak cold-start peak without 60% sweep is not READY; a confident 45° peak is", () => {
    const weak: PeakSample = { yaw: 36, score: 0.36 };
    const blocked = evaluateGuidance(
      base({ yaw: 36 }),
      poseConfig,
      "rightEar",
      weak,
      12,
      { sweepCoverageRatio: 0.15 },
    );
    expect(blocked.allowCapture).toBe(false);
    expect(blocked.prompt).not.toBe("READY");

    const confident = evaluateGuidance(
      base({ yaw: 45 }),
      poseConfig,
      "rightEar",
      peakAt(45),
      12,
      { sweepCoverageRatio: 0.15 },
    );
    expect(peakAt(45).score).toBeGreaterThan(poseConfig.ready.confidentPeakScore);
    expect(confident.prompt).toBe("READY");
    expect(confident.allowCapture).toBe(true);
  });

  it("debounces WRONG_SIDE until wrongSideFrames; ROI out of frame near peak is TOO_CLOSE", () => {
    expect(
      evaluateGuidance(base({ yaw: -20 }), poseConfig, "rightEar", null, 0, {
        wrongSideStreak: 2,
      }).prompt,
    ).toBe("SWEEP_RIGHT_EAR");
    expect(
      evaluateGuidance(base({ yaw: -20 }), poseConfig, "rightEar", null, 0, {
        wrongSideStreak: 8,
      }).prompt,
    ).toBe("WRONG_SIDE");
    expect(
      evaluateGuidance(
        base({ yaw: 45 }),
        poseConfig,
        "rightEar",
        peakAt(45),
        12,
        { roiOutOfFrame: true },
      ).prompt,
    ).toBe("TOO_CLOSE");
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
    expect(dwellMsFor("TURN_MORE", "TURN_BACK", ux)).toBe(ux.minDwellMs);
    expect(dwellMsFor("NO_FACE", "TURN_MORE", ux)).toBe(ux.crossFamilyDwellMs);
  });
});
