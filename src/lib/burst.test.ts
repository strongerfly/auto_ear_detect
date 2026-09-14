import { describe, expect, it } from "vitest";
import { pickBurst, rememberBurst } from "./burst";
import { poseConfig } from "../config";

describe("ready burst pick-by-score", () => {
  it("config asks for a 3-frame score pick, not a 70–90 gate", () => {
    expect(poseConfig.ready.burstFrames).toBe(3);
    expect(poseConfig.ready.pickBurstBy).toBe("score");
    expect(poseConfig.ready.requireUserConfirm).toBe(false);
  });

  it("keeps a ring of max frames and picks the highest score", () => {
    let buf = rememberBurst<{ id: number }>([], { score: 0.4, payload: { id: 1 } }, 3);
    buf = rememberBurst(buf, { score: 0.9, payload: { id: 2 } }, 3);
    buf = rememberBurst(buf, { score: 0.5, payload: { id: 3 } }, 3);
    buf = rememberBurst(buf, { score: 0.6, payload: { id: 4 } }, 3);
    expect(buf.map((e) => e.payload.id)).toEqual([2, 3, 4]);
    expect(pickBurst(buf, "score")?.payload.id).toBe(2);
    expect(pickBurst(buf, "last")?.payload.id).toBe(4);
  });

  it("returns undefined on an empty buffer", () => {
    expect(pickBurst([], "score")).toBeUndefined();
  });
});
