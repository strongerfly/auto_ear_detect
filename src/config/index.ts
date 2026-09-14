import poseConfigJson from "./pose-config.json";

export type EarSide = "leftEar" | "rightEar";

export type PromptKey =
  | "NO_FACE"
  | "TOO_FAR"
  | "TOO_CLOSE"
  | "FIX_ROLL"
  | "PITCH_DOWN"
  | "PITCH_UP"
  | "TURN_LEFT"
  | "TURN_LEFT_MORE"
  | "TURN_LEFT_BACK"
  | "TURN_RIGHT"
  | "TURN_RIGHT_MORE"
  | "TURN_RIGHT_BACK"
  | "CLEAR_HAIR"
  | "HOLD_STILL"
  | "BAD_LIGHT"
  | "READY";

export type PoseConfig = typeof poseConfigJson;

export const poseConfig: PoseConfig = poseConfigJson;

export const PROMPT_KEYS = Object.keys(poseConfig.copy) as PromptKey[];
