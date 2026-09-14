import type { PromptKey } from "../config";
import type { Locale } from "./locale";

export type TranslateVars = Record<string, string | number>;

type UiMessageKey =
  | "appTitle"
  | "language"
  | "shootLeftEar"
  | "shootRightEar"
  | "sideAriaLabel"
  | "openCamera"
  | "closeCamera"
  | "capture"
  | "autoShutter"
  | "downloadLast"
  | "relearn"
  | "lastCaptureCaption"
  | "lastCaptureAlt"
  | "footer"
  | "loadingLandmarker"
  | "clickToStart"
  | "modelLoadFailed"
  | "simMode"
  | "cameraError"
  | "cameraDenied"
  | "cameraOff"
  | "previewHint"
  | "learningNote"
  | "learnedNote"
  | "captured"
  | "hudBest"
  | "hudLearning"
  | "simSummary"
  | "simEnable"
  | "simHasFace"
  | "simFaceHeight"
  | "simSharpness"
  | "simBrightness"
  | "simQualityFollowsYaw"
  | "simPeakYaw"
  | "simPeakSharpness"
  | "roiRight"
  | "roiLeft"
  | "simStillRight"
  | "simStillLeft"
  | "helpTitle"
  | "helpIntro"
  | "helpTurnHeading"
  | "helpTurnBody"
  | "helpStuckHeading"
  | "helpStuckBody"
  | "helpLimitsHeading"
  | "helpLimitsBody";

export type MessageKey = PromptKey | UiMessageKey;

type Messages = Record<MessageKey, string>;

const zh: Messages = {
  NO_FACE: "请把脸移入取景框",
  TOO_FAR: "请靠近一点",
  TOO_CLOSE: "请稍远一点，露出整只耳朵",
  FIX_ROLL: "头摆正一点，不要歪",
  PITCH_DOWN: "稍微低头",
  PITCH_UP: "稍微抬头",
  SWEEP_RIGHT_EAR: "拍右耳：慢慢向左转，找到耳朵最清楚的角度",
  SWEEP_LEFT_EAR: "拍左耳：慢慢向右转，找到耳朵最清楚的角度",
  TURN_MORE: "再转一点点",
  TURN_BACK: "往回一点，朝更清楚的那边",
  TURN_BACK_OVERSHOOT: "到头了，往回一点",
  SLOW_DOWN: "转慢一点",
  WRONG_SIDE: "方向反了，按提示转，不要跟着镜子反着来",
  CLEAR_HAIR: "拨开耳边头发（糊了或反光也先试试）",
  HOLD_STILL: "很好，保持不动",
  HOLD_NEAR_PEAK: "很好，请保持不动",
  BAD_LIGHT: "光线不太好，换亮一点的地方",
  TOO_DARK: "太暗了，换亮一点",
  TOO_BRIGHT: "太亮了，避开强光",
  MULTI_FACE: "画面里请只留一张脸",
  READY: "可以拍了",
  FAIL_TIMEOUT: "还没找到清晰角度，请拨开头发后再试一次",
  FAIL_TRACKING: "脸跟丢了，请正对屏幕后重新转头",

  appTitle: "耳廓引导拍摄",
  language: "语言",
  shootLeftEar: "拍左耳",
  shootRightEar: "拍右耳",
  sideAriaLabel: "拍摄侧",
  openCamera: "打开摄像头",
  closeCamera: "关闭",
  capture: "拍摄",
  autoShutter: "自动快门",
  downloadLast: "下载上次拍摄",
  relearn: "重新学习此侧",
  lastCaptureCaption: "刚拍好（保存的照片不是镜像，左右和真人一样）",
  lastCaptureAlt: "刚拍好的耳部照片",
  footer: "左右指身体的左右。预览像镜子，保存的照片不是。",
  loadingLandmarker: "正在加载 Face Landmarker…",
  clickToStart: "点「打开摄像头」开始。慢慢转，找到耳朵最清楚的角度。",
  modelLoadFailed: "模型加载失败：{error}。仍可用姿态模拟器。",
  simMode: "模拟模式",
  cameraError: "摄像头：{error}",
  cameraDenied:
    "摄像头被拒绝了。请在浏览器设置里允许这个网站使用摄像头。",
  cameraOff: "摄像头未开启",
  previewHint: "前置预览像镜子 · 保存的照片不是",
  learningNote: "慢慢转，系统会在后台自动找这侧最清楚的角度",
  learnedNote: "已记住此侧最清楚的角度",
  captured: "拍好了",
  hudBest: "最清楚",
  hudLearning: "学习中",
  simSummary: "姿态模拟器（没有摄像头也能试引导）",
  simEnable: "启用模拟",
  simHasFace: "画面中有脸",
  simFaceHeight: "脸高比",
  simSharpness: "清晰度",
  simBrightness: "亮度",
  simQualityFollowsYaw: "质量随角度变化（给开发者试引导）",
  simPeakYaw: "质量峰值角度",
  simPeakSharpness: "峰值清晰度",
  roiRight: "右耳",
  roiLeft: "左耳",
  simStillRight: "右耳 · 模拟拍摄",
  simStillLeft: "左耳 · 模拟拍摄",

  helpTitle: "使用说明",
  helpIntro: "语言切换在页头：中文 / English。",
  helpTurnHeading: "能做什么",
  helpTurnBody:
    "用前置摄像头。先点「拍左耳」或「拍右耳」（身体的左右，不是镜子）。按提示慢慢转头，系统会记住这侧最清楚的角度。等到「可以拍了」再拍；默认开着自动快门，到点会自己拍。拍完一侧再换另一侧。",
  helpStuckHeading: "做不到",
  helpStuckBody:
    "不是医院耳镜。一次只拍一只耳朵，也不会检查你是不是点错了侧。头要大致摆正、稳住，脸在框里、距离合适。太暗或头发挡住会失败。只有侧着转头时才会学习——几乎正面或转到后脑勺都不算。预览像镜子，保存的照片不是。",
  helpLimitsHeading: "小提示",
  helpLimitsBody:
    "拨开头发，光线好一点，慢慢转、停一停。拍右耳 → 向左转头；拍左耳 → 向右转头。角度不对就点「重新学习此侧」。",
};

