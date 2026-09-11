import type { EarQuality } from "./types";

function variance(values: Float64Array | number[]): number {
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

  if (w < 3 || h < 3) {
    return { laplacian: 0, brightness, edgeEnergy: 0 };
  }

  const lap: number[] = [];
  let edgeSum = 0;
  let edgeN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const L =
        gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lap.push(L);

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
      edgeSum += Math.hypot(gx, gy);
      edgeN += 1;
    }
  }

  return {
    laplacian: variance(lap),
    brightness,
    edgeEnergy: edgeN === 0 ? 0 : edgeSum / edgeN,
  };
}

export type QualityKind = "ok" | "hair" | "light";

export function classifyEarQuality(
  quality: EarQuality | null,
  thresholds: {
    laplacianMin: number;
    brightnessMin: number;
    brightnessMax: number;
    minEdgeEnergy: number;
  },
): QualityKind {
  if (!quality) return "hair";
  if (
    quality.laplacian < thresholds.laplacianMin ||
    quality.edgeEnergy < thresholds.minEdgeEnergy
  ) {
    return "hair";
  }
  if (
    quality.brightness < thresholds.brightnessMin ||
    quality.brightness > thresholds.brightnessMax
  ) {
    return "light";
  }
  return "ok";
}
