/** After relearn, ignore new peaks until the user actually turns again. */

export type RelearnHoldoff = {
  side: "leftEar" | "rightEar";
  fromYaw: number | null;
};

export function startRelearnHoldoff(
  side: RelearnHoldoff["side"],
  fromYaw: number | null,
): RelearnHoldoff {
  return { side, fromYaw };
}

/**
 * True while we should keep the sweep intro and not write a new bestYaw.
 * The first seen yaw becomes the anchor if relearn happened without a pose.
 */
export function stepRelearnHoldoff(
  holdoff: RelearnHoldoff | null,
  side: RelearnHoldoff["side"],
  yaw: number | null,
  minMoveDeg: number,
): RelearnHoldoff | null {
  if (!holdoff || holdoff.side !== side) return holdoff;
  if (yaw === null || Number.isNaN(yaw)) return holdoff;
  if (holdoff.fromYaw === null) return { side, fromYaw: yaw };
  if (Math.abs(yaw - holdoff.fromYaw) >= minMoveDeg) return null;
  return holdoff;
}
