export type CameraNotice =
  | "sim"
  | "denied"
  | "missing"
  | "error"
  | "off"
  | "preview";

/**
 * Web/Android camera failure. `denied` and `missing` are both recoverable
 * (tap Open camera again) but they use different sentences. This is not a
 * HarmonyOS settings path.
 */
export function cameraNotice(input: {
  sim: boolean;
  camError: string | null;
  camReady: boolean;
}): CameraNotice {
  if (input.sim) return "sim";
  if (input.camError === "NotAllowedError") return "denied";
  if (input.camError === "NotFoundError") return "missing";
  if (input.camError) return "error";
  if (!input.camReady) return "off";
  return "preview";
}
