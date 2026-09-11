import type { EulerDeg } from "./types";

/**
 * Facial transformation matrix → head pose (degrees).
 *
 * ## Euler order
 * Intrinsic **YXZ** (same as Three.js `Euler` order `'YXZ'`):
 *   R = Ry(yaw) · Rx(pitch) · Rz(roll)
 *
 * Matrix layout: MediaPipe JS `Matrix.data` is **row-major** 4×4
 * `[R00 R01 R02 tx; R10 R11 R12 ty; R20 R21 R22 tz; 0 0 0 1]`.
 *
 * ## MediaPipe metric axes (canonical face)
 * - +X = subject's right
 * - +Y = up
 * - +Z = out of the face, toward the camera
 *
 * Under the right-hand rule, a **positive** Ry takes the right ear *away*
 * from the camera (left profile). FISWG wants the opposite sign:
 *
 * ## FISWG sign convention (after calibration)
 * - **+yaw** → right ear more visible / right profile
 * - **−yaw** → left ear more visible / left profile
 * - **+pitch** → nose up (head tilted back)
 * - **+roll** → subject's right ear up
 *
 * Calibration applied here: `yaw_fiswg = −yaw_raw`. Pitch/roll are unchanged.
 * Do **not** apply an extra yaw negation for the front-camera preview —
 * see README "Front-camera / mirror".
 */

const RAD2DEG = 180 / Math.PI;

export const FISWG_YAW_SIGN = -1;
export const FISWG_PITCH_SIGN = 1;
export const FISWG_ROLL_SIGN = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Build a 4×4 row-major matrix from YXZ Euler radians (rotation only). */
export function composeYxzRowMajor(
  yawRad: number,
  pitchRad: number,
  rollRad: number,
): number[] {
  const cy = Math.cos(yawRad);
  const sy = Math.sin(yawRad);
  const cx = Math.cos(pitchRad);
  const sx = Math.sin(pitchRad);
  const cz = Math.cos(rollRad);
  const sz = Math.sin(rollRad);

  // R = Ry * Rx * Rz
  const r00 = cy * cz + sy * sx * sz;
  const r01 = cy * -sz + sy * sx * cz;
  const r02 = sy * cx;
  const r10 = cx * sz;
  const r11 = cx * cz;
  const r12 = -sx;
  const r20 = -sy * cz + cy * sx * sz;
  const r21 = sy * sz + cy * sx * cz;
  const r22 = cy * cx;

  return [r00, r01, r02, 0, r10, r11, r12, 0, r20, r21, r22, 0, 0, 0, 0, 1];
}

/**
 * Extract intrinsic YXZ Euler (radians) from a row-major 4×4 / 3×3.
 * Inverse of `composeYxzRowMajor`.
 */
export function extractYxzRadians(data: ArrayLike<number>): {
  yaw: number;
  pitch: number;
  roll: number;
} {
  if (data.length < 11) {
    throw new Error("transformation matrix must have at least 11 entries");
  }

  const m11 = data[0];
  const m13 = data[2];
  const m21 = data[4];
  const m22 = data[5];
  const m23 = data[6];
  const m31 = data[8];
  const m33 = data[10];

  // compose: r12 = m23 = −sin(pitch)  →  pitch = asin(−m23)
  const pitch = Math.asin(clamp(-m23, -1, 1));
  let yaw: number;
  let roll: number;
  if (Math.abs(m23) < 0.999999) {
    yaw = Math.atan2(m13, m33);
    roll = Math.atan2(m21, m22);
  } else {
    yaw = Math.atan2(-m31, m11);
    roll = 0;
  }
  return { yaw, pitch, roll };
}

/**
 * Convert a MediaPipe facial transformation matrix into FISWG-aligned
 * yaw / pitch / roll in degrees.
 */
export function matrixToFiswgEuler(data: ArrayLike<number>): EulerDeg {
  const raw = extractYxzRadians(data);
  return {
    yaw: FISWG_YAW_SIGN * raw.yaw * RAD2DEG,
    pitch: FISWG_PITCH_SIGN * raw.pitch * RAD2DEG,
    roll: FISWG_ROLL_SIGN * raw.roll * RAD2DEG,
  };
}
