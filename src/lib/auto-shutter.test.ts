import { describe, expect, it } from "vitest";
import { countdownSeconds, stepAutoShutter } from "./auto-shutter";

const base = {
  allowCapture: true,
  autoShutter: true,
  cancelled: false,
  latched: false,
  startedAt: null as number | null,
  now: 1000,
  countdownMs: 3000,
  burstCount: 3,
  burstNeeded: 3,
};

describe("stepAutoShutter", () => {
  it("starts a countdown once READY burst is met", () => {
    const a = stepAutoShutter(base);
    expect(a.fire).toBe(false);
    expect(a.startedAt).toBe(1000);
    expect(a.remainingMs).toBe(3000);

    const b = stepAutoShutter({ ...base, startedAt: 1000, now: 2500 });
    expect(b.fire).toBe(false);
    expect(b.remainingMs).toBe(1500);
    expect(countdownSeconds(b.remainingMs!)).toBe(2);
  });

  it("fires after the countdown elapses", () => {
    const r = stepAutoShutter({ ...base, startedAt: 1000, now: 4000 });
    expect(r.fire).toBe(true);
    expect(r.remainingMs).toBe(0);
  });

  it("does not run when cancelled, latched, or auto-shutter is off", () => {
    expect(stepAutoShutter({ ...base, cancelled: true }).remainingMs).toBeNull();
    expect(stepAutoShutter({ ...base, latched: true }).remainingMs).toBeNull();
    expect(stepAutoShutter({ ...base, autoShutter: false }).remainingMs).toBeNull();
    expect(stepAutoShutter({ ...base, allowCapture: false }).remainingMs).toBeNull();
    expect(stepAutoShutter({ ...base, burstCount: 1 }).remainingMs).toBeNull();
  });
});
