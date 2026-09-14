import type { EarSide } from "../config";
import { poseConfig } from "../config";

export type CaptureGrade = "nearPeak" | "offPeak";

export type CaptureFeedback = {
  side: EarSide;
  grade: CaptureGrade;
  scoreRatio: number;
};

/**
 * Grade a still against this side's remembered peak. Never returns degrees —
 * only whether the shot was near the clearest score we saw.
 */
export function gradeCapture(
  capturedScore: number,
  peakScore: number | null,
  ratioOfBest: number = poseConfig.ready.scoreRatioOfBest,
): CaptureGrade {
  if (peakScore == null || peakScore <= 0) return "nearPeak";
  if (!Number.isFinite(capturedScore)) return "offPeak";
  return capturedScore >= peakScore * ratioOfBest ? "nearPeak" : "offPeak";
}

export function captureFeedbackFor(
  side: EarSide,
  capturedScore: number,
  peakScore: number | null,
  ratioOfBest: number = poseConfig.ready.scoreRatioOfBest,
): CaptureFeedback {
  const safePeak = peakScore != null && peakScore > 0 ? peakScore : capturedScore;
  const scoreRatio =
    safePeak > 0 && Number.isFinite(capturedScore)
      ? capturedScore / safePeak
      : 1;
  return {
    side,
    grade: gradeCapture(capturedScore, peakScore, ratioOfBest),
    scoreRatio,
  };
}

export function otherEar(side: EarSide): EarSide {
  return side === "rightEar" ? "leftEar" : "rightEar";
}
