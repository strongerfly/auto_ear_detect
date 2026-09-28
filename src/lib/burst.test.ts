import { describe, expect, it } from "vitest";
import { pickBurstCandidate, pushBurstCandidate } from "./burst";
import { poseConfig } from "../config";

describe("burst pick by score", () => {
  it("keeps only the configured depth and saves the sharpest frame", () => {
    let frames = pushBurstCandidate([], { score: 0.4, payload: "a" }, 3);
    frames = pushBurstCandidate(frames, { score: 0.91, payload: "b" }, 3);
    frames = pushBurstCandidate(frames, { score: 0.55, payload: "c" }, 3);
    frames = pushBurstCandidate(frames, { score: 0.7, payload: "d" }, 3);
    expect(frames.map((frame) => frame.payload)).toEqual(["b", "c", "d"]);
    expect(pickBurstCandidate(frames, poseConfig.ready.pickBurstBy)?.payload).toBe(
      "b",
    );
    expect(poseConfig.ready.pickBurstBy).toBe("score");
    expect(poseConfig.ready.burstFrames).toBe(3);
  });

  it("prefers the newer frame when scores tie", () => {
    const frames = [
      { score: 0.8, payload: "old" },
      { score: 0.8, payload: "new" },
    ];
    expect(pickBurstCandidate(frames, "score")?.payload).toBe("new");
  });

  it("falls back to the shutter instant when pickBurstBy is not score", () => {
    const frames = [
      { score: 0.95, payload: "sharp" },
      { score: 0.4, payload: "now" },
    ];
    expect(pickBurstCandidate(frames, "latest")?.payload).toBe("now");
    expect(pickBurstCandidate([], "score")).toBeNull();
  });
});
