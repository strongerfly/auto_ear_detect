import { describe, expect, it } from "vitest";
import { poseConfig } from "../config";
import {
  EMPTY_PEAK_HYGIENE,
  stepPeakHygiene,
  type PeakHygieneState,
} from "./peak-hygiene";

const config = {
  ignoreFrameIfFaceLost: poseConfig.score.ignoreFrameIfFaceLost,
  maxFaceLostFrames: poseConfig.failure.maxFaceLostFrames,
};

function run(
  steps: Array<{ hasFace: boolean; earInFrame?: boolean }>,
  start: PeakHygieneState = EMPTY_PEAK_HYGIENE,
  cfg = config,
) {
  let state = start;
  const allowed: boolean[] = [];
  for (const step of steps) {
    const next = stepPeakHygiene(state, step.hasFace, step.earInFrame, cfg);
    state = next.state;
    allowed.push(next.allowPeakUpdate);
  }
  return { state, allowed };
}

describe("peak hygiene", () => {
  it("blocks an ear that is out of frame and allows the simulator's unknown crop", () => {
    const clipped = stepPeakHygiene(EMPTY_PEAK_HYGIENE, true, false, config);
    expect(clipped.allowPeakUpdate).toBe(false);
    const unknown = stepPeakHygiene(EMPTY_PEAK_HYGIENE, true, undefined, config);
    expect(unknown.allowPeakUpdate).toBe(true);
  });

  it("does not update bestYaw on a brief face-loss blip or its recovery frames", () => {
    const { allowed } = run([
      { hasFace: true, earInFrame: true },
      { hasFace: false },
      { hasFace: false },
      { hasFace: true, earInFrame: true },
      { hasFace: true, earInFrame: true },
      { hasFace: true, earInFrame: true },
    ]);
    expect(allowed).toEqual([true, false, false, false, false, true]);
  });

  it("caps the recovery cooldown at maxFaceLostFrames", () => {
    const lost = Array.from({ length: 40 }, () => ({ hasFace: false }));
    const back = Array.from({ length: config.maxFaceLostFrames + 1 }, () => ({
      hasFace: true,
      earInFrame: true,
    }));
    const { allowed } = run([...lost, ...back]);
    const recovery = allowed.slice(40);
    expect(recovery.slice(0, config.maxFaceLostFrames).every((ok) => !ok)).toBe(
      true,
    );
    expect(recovery[config.maxFaceLostFrames]).toBe(true);
  });

  it("still learns on the return frame when face-loss ignores are off", () => {
    const { allowed } = run(
      [
        { hasFace: false },
        { hasFace: true, earInFrame: true },
      ],
      EMPTY_PEAK_HYGIENE,
      { ignoreFrameIfFaceLost: false, maxFaceLostFrames: 15 },
    );
    expect(allowed).toEqual([false, true]);
  });
});
