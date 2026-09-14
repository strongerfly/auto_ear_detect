import { describe, expect, it } from "vitest";
import {
  createProgress,
  retryProgress,
  stepProgress,
} from "./progress";

describe("no-progress timeout", () => {
  it("stays quiet while the peak is still improving", () => {
    let p = createProgress(0);
    p = stepProgress(p, {
      now: 10_000,
      peakScore: 0.4,
      allowCapture: false,
      timeoutMs: 45_000,
    });
    expect(p.stuck).toBe(false);
    p = stepProgress(p, {
      now: 50_000,
      peakScore: 0.5,
      allowCapture: false,
      timeoutMs: 45_000,
    });
    expect(p.stuck).toBe(false);
  });

  it("becomes stuck after timeoutMs with no peak/score improvement", () => {
    let p = createProgress(0);
    p = stepProgress(p, {
      now: 1_000,
      peakScore: 0.4,
      allowCapture: false,
      timeoutMs: 45_000,
    });
    p = stepProgress(p, {
      now: 46_000,
      peakScore: 0.4,
      allowCapture: false,
      timeoutMs: 45_000,
    });
    expect(p.stuck).toBe(true);
  });

  it("does not nag while READY / paused, and retry clears the narrative", () => {
    let p = createProgress(0);
    p = stepProgress(p, {
      now: 50_000,
      peakScore: null,
      allowCapture: true,
      timeoutMs: 45_000,
    });
    expect(p.stuck).toBe(false);

    p = stepProgress(p, {
      now: 100_000,
      peakScore: 0.4,
      allowCapture: false,
      paused: true,
      timeoutMs: 45_000,
    });
    expect(p.stuck).toBe(false);

    p = stepProgress(p, {
      now: 200_000,
      peakScore: 0.4,
      allowCapture: false,
      timeoutMs: 45_000,
    });
    expect(p.stuck).toBe(true);

    p = retryProgress(p, 200_000);
    expect(p.stuck).toBe(false);
    p = stepProgress(p, {
      now: 210_000,
      peakScore: 0.4,
      allowCapture: false,
      timeoutMs: 45_000,
    });
    expect(p.stuck).toBe(false);
  });
});
