export type BurstCandidate<T> = {
  score: number;
  payload: T;
};

/**
 * Keep the newest `limit` ready frames. `ready.burstFrames` is both the
 * countdown gate and this buffer depth.
 */
export function pushBurstCandidate<T>(
  frames: readonly BurstCandidate<T>[],
  frame: BurstCandidate<T>,
  limit: number,
): BurstCandidate<T>[] {
  const cap = Math.max(1, Math.floor(limit));
  const next =
    frames.length >= cap ? frames.slice(frames.length - cap + 1) : frames.slice();
  next.push(frame);
  return next;
}

/**
 * `pickBurstBy: "score"` saves the sharpest frame in the buffer.
 * Any other mode keeps the newest frame (the shutter instant).
 * Equal scores prefer the newer frame.
 */
export function pickBurstCandidate<T>(
  frames: readonly BurstCandidate<T>[],
  pickBy: string,
): BurstCandidate<T> | null {
  if (frames.length === 0) return null;
  if (pickBy !== "score") return frames[frames.length - 1];
  let best = frames[0];
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].score >= best.score) best = frames[i];
  }
  return best;
}
