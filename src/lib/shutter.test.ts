import { describe, expect, it } from "vitest";
import { INITIAL_SHUTTER, stepShutter } from "./shutter";

describe("autoshutter armed → countdown → capture → cooldown", () => {
  const base = {
    enabled: true,
    allowCapture: true,
    cancelled: false,
    countdownMs: 1000,
    cooldownMs: 2000,
  };

  it("arms countdown, fires once, then cools down", () => {
    let s = INITIAL_SHUTTER;
    let r = stepShutter(s, { ...base, nowMs: 0 });
    expect(r.state.phase).toBe("countdown");
    expect(r.fire).toBe(false);
    s = r.state;
    r = stepShutter(s, { ...base, nowMs: 400 });
    expect(r.state.phase).toBe("countdown");
    expect(r.countdownLeftMs).toBe(600);
    expect(r.fire).toBe(false);
    s = r.state;
    r = stepShutter(s, { ...base, nowMs: 1000 });
    expect(r.fire).toBe(true);
    expect(r.state.phase).toBe("cooldown");
    s = r.state;
    r = stepShutter(s, { ...base, nowMs: 1500 });
    expect(r.fire).toBe(false);
    expect(r.state.phase).toBe("cooldown");
    s = r.state;
    r = stepShutter(s, { ...base, nowMs: 3000 });
    expect(r.state.phase).toBe("cooldown");
    expect(r.fire).toBe(false);
    r = stepShutter(s, { ...base, nowMs: 3000, allowCapture: false });
    expect(r.state.phase).toBe("idle");
    expect(r.fire).toBe(false);
  });

  it("cancel or disable returns to idle without firing", () => {
    const armed = stepShutter(INITIAL_SHUTTER, { ...base, nowMs: 0 }).state;
    const cancelled = stepShutter(armed, { ...base, nowMs: 200, cancelled: true });
    expect(cancelled.fire).toBe(false);
    expect(cancelled.state.phase).toBe("idle");
    const off = stepShutter(armed, { ...base, nowMs: 200, enabled: false });
    expect(off.fire).toBe(false);
    expect(off.state.phase).toBe("idle");
  });
});
