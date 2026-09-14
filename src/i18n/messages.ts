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
  | "autoShutterCountdown"
  | "cancelAutoShutter"
  | "downloadLast"
  | "relearn"
  | "RELEARN"
  | "relearnConfirm"
  | "relearnCancel"
  | "debugHud"
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
  | "CAPTURED"
  | "LIMITS_HINT"
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
  | "helpLimitsBody"
  | "stuckRetry"
  | "captureNearPeak"
  | "captureOffPeak"
  | "retake"
  | "shootOtherEar";

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
  TURN_BACK_OVERSHOOT: "到头了，往回一点——刚才那边更清楚",
  SLOW_DOWN: "转慢一点",
  WRONG_SIDE:
    "方向反了：拍右耳向左转，拍左耳向右转（身体的左右，不要跟着镜子）",
  CLEAR_HAIR: "拨开耳边头发（糊了或反光也先试试）",
  HOLD_STILL: "很好，保持不动",
  NEAR_PEAK: "快到了，慢慢对准最清楚的角度",
  BAD_LIGHT: "光线不太好，换亮一点的地方",
  TOO_DARK: "太暗了，换亮一点",
  TOO_BRIGHT: "太亮了，避开强光",
  MULTI_FACE: "画面里请只留一张脸",
  READY: "可以拍了",
  INTRO_LEFT: "现在拍左耳（身体的左耳，不是镜子）。慢慢向右转。",
  INTRO_RIGHT: "现在拍右耳（身体的右耳，不是镜子）。慢慢向左转。",
  STUCK_NO_PROGRESS:
    "这侧一直没更清楚。拨开头发、换亮一点，或重新学习后再慢慢转。",
  SOFT_READY: "这是这侧目前最清楚的角度，可以拍；看起来不对就重新学习。",
  EAR_OUT_OF_FRAME: "耳朵出画了，挪一挪把整只耳朵留在画面里",

  appTitle: "耳廓引导拍摄",
  language: "语言",
  shootLeftEar: "拍左耳",
  shootRightEar: "拍右耳",
  sideAriaLabel: "拍摄侧",
  openCamera: "打开摄像头",
  closeCamera: "关闭",
  capture: "拍摄",
  autoShutter: "自动快门",
  autoShutterCountdown: "自动拍摄还有 {seconds} 秒",
  cancelAutoShutter: "取消自动拍摄",
  downloadLast: "下载上次拍摄",
  relearn: "重新学习此侧",
  RELEARN: "重新学习此侧",
  relearnConfirm: "确认清除此侧记录？",
  relearnCancel: "取消",
  debugHud: "调试：显示角度",
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
  learningNote: "先慢转过头，系统会记住这侧最清楚的角度；转够之前拍摄按钮是灰的",
  learnedNote: "已记住此侧最清楚的角度",
  captured: "拍好了",
  CAPTURED: "拍好了",
  LIMITS_HINT:
    "不是医院耳镜。一次一只耳朵。太暗、太亮或多张脸拍不了。转过头就往回一点，朝刚才更清楚的那边。角度不对就点「重新学习此侧」。接着拍另一侧时自己点另一侧。",
  hudBest: "最清楚",
  hudLearning: "学习中",
  stuckRetry: "再试一次",
  captureNearPeak: "这张接近这侧最清楚的角度。",
  captureOffPeak: "比刚才最清楚的时候稍差一点，可以重拍。",
  retake: "重拍",
  shootOtherEar: "拍另一只耳",
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
  helpTurnHeading: "怎么转",
  helpTurnBody:
    "用前置摄像头。先点「拍左耳」或「拍右耳」（身体的左右，不是镜子）。切换左右会重新引导这一侧，另一侧记住的角度还在。拍右耳 → 向左转头；拍左耳 → 向右转头。转的是头，不是电脑或手机。跟着提示走，不要对着镜子反着学。按提示慢慢转头，系统会记住这侧最清楚的角度。\n\n转过头很正常：「往回一点」是朝刚才更清楚的那边转回去，别继续转到后脑勺。转到头了会说「到头了，往回一点」。往回走时先稳住，不要再转更侧。转太快会提示「转慢一点」。\n\n提示「方向反了」是转头方向反了，不是点错了左/右。框在另一只耳朵上时，点另一侧按钮，系统不会自己换。拍完一侧，接着拍另一侧：再点另一侧重转。等到「可以拍了」再拍；默认开着自动快门，倒计时出现时可点「取消自动拍摄」。拍完可重拍或换另一只耳。",
  helpStuckHeading: "拍不了的时候",
  helpStuckBody:
    "第一次要慢慢转过，系统才会记住这一侧。拍摄按钮是灰的，常见有两种原因：还没学完这一侧；或者已经记住了但还没对准最清楚的角度（提示「快到了」）。等到「可以拍了」才能点。默认开着自动快门，出现「可以拍了」会倒计时，需要的话点「取消自动拍摄」。\n\n摄像头被拒：到浏览器设置里允许这个网站使用摄像头。头发挡住、糊了或反光：拨开头发（糊了或反光也先试试），换亮一点。转了很久仍没更清楚时，会出现「再试一次 / 重新学习 / 拨开头发换亮一点」，不会只留一个灰色快门。\n\n换了发型或眼镜、角度记错、一直出不了「可以拍了」：点「重新学习此侧」（再确认一次，只清这一侧记住的角度），再慢慢转一次。误点确认的话，拍不了，直到重新学会。",
  helpLimitsHeading: "小提示",
  helpLimitsBody:
    "不是医院耳镜，一次一只耳朵，也不会检查你是不是点错了侧。头大致摆正、脸在框里、距离合适。太暗、太亮或头发挡住会失败。只有侧着转头时才会学习——几乎正面或转到后脑勺都不算。预览像镜子，保存的照片不是，左右和真人一样。拍完会告诉你这张是否接近最清楚的角度，没有绝对度数。",
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
  TURN_BACK_OVERSHOOT:
    "That's as far as it goes — ease back; it looked clearer just before",
  SLOW_DOWN: "Turn a bit slower",
  WRONG_SIDE:
    "Wrong way: right ear → turn left; left ear → turn right (your body, not the mirror)",
  CLEAR_HAIR: "Tuck hair away from the ear (also try this if it's blurry or shiny)",
  HOLD_STILL: "Good — hold still",
  NEAR_PEAK: "Almost there — ease into the clearest angle",
  BAD_LIGHT: "Lighting is poor — move somewhere brighter",
  TOO_DARK: "Too dark — find a brighter spot",
  TOO_BRIGHT: "Too bright — ease off the glare",
  MULTI_FACE: "Keep just one face in the frame",
  READY: "Ready to capture",
  INTRO_LEFT:
    "Now the left ear (your body, not the mirror). Turn slowly right.",
  INTRO_RIGHT:
    "Now the right ear (your body, not the mirror). Turn slowly left.",
  STUCK_NO_PROGRESS:
    "This side isn’t getting clearer. Tuck hair, find better light, or tap Relearn and turn slowly again.",
  SOFT_READY:
    "This is the clearest we found for this ear — capture, or relearn if it looks off.",
  EAR_OUT_OF_FRAME:
    "The ear is out of frame — shift so the whole ear is in view",

  appTitle: "Head-pose ear capture",
  language: "Language",
  shootLeftEar: "Left ear",
  shootRightEar: "Right ear",
  sideAriaLabel: "Capture side",
  openCamera: "Open camera",
  closeCamera: "Close",
  capture: "Capture",
  autoShutter: "Auto-shutter",
  autoShutterCountdown: "Auto-capturing in {seconds}s",
  cancelAutoShutter: "Cancel auto-capture",
  downloadLast: "Download last capture",
  relearn: "Relearn this side",
  RELEARN: "Relearn this side",
  relearnConfirm: "Clear this side’s remembered angle?",
  relearnCancel: "Cancel",
  debugHud: "Debug: show angles",
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
    "Sweep slowly past the clearest angle first — capture stays grey until then",
  learnedNote: "Remembered the clearest angle for this side",
  captured: "Captured",
  CAPTURED: "Captured",
  LIMITS_HINT:
    "Not a clinical ear scanner. One ear at a time. Too dark, too bright, or extra faces won’t capture. If you turn past the clearest pose, ease back. If the angle is wrong, tap Relearn this side. After one ear, tap the other side yourself.",
  hudBest: "Clearest",
  hudLearning: "Learning",
  stuckRetry: "Try again",
  captureNearPeak: "This is close to the clearest angle we found for this ear.",
  captureOffPeak: "A bit off the clearest moment — retake if you want.",
  retake: "Retake",
  shootOtherEar: "Shoot the other ear",
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
  helpTurnHeading: "How to turn",
  helpTurnBody:
    "Use the front camera. Tap Left ear or Right ear first (your body, not the mirror). Switching sides restarts guidance for that ear and keeps the other side’s remembered angle. Right ear → turn your head left; left ear → turn your head right. Turn your head, not the laptop or phone. Follow the prompt; don’t copy the mirror. Turn slowly as prompted — the app remembers the clearest angle for that side.\n\nOvershoot is normal: “ease back” means toward the clearer pose, not past the back of your head. At the far edge you’ll see “that’s as far as it goes — ease back.” While you return, hold; don’t keep turning farther. If you turn too fast, it asks you to slow down.\n\n“Other way” is the turn direction, not the wrong ear tab. If the box is on the other ear, tap the other side — the app won’t switch for you. After one ear, tap the other side and turn again. Shoot when it says Ready; auto-shutter is on by default and shows a countdown you can cancel. After a shot you can retake or switch ears.",
  helpStuckHeading: "If it won’t capture",
  helpStuckBody:
    "The first time, capture stays off until you’ve slowly swept so the app can learn that side — the button stays grey. It also stays grey after a peak is remembered if you’re not yet on the clearest pose (you’ll see Almost there). You can tap Capture only when it says Ready. Auto-shutter is on by default and starts a countdown then — tap Cancel auto-capture if you need to stop it.\n\nCamera denied: allow this site in your browser settings. Hair, blur, or glare: tuck hair aside (try this for blur or shine too) and find better light. If nothing gets clearer for a while, you’ll get Try again / Relearn / tuck hair and find better light — not a dead grey shutter.\n\nWrong lock, new glasses or haircut, or you never reach Ready: tap Relearn this side (confirm once; clears this side only) and turn slowly again. An accidental tap to confirm blocks capture until that side is relearned.",
  helpLimitsHeading: "Tips",
  helpLimitsBody:
    "Not a clinical ear scanner. One ear at a time, and it won’t check that you picked the correct side. Keep your head roughly upright, face in frame, at a comfortable distance. Dark, bright, or hair-blocked shots fail. It only learns while you turn to the side — not almost frontal, not past the back of the head. The preview is a mirror; the saved photo is not — left/right match real life. After a shot you’ll hear whether it was near the clearest angle — no absolute degrees.",
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
  /70\s*[–-]\s*90|60\s*[–-]\s*95|\|yaw\||±\s*15|FISWG|\+yaw|校准此侧偏移|校准|calibrate this side|calibrat/i;

