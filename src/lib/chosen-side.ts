import type { EarSide } from "../config";

export const SIDE_STORAGE_KEY = "auto-ear-detect:chosen-side:v1";

export function parseChosenSide(
  raw: string | null | undefined,
): EarSide | null {
  return raw === "leftEar" || raw === "rightEar" ? raw : null;
}

export function isSideChosen(
  side: EarSide | null | undefined,
): side is EarSide {
  return side === "leftEar" || side === "rightEar";
}

/** Cold start: no stored pick means the user has not chosen a body side yet. */
export function loadChosenSide(): EarSide | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return parseChosenSide(localStorage.getItem(SIDE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveChosenSide(side: EarSide): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SIDE_STORAGE_KEY, side);
  } catch {
    // ignore quota / privacy errors
  }
}

/**
 * Capture (manual or auto-shutter) stays off until a body side is chosen,
 * even if guidance would otherwise be READY.
 */
export function gateCapture(input: {
  side: EarSide | null | undefined;
  guidanceAllowCapture: boolean;
  stuck?: boolean;
  capturedThisSide?: boolean;
}): boolean {
  if (!isSideChosen(input.side)) return false;
  return (
    input.guidanceAllowCapture &&
    !input.stuck &&
    !input.capturedThisSide
  );
}
