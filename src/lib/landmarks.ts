import type { Landmark, RoiBox } from "./types";

/**
 * MediaPipe Face Mesh indices near each pinna.
 * 234 ≈ anterior to anatomical left ear; 454 ≈ anatomical right ear.
 */
export const LEFT_EAR_LANDMARKS = [234, 127, 93, 132, 58, 172, 136] as const;
export const RIGHT_EAR_LANDMARKS = [454, 356, 323, 361, 288, 397, 365] as const;

export function faceHeightRatio(landmarks: Landmark[]): number {
  if (landmarks.length === 0) return 0;
  let minY = 1;
  let maxY = 0;
  for (const p of landmarks) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.max(0, maxY - minY);
}

export function meanPresence(landmarks: Landmark[]): number {
  if (landmarks.length === 0) return 0;
  let sum = 0;
  let n = 0;
  for (const p of landmarks) {
    if (typeof p.presence === "number" && p.presence > 0) {
      sum += p.presence;
      n += 1;
    }
  }
  // Face Landmarker JS landmarks often omit presence; detection is enough.
  return n === 0 ? 1 : sum / n;
}

export function meanVisibility(landmarks: Landmark[]): number {
  if (landmarks.length === 0) return 0;
  let sum = 0;
  let n = 0;
  for (const p of landmarks) {
    if (typeof p.visibility === "number" && p.visibility > 0) {
      sum += p.visibility;
      n += 1;
    }
  }
  // visibility is frequently 0/unpopulated in the JS build.
  return n === 0 ? 1 : sum / n;
}

export type EarRoiResult = {
  box: RoiBox;
  clipped: boolean;
};

export function measureEarRoi(
  landmarks: Landmark[],
  side: "leftEar" | "rightEar",
  width: number,
  height: number,
): EarRoiResult | null {
  const idx = side === "leftEar" ? LEFT_EAR_LANDMARKS : RIGHT_EAR_LANDMARKS;
  const pts: { x: number; y: number }[] = [];
  for (const i of idx) {
    const p = landmarks[i];
    if (!p) continue;
    pts.push({ x: p.x * width, y: p.y * height });
  }
  if (pts.length < 3) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const bw = Math.max(8, maxX - minX);
  const bh = Math.max(8, maxY - minY);
  const padX = bw * 0.55;
  const padY = bh * 0.7;

  if (side === "leftEar") {
    maxX += padX;
    minX -= padX * 0.25;
  } else {
    minX -= padX;
    maxX += padX * 0.25;
  }
  minY -= padY;
  maxY += padY;

  const clipped =
    minX < 0 || minY < 0 || maxX > width || maxY > height;

  const x = Math.max(0, Math.floor(minX));
  const y = Math.max(0, Math.floor(minY));
  const w = Math.min(width - x, Math.ceil(maxX) - x);
  const h = Math.min(height - y, Math.ceil(maxY) - y);
  if (w < 8 || h < 8) return null;
  return { box: { x, y, w, h }, clipped };
}

export function earRoiBox(
  landmarks: Landmark[],
  side: "leftEar" | "rightEar",
  width: number,
  height: number,
): RoiBox | null {
  return measureEarRoi(landmarks, side, width, height)?.box ?? null;
}
