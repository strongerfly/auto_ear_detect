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
  | "calibrate"
  | "finishCalibrate"
  | "clearOffset"
  | "lastCaptureCaption"
  | "lastCaptureAlt"
  | "footer"
  | "loadingLandmarker"
  | "clickToStart"
  | "modelLoadFailed"
  | "simMode"
  | "cameraError"
  | "cameraOff"
  | "previewHint"
  | "calibNote"
  | "qualityNote"
  | "hudOffset"
  | "simSummary"
  | "simEnable"
  | "simHasFace"
  | "simFaceHeight"
  | "simSharpness"
  | "simBrightness"
  | "roiRight"
  | "roiLeft"
  | "simStillRight"
  | "simStillLeft"
  | "helpTitle"
  | "helpIntro"
  | "helpTurnHeading"
  | "helpTurnBody"
  | "helpSideHeading"
  | "helpSideBody"
  | "helpCalibrateHeading"
  | "helpCalibrateBody"
  | "helpReadyHeading"
  | "helpReadyBody"
  | "helpMirror";

export type MessageKey = PromptKey | UiMessageKey;

type Messages = Record<MessageKey, string>;

const zh: Messages = {
  NO_FACE: "请把脸移入取景框",
  TOO_FAR: "请靠近一点",
  TOO_CLOSE: "请稍远一点",
  FIX_ROLL: "请摆正脑袋，不要歪头",
  PITCH_DOWN: "请稍微低头",
  PITCH_UP: "请稍微抬头",
  TURN_LEFT: "请向左转头，露出右耳",
  TURN_LEFT_MORE: "再向左转一点",
  TURN_LEFT_BACK: "转得有点过了，往回一点",
  TURN_RIGHT: "请向右转头，露出左耳",
  TURN_RIGHT_MORE: "再向右转一点",
  TURN_RIGHT_BACK: "转得有点过了，往回一点",
  CLEAR_HAIR: "请把耳边头发拨开",
  HOLD_STILL: "很好，请保持不动",
  BAD_LIGHT: "光线不太好，换亮一点的地方",
  READY: "可以拍了",

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
  calibrate: "校准此侧偏移",
  finishCalibrate: "完成校准",
  clearOffset: "清除此侧偏移",
  lastCaptureCaption: "上次拍摄（未镜像，解剖左右）",
  lastCaptureAlt: "上次拍摄的耳部照片",
  footer:
    "FISWG：+yaw 露右耳，−yaw 露左耳。Euler 顺序 YXZ。阈值见 src/config/pose-config.json，界面文案见 src/i18n。",
  loadingLandmarker: "正在加载 Face Landmarker…",
  clickToStart:
    "点击「打开摄像头」开始。前置预览已镜像，姿态按未翻转画面估计。",
  modelLoadFailed: "模型加载失败：{error}。仍可用姿态模拟器。",
  simMode: "模拟模式",
  cameraError: "摄像头：{error}",
  cameraOff: "摄像头未开启",
  previewHint: "前置预览（CSS 镜像）· 推理用未翻转帧",
  calibNote: "请慢慢转头（|yaw| 60–95°），峰值清晰度 {peak}",
  qualityNote:
    "耳区 Laplacian {laplacian} · 亮度 {brightness} · 边缘 {edge}",
  hudOffset: "偏移",
  simSummary: "姿态模拟器（无摄像头时可验证引导）",
  simEnable: "启用模拟",
  simHasFace: "画面中有脸",
  simFaceHeight: "脸高比",
  simSharpness: "清晰度",
  simBrightness: "亮度",
  roiRight: "右耳 ROI",
  roiLeft: "左耳 ROI",
  simStillRight: "右耳 · 模拟拍摄",
  simStillLeft: "左耳 · 模拟拍摄",

  helpTitle: "使用说明",
  helpIntro:
    "本应用通过头部姿态引导，拍摄一侧耳廓朝向镜头的照片。先选左右耳，按提示转头，等到「可以拍了」再拍。",
  helpTurnHeading: "是转头，不是歪头",
  helpTurnBody:
    "向左或向右转头（yaw）才能让目标耳朵朝向摄像头。向肩膀歪头（roll）或抬头/低头（pitch）是另一种动作——请先摆正，再转头。",
  helpSideHeading: "先选择左耳或右耳",
  helpSideBody:
    "拍摄前点「拍左耳」或「拍右耳」。+yaw 露出右耳，−yaw 露出左耳。引导文案说的是你身体的左/右，不是屏幕上的左/右。",
  helpCalibrateHeading: "耳角度不同时可校准",
  helpCalibrateBody:
    "有些人最佳侧面角度略有偏差。使用「校准此侧偏移」，在 |yaw| 为 60–95° 时慢慢转头；耳区最清晰时的 yaw 会记为个人偏移（限制在 ±15°）。",
  helpReadyHeading: "等到「可以拍了」",
  helpReadyBody:
    "只有姿态进入就绪区间、连续多帧稳定、且耳区清晰、光线合适时才会启用拍摄（以及可选自动快门）。请等到提示变为「可以拍了」。",
  helpMirror:
    "前置预览为镜像，方便对照；保存的照片未镜像，解剖左右与 FISWG 一致。",
};