const en: Messages = {
  NO_FACE: "Move your face into the frame",
  TOO_FAR: "Move a little closer",
  TOO_CLOSE: "Move a little farther so the whole ear is in view",
  FIX_ROLL: "Straighten your head — don't tilt",
  PITCH_DOWN: "Tuck your chin a little",
  PITCH_UP: "Lift your chin a little",
  SWEEP_RIGHT_EAR:
    "Right ear: turn slowly left until the ear looks clearest",
  SWEEP_LEFT_EAR:
    "Left ear: turn slowly right until the ear looks clearest",
  TURN_MORE: "A little more",
  TURN_BACK: "Ease back toward the clearer pose",
  TURN_BACK_OVERSHOOT: "That's as far as it goes — ease back",
  SLOW_DOWN: "Turn a bit slower",
  WRONG_SIDE: "Other way — follow the prompt, not the mirror",
  CLEAR_HAIR: "Tuck hair away from the ear (also try this if it's blurry or shiny)",
  HOLD_STILL: "Good — hold still",
  HOLD_NEAR_PEAK: "Good — hold still",
  BAD_LIGHT: "Lighting is poor — move somewhere brighter",
  TOO_DARK: "Too dark — find a brighter spot",
  TOO_BRIGHT: "Too bright — ease off the glare",
  MULTI_FACE: "Keep just one face in the frame",
  READY: "Ready to capture",
  FAIL_TIMEOUT: "No clear angle yet — tuck hair and try another slow turn",
  FAIL_TRACKING: "Lost your face — look at the screen and turn again",

  appTitle: "Head-pose ear capture",
  language: "Language",
  shootLeftEar: "Left ear",
  shootRightEar: "Right ear",
  sideAriaLabel: "Capture side",
  openCamera: "Open camera",
  closeCamera: "Close",
  capture: "Capture",
  autoShutter: "Auto-shutter",
  downloadLast: "Download last capture",
  relearn: "Relearn this side",
  lastCaptureCaption:
    "Just captured (saved photo is not mirrored — left/right match real life)",
  lastCaptureAlt: "Just captured ear photo",
  footer:
    "Left/right means your body, not the screen. Preview is a mirror; saved photos are not.",
  loadingLandmarker: "Loading Face Landmarker…",
  clickToStart:
    "Click “Open camera” to begin. Turn slowly until the ear looks clearest.",
  modelLoadFailed:
    "Model failed to load: {error}. You can still use the pose simulator.",
  simMode: "Simulator mode",
  cameraError: "Camera: {error}",
  cameraDenied:
    "Camera access was denied. Allow this site in your browser settings.",
  cameraOff: "Camera is off",
  previewHint: "Front preview is a mirror · saved photos are not",
  learningNote:
    "Turn slowly — the app finds the clearest angle for this side in the background",
  learnedNote: "Remembered the clearest angle for this side",
  captured: "Captured",
  hudBest: "Clearest",
  hudLearning: "Learning",
  simSummary: "Pose simulator (try guidance without a webcam)",
  simEnable: "Enable simulator",
  simHasFace: "Face in frame",
  simFaceHeight: "Face height ratio",
  simSharpness: "Sharpness",
  simBrightness: "Brightness",
  simQualityFollowsYaw: "Quality follows angle (for trying guidance)",
  simPeakYaw: "Peak-quality angle",
  simPeakSharpness: "Peak sharpness",
  roiRight: "Right ear",
  roiLeft: "Left ear",
  simStillRight: "Right ear · simulated capture",
  simStillLeft: "Left ear · simulated capture",

  helpTitle: "Instructions",
  helpIntro: "Language switching is in the page header: 中文 / English.",
  helpTurnHeading: "Can",
  helpTurnBody:
    "Use the front camera. Tap Left ear or Right ear first (your body, not the mirror). Turn slowly as prompted — the app remembers the clearest angle for that side. Shoot when it says Ready; auto-shutter is on by default and will take the shot. Then switch sides for the other ear.",
  helpStuckHeading: "Cannot",
  helpStuckBody:
    "Not a clinical ear scanner. One ear at a time, and it won’t check that you picked the correct side. Keep your head roughly upright and steady, face in frame, at a comfortable distance. Dark scenes or hair over the ear fail. It only learns while you turn to the side — not almost frontal, not past the back of the head. The preview is a mirror; the saved photo is not.",
  helpLimitsHeading: "Tips",
  helpLimitsBody:
    "Clear hair, use good light, turn slowly and pause. Right ear → turn your head left; left ear → turn your head right. If the angle is wrong, tap Relearn this side.",
};

