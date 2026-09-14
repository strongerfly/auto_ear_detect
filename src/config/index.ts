import poseConfigJson from "./pose-config.json";

export type EarSide = "leftEar" | "rightEar";

export type PromptKey =
  | "NO_FACE"
  | "TOO_FAR"
  | "TOO_CLOSE"
  | "FIX_ROLL"
  | "PITCH_DOWN"
  | "PITCH_UP"
  | "SWEEP_RIGHT_EAR"
  | "SWEEP_LEFT_EAR"
  | "TURN_MORE"
  | "TURN_BACK"
  | "TURN_BACK_OVERSHOOT"
  | "SLOW_DOWN"
  | "WRONG_SIDE"
  | "CLEAR_HAIR"
  | "HOLD_STILL"
  | "NEAR_PEAK"
  | "BAD_LIGHT"
  | "TOO_DARK"
  | "TOO_BRIGHT"
  | "MULTI_FACE"
  | "READY"
  | "INTRO_LEFT"
  | "INTRO_RIGHT"
  | "PICK_SIDE"
  | "STUCK_NO_PROGRESS"
  | "SOFT_READY"
  | "EAR_OUT_OF_FRAME";

export type PoseConfig = typeof poseConfigJson;

export const poseConfig: PoseConfig = poseConfigJson;

export const PROMPT_KEYS: PromptKey[] = [
  "NO_FACE",
  "TOO_FAR",
  "TOO_CLOSE",
  "FIX_ROLL",
  "PITCH_DOWN",
  "PITCH_UP",
  "SWEEP_RIGHT_EAR",
  "SWEEP_LEFT_EAR",
  "TURN_MORE",
  "TURN_BACK",
  "TURN_BACK_OVERSHOOT",
  "SLOW_DOWN",
  "WRONG_SIDE",
  "CLEAR_HAIR",
  "HOLD_STILL",
  "NEAR_PEAK",
  "BAD_LIGHT",
  "TOO_DARK",
  "TOO_BRIGHT",
  "MULTI_FACE",
  "READY",
  "INTRO_LEFT",
  "INTRO_RIGHT",
  "PICK_SIDE",
  "STUCK_NO_PROGRESS",
  "SOFT_READY",
  "EAR_OUT_OF_FRAME",
];