const en: Messages = {
  NO_FACE: "Move your face into the frame",
  TOO_FAR: "Move a little closer",
  TOO_CLOSE: "Move a little farther away",
  FIX_ROLL: "Straighten your head — don't tilt",
  PITCH_DOWN: "Tuck your chin slightly",
  PITCH_UP: "Lift your chin slightly",
  TURN_LEFT: "Turn your head left to show the right ear",
  TURN_LEFT_MORE: "Turn a bit more to the left",
  TURN_LEFT_BACK: "A bit too far — ease back",
  TURN_RIGHT: "Turn your head right to show the left ear",
  TURN_RIGHT_MORE: "Turn a bit more to the right",
  TURN_RIGHT_BACK: "A bit too far — ease back",
  CLEAR_HAIR: "Tuck hair away from the ear",
  HOLD_STILL: "Good — hold still",
  BAD_LIGHT: "Lighting is poor — move to a brighter spot",
  READY: "Ready to capture",

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
  calibrate: "Calibrate this side",
  finishCalibrate: "Finish calibration",
  clearOffset: "Clear this side's offset",
  lastCaptureCaption: "Last capture (unmirrored, anatomical L/R)",
  lastCaptureAlt: "Last captured ear photo",
  footer:
    "FISWG: +yaw shows the right ear, −yaw the left. Euler order YXZ. Thresholds in src/config/pose-config.json; UI copy in src/i18n.",
  loadingLandmarker: "Loading Face Landmarker…",
  clickToStart:
    "Click “Open camera” to begin. The front preview is mirrored; pose is estimated from the unflipped frame.",
  modelLoadFailed: "Model failed to load: {error}. You can still use the pose simulator.",
  simMode: "Simulator mode",
  cameraError: "Camera: {error}",
  cameraOff: "Camera is off",
  previewHint: "Front preview (CSS-mirrored) · inference uses the unflipped frame",
  calibNote: "Turn slowly (|yaw| 60–95°). Peak sharpness {peak}",
  qualityNote:
    "Ear ROI Laplacian {laplacian} · brightness {brightness} · edges {edge}",
  hudOffset: "Offset",
  simSummary: "Pose simulator (exercise guidance without a webcam)",
  simEnable: "Enable simulator",
  simHasFace: "Face in frame",
  simFaceHeight: "Face height ratio",
  simSharpness: "Sharpness",
  simBrightness: "Brightness",
  roiRight: "Right ear ROI",
  roiLeft: "Left ear ROI",
  simStillRight: "Right ear · simulated capture",
  simStillLeft: "Left ear · simulated capture",

  helpTitle: "Instructions",
  helpIntro:
    "This app captures a photo of one ear facing the camera by guiding your head pose. Choose left or right ear, follow the prompts, and wait for “Ready to capture”.",
  helpTurnHeading: "Turn, don’t tilt",
  helpTurnBody:
    "Rotate your head left or right (yaw) so the chosen ear faces the camera. Tilting toward a shoulder (roll) or looking up/down (pitch) is a different motion — straighten those first, then turn.",
  helpSideHeading: "Choose left or right ear",
  helpSideBody:
    "Tap “Left ear” or “Right ear” before you start. +yaw shows the right ear; −yaw shows the left. Guidance refers to your physical left/right, not screen-left.",
  helpCalibrateHeading: "Calibrate if your ear angle differs",
  helpCalibrateBody:
    "Some ears look best at a slightly different profile angle. Use “Calibrate this side” and slowly turn while |yaw| is 60–95°. The yaw at peak ear sharpness becomes a personal offset (clamped ±15°).",
  helpReadyHeading: "Wait for READY",
  helpReadyBody:
    "Capture is enabled (and optional auto-shutter fires) only when the pose is in the ready band, stable for several frames, and the ear region is sharp and well-lit. Wait until the prompt says “Ready to capture”.",
  helpMirror:
    "The front-camera preview is mirrored for comfort; saved photos are not, so anatomical left/right matches FISWG.",
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