const catalogs: Record<Locale, Messages> = { zh, en };

export function interpolate(
  template: string,
  vars?: TranslateVars,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name)
      ? String(vars[name])
      : match,
  );
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: TranslateVars,
): string {
  const table = catalogs[locale] ?? catalogs.en;
  const template = table[key] ?? catalogs.en[key] ?? key;
  return interpolate(template, vars);
}

export function messagesFor(locale: Locale): Messages {
  return catalogs[locale] ?? catalogs.en;
}

const RIGID_USER_COPY =
  /70\s*[–-]\s*90|60\s*[–-]\s*95|\|yaw\||±\s*15|FISWG|\+yaw|校准此侧偏移|calibrate this side/i;

export function userFacingKeys(): MessageKey[] {
  return [
    ...Object.keys(zh).filter((key) => key.startsWith("help")) as MessageKey[],
    "SWEEP_RIGHT_EAR",
    "SWEEP_LEFT_EAR",
    "TURN_MORE",
    "TURN_BACK",
    "TURN_BACK_OVERSHOOT",
    "learningNote",
    "relearn",
    "clickToStart",
    "helpStuckBody",
    "helpLimitsBody",
  ];
}

export function looksLikeRigidAngleChecklist(text: string): boolean {
  return RIGID_USER_COPY.test(text);
}
