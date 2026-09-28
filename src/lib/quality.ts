import type { PoseConfig } from "../config";
import { poseConfig } from "../config";
import type { EarQuality } from "./types";

function toGray(data: ArrayLike<number>, i: number): number {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export type ImageDataLike = {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 1 at the ROI center, ~0.25 at the border. Hair and background texture
 * usually sit on the edge of the ear crop; the pinna is expected nearer
 * the middle. This is a soft weight, not a rejection.
 */
function spatialWeight(x: number, y: number, w: number, h: number): number {
  const nx = ((x + 0.5) / w - 0.5) * 2;
  const ny = ((y + 0.5) / h - 0.5) * 2;
  const r = Math.min(1, Math.hypot(nx, ny));
  return 1 - 0.75 * r;
}

export function unitInterval(
  value: number,
  min: number,
  good: number,
): number {
  if (good <= min) return value >= good ? 1 : 0;
  return clamp01((value - min) / (good - min));
}

/**
 * Sharpness / exposure metrics on an RGBA ImageData crop.
 * Laplacian variance ≈ focus; Sobel mean ≈ edge energy; mean luma ≈ brightness.
 */
export function measureEarQuality(image: ImageDataLike): EarQuality {
  const { data, width: w, height: h } = image;
  const gray = new Float64Array(w * h);
  let lumaSum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = toGray(data, i);
    gray[p] = g;
    lumaSum += g;
  }
  const brightness = lumaSum / (w * h);

  const x0 = Math.floor(w * 0.35);
  const x1 = Math.max(x0 + 1, Math.ceil(w * 0.65));
  const y0 = Math.floor(h * 0.35);
  const y1 = Math.max(y0 + 1, Math.ceil(h * 0.65));
  let centerSum = 0;
  let centerN = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      centerSum += gray[y * w + x];
      centerN += 1;
    }
  }
  const centerBrightness = centerN === 0 ? brightness : centerSum / centerN;

  if (w < 3 || h < 3) {
    return { laplacian: 0, brightness, edgeEnergy: 0, centerBrightness };
  }

  const lap: number[] = [];
  const lapW: number[] = [];
  const centerLap: number[] = [];
  const borderLap: number[] = [];
  let edgeSum = 0;
  let edgeW = 0;
  const cx0 = w * 0.25;
  const cx1 = w * 0.75;
  const cy0 = h * 0.25;
  const cy1 = h * 0.75;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const weight = spatialWeight(x, y, w, h);
      const L =
        gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lap.push(L);
      lapW.push(weight);
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) centerLap.push(L);
      else borderLap.push(L);

      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + w - 1] +
        gray[i + w + 1];
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1];
      edgeSum += weight * Math.hypot(gx, gy);
      edgeW += weight;
    }
  }

  return {
    laplacian: weightedVariance(lap, lapW),
    brightness,
    edgeEnergy: edgeW === 0 ? 0 : edgeSum / edgeW,
    centerBrightness,
    centerSharpness: variance(centerLap),
    borderSharpness: variance(borderLap),
  };
}

function variance(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  const mean = sum / n;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean;
    acc += d * d;
  }
  return acc / n;
}

function weightedVariance(values: number[], weights: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  let wSum = 0;
  let meanAcc = 0;
  for (let i = 0; i < n; i++) {
    const w = weights[i] ?? 0;
    wSum += w;
    meanAcc += w * values[i];
  }
  if (wSum <= 0) return 0;
  const mean = meanAcc / wSum;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const w = weights[i] ?? 0;
    const d = values[i] - mean;
    acc += w * d * d;
  }
  return acc / wSum;
}

/**
 * 0–1 ear-frontal score: sharpness (Laplacian) + structure (edges) + a light
 * content prior (side-face yaw, preferred 40–80 band, dark-center penalty).
 * Preferred-band miss is a soft penalty, never a refusal of ~45°.
 * Laplacian and edges are center-weighted in measureEarQuality so border
 * hair/background counts less than structure in the middle of the crop.
 */
export function frontalQualityScore(
  quality: EarQuality,
  yaw?: number,
  config: PoseConfig = poseConfig,
): number {
  const s = config.score;
  const sharp = unitInterval(
    quality.laplacian,
    s.sharp.laplacianMinRaw,
    s.sharp.laplacianGoodRaw,
  );
  const struct = unitInterval(
    quality.edgeEnergy,
    s.struct.minEdgeEnergy,
    s.struct.goodEdgeEnergy,
  );

  let content = 0.5;
  if (yaw !== undefined) {
    const abs = Math.abs(yaw);
    const inSearch =
      abs >= config.search.yawAbsMin && abs <= config.search.yawAbsMax;
    content = s.content.requireSideFaceProxy && !inSearch ? 0 : 1;
    if (
      inSearch &&
      (abs < config.search.preferredAbsMin ||
        abs > config.search.preferredAbsMax)
    ) {
      content = Math.max(0, content - s.content.outsidePreferredSoftPenalty);
    }
  }
  if (
    quality.centerSharpness !== undefined &&
    quality.borderSharpness !== undefined &&
    quality.borderSharpness >
      Math.max(
        s.sharp.laplacianMinRaw,
        quality.centerSharpness * s.content.borderDominatesAbove,
      )
  ) {
    // Border hair/background sharper than the pinna: soft penalty, not a refusal.
    content = Math.max(0, content - s.content.borderSharpPenalty);
  }
  if (
    s.content.penalizeMeatusLikeDarkBlob &&
    quality.centerBrightness !== undefined &&
    quality.centerBrightness < s.content.meatusCenterBrightnessBelow &&
    quality.brightness > config.ready.brightnessMin
  ) {
    content = Math.max(0, content - s.content.meatusPenalty);
  }

  return (
    s.weights.sharp * sharp +
    s.weights.struct * struct +
    s.weights.content * content
  );
}

/** Synthetic quality vs yaw (tests + pose simulator). Peak at `peakYaw`. */
export function qualityAlongYawCurve(
  yaw: number,
  peakYaw: number,
  peak: EarQuality,
  sigmaDeg = 12,
): EarQuality {
  const d = yaw - peakYaw;
  const scale = Math.exp(-(d * d) / (2 * sigmaDeg * sigmaDeg));
  return {
    laplacian: peak.laplacian * scale,
    brightness: peak.brightness,
    edgeEnergy: peak.edgeEnergy * scale,
    centerBrightness: peak.centerBrightness,
    centerSharpness:
      peak.centerSharpness === undefined
        ? undefined
        : peak.centerSharpness * scale,
    borderSharpness:
      peak.borderSharpness === undefined
        ? undefined
        : peak.borderSharpness * scale,
  };
}

export type QualityKind = "ok" | "hair" | "light";

export function classifyEarQuality(
  quality: EarQuality | null,
  config: PoseConfig = poseConfig,
): QualityKind {
  if (!quality) return "hair";
  if (
    quality.laplacian < config.score.sharp.laplacianMinRaw ||
    quality.edgeEnergy < config.score.struct.minEdgeEnergy
  ) {
    return "hair";
  }
  if (
    quality.brightness < config.ready.brightnessMin ||
    quality.brightness > config.ready.brightnessMax
  ) {
    return "light";
  }
  return "ok";
}
