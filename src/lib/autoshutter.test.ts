import { describe, expect, it } from "vitest";
import {
  pickBurstByScore,
  pushBurstFrame,
  scoreBurstFrame,
  type BurstFrame,
} from "./burst";
import {
  INITIAL_AUTOSHUTTER,
  loadAutoShutterEnabled,
  saveAutoShutterEnabled,
  stepAutoshutter,
} from "./autoshutter";

function frame(score: number, id: string, at = 0): BurstFrame {
  return { score, capturedAt: at, dataUrl: id };
}

describe("burst pick-by-score", () => {
  it("picks the highest score, not the latest frame", () => {
    const burst = [
      frame(0.4, "a"),
      frame(0.9, "best"),
      frame(0.5, "c"),
    ];
    expect(pickBurstByScore(burst)?.dataUrl).toBe("best");
  });

  it("caps the buffer at burstFrames", () => {
    let buf: BurstFrame[] = [];
    buf = pushBurstFrame(buf, frame(0.1, "a"), 3);
    buf = pushBurstFrame(buf, frame(0.2, "b"), 3);
    buf = pushBurstFrame(buf, frame(0.3, "c"), 3);
    buf = pushBurstFrame(buf, frame(0.4, "d"), 3);
    expect(buf.map((f) => f.dataUrl)).toEqual(["b", "c", "d"]);
    expect(pickBurstByScore(buf)?.dataUrl).toBe("d");
  });

  it("scores missing quality as 0", () => {
    expect(scoreBurstFrame(null, 45)).toBe(0);
  });
});

describe("cancelable autoshutter countdown", () => {
  const tick = {
    enabled: true,
    allowCapture: true,
    cancelClick: false,
    burstFrames: 3,
    autoshutterMs: 1200,
  };

  it("arms until burstFrames then counts down and fires the best frame", () => {
    let state = INITIAL_AUTOSHUTTER;
    let a = stepAutoshutter(state, {
      ...tick,
      now: 0,
      frame: frame(0.4, "a", 0),
    });
    expect(a.state.phase).toBe("arming");
    expect(a.fire).toBeNull();

    a = stepAutoshutter(a.state, { ...tick, now: 30, frame: frame(0.9, "best", 30) });
    a = stepAutoshutter(a.state, { ...tick, now: 60, frame: frame(0.5, "c", 60) });
    expect(a.state.phase).toBe("counting");
    expect(a.remainingMs).toBe(1200);
    expect(a.fire).toBeNull();

    const mid = stepAutoshutter(a.state, {
      ...tick,
      now: 60 + 400,
      frame: frame(0.1, "ignored", 460),
    });
    expect(mid.state.phase).toBe("counting");
    expect(mid.remainingMs).toBe(800);
    expect(mid.fire).toBeNull();

    const done = stepAutoshutter(mid.state, {
      ...tick,
      now: 60 + 1200,
      frame: null,
    });
    expect(done.fire?.dataUrl).toBe("best");
    expect(done.state.phase).toBe("idle");
  });

  it("cancel click holds until READY is left", () => {
    let state = INITIAL_AUTOSHUTTER;
    for (const [i, id] of ["a", "b", "c"].entries()) {
      const step = stepAutoshutter(state, {
        ...tick,
        now: i * 30,
        frame: frame(0.5, id, i * 30),
      });
      state = step.state;
    }
    expect(state.phase).toBe("counting");

    const cancelled = stepAutoshutter(state, {
      ...tick,
      now: 200,
      frame: null,
      cancelClick: true,
    });
    expect(cancelled.state.phase).toBe("cancelled");
    expect(cancelled.fire).toBeNull();

    const still = stepAutoshutter(cancelled.state, {
      ...tick,
      now: 5000,
      frame: frame(0.9, "nope", 5000),
    });
    expect(still.state.phase).toBe("cancelled");
    expect(still.fire).toBeNull();

    const reset = stepAutoshutter(still.state, {
      ...tick,
      now: 5100,
      allowCapture: false,
      frame: null,
    });
    expect(reset.state).toEqual(INITIAL_AUTOSHUTTER);
  });

  it("leaving READY or turning autoshutter off resets", () => {
    const armed = stepAutoshutter(INITIAL_AUTOSHUTTER, {
      ...tick,
      now: 0,
      frame: frame(0.5, "a", 0),
    });
    const off = stepAutoshutter(armed.state, {
      ...tick,
      now: 10,
      enabled: false,
      frame: null,
    });
    expect(off.state).toEqual(INITIAL_AUTOSHUTTER);
  });

  it("first-run default is off", () => {
    localStorage.removeItem("auto-ear-detect:auto-shutter:v1");
    expect(loadAutoShutterEnabled()).toBe(false);
    saveAutoShutterEnabled(true);
    expect(loadAutoShutterEnabled()).toBe(true);
    saveAutoShutterEnabled(false);
    expect(loadAutoShutterEnabled()).toBe(false);
  });
});
