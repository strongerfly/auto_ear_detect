export type BurstEntry<T> = {
  score: number;
  payload: T;
};

/**
 * Keep the last `max` ready frames. Used so autoshutter / Capture can pick
 * the sharpest still instead of whatever the last rAF happened to be.
 * This is not learned fusion and not a READY gate — READY already fired.
 */
export function rememberBurst<T>(
  buffer: BurstEntry<T>[],
  entry: BurstEntry<T>,
  max: number,
): BurstEntry<T>[] {
  if (max <= 0) return [];
  if (buffer.length < max) return [...buffer, entry];
  return [...buffer.slice(1), entry];
}

export function pickBurst<T>(
  buffer: BurstEntry<T>[],
  pickBy: string,
): BurstEntry<T> | undefined {
  if (buffer.length === 0) return undefined;
  if (pickBy === "score") {
    return buffer.reduce((best, item) =>
      item.score > best.score ? item : best,
    );
  }
  return buffer[buffer.length - 1];
}
