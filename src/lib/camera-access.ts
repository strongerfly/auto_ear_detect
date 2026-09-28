export type CameraNotice = "sim" | "denied" | "error" | "off" | "preview";

/**
 * Web/Android camera failure. `denied` is recoverable (retry getUserMedia
 * after the user allows the site). A missing camera is `error`, not the
 * permission sentence. This is not a HarmonyOS settings path.
 */
export function cameraNotice(input: {
  sim: boolean;
  camError: string | null;
  camReady: boolean;
}): CameraNotice {
  if (input.sim) return "sim";
  if (input.camError === "NotAllowedError") return "denied";
  if (input.camError) return "error";
  if (!input.camReady) return "off";
  return "preview";
}
