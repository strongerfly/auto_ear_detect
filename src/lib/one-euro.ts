function smoothingFactor(dt: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * dt;
  return r / (r + 1);
}

class LowPassFilter {
  private y: number | null = null;

  reset(): void {
    this.y = null;
  }

  filter(x: number, alpha: number): number {
    if (this.y === null) {
      this.y = x;
      return x;
    }
    this.y = alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
}

/** One Euro Filter — Casiez, Roussel, Vogel (CHI 2012). */
export class OneEuroFilter {
  private readonly xFilter = new LowPassFilter();
  private readonly dxFilter = new LowPassFilter();
  private lastTimeSec: number | null = null;
  private lastX: number | null = null;

  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff: number,
  ) {}

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTimeSec = null;
    this.lastX = null;
  }

  filter(x: number, timestampMs: number): number {
    const t = timestampMs / 1000;
    if (this.lastTimeSec === null || this.lastX === null) {
      this.lastTimeSec = t;
      this.lastX = x;
      return this.xFilter.filter(x, 1);
    }

    const dt = Math.max(t - this.lastTimeSec, 1e-6);
    this.lastTimeSec = t;
    const dx = (x - this.lastX) / dt;
    this.lastX = x;
    const edx = this.dxFilter.filter(dx, smoothingFactor(dt, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, smoothingFactor(dt, cutoff));
  }
}

export class EulerSmoother {
  private yaw: OneEuroFilter;
  private pitch: OneEuroFilter;
  private roll: OneEuroFilter;

  constructor(minCutoff: number, beta: number, dCutoff: number) {
    this.yaw = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.pitch = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.roll = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  reset(): void {
    this.yaw.reset();
    this.pitch.reset();
    this.roll.reset();
  }

  filter(
    yaw: number,
    pitch: number,
    roll: number,
    timestampMs: number,
  ): { yaw: number; pitch: number; roll: number } {
    return {
      yaw: this.yaw.filter(yaw, timestampMs),
      pitch: this.pitch.filter(pitch, timestampMs),
      roll: this.roll.filter(roll, timestampMs),
    };
  }
}
