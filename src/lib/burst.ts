import { frontalQualityScore } from "./quality";
import type { EarQuality } from "./types";

export type BurstFrame = {
  score: number;
  capturedAt: number;
  dataUrl: string;
};

export function scoreBurstFrame(
  quality: EarQuality | null,
  yaw: number | null,
): number {
  if (!quality) return 0;
  return frontalQualityScore(quality, yaw ?? undefined);
}

/** Keep the newest `max` frames (oldest drop off the front). */
export function pushBurstFrame(
  frames: BurstFrame[],
  next: BurstFrame,
  max: number,
): BurstFrame[] {
  if (max <= 0) return [];
  const out = frames.length >= max ? frames.slice(frames.length - max + 1) : frames.slice();
  out.push(next);
  return out;
}

/** `ready.pickBurstBy: "score"` — highest frontal-quality score wins. */
export function pickBurstByScore(frames: BurstFrame[]): BurstFrame | null {
  if (frames.length === 0) return null;
  let best = frames[0];
  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i];
    if (frame.score > best.score) best = frame;
  }
  return best;
}