export function userFacingKeys(): MessageKey[] {
  return [
    ...Object.keys(zh).filter((key) => key.startsWith("help")) as MessageKey[],
    "SWEEP_RIGHT_EAR",
    "SWEEP_LEFT_EAR",
    "TURN_MORE",
    "TURN_BACK",
    "TURN_BACK_OVERSHOOT",
    "WRONG_SIDE",
    "NEAR_PEAK",
    "HOLD_STILL",
    "MULTI_FACE",
    "TOO_DARK",
    "TOO_BRIGHT",
    "learningNote",
    "relearn",
    "RELEARN",
    "relearnConfirm",
    "captured",
    "CAPTURED",
    "LIMITS_HINT",
    "clickToStart",
    "helpStuckBody",
    "helpLimitsBody",
    "lastCaptureCaption",
    "footer",
    "previewHint",
    "autoShutterCountdown",
    "cancelAutoShutter",
    "INTRO_LEFT",
    "INTRO_RIGHT",
    "STUCK_NO_PROGRESS",
    "SOFT_READY",
    "EAR_OUT_OF_FRAME",
    "stuckRetry",
    "captureNearPeak",
    "captureOffPeak",
    "retake",
    "shootOtherEar",
  ];
}

export function looksLikeRigidAngleChecklist(text: string): boolean {
  return RIGID_USER_COPY.test(text);
}
