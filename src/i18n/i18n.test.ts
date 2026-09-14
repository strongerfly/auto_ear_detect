import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROMPT_KEYS } from "../config";
import {
  LOCALE_STORAGE_KEY,
  loadLocale,
  localeFromBrowserLanguage,
  saveLocale,
} from "./locale";
import {
  interpolate,
  looksLikeRigidAngleChecklist,
  messagesFor,
  translate,
  userFacingKeys,
} from "./messages";

afterEach(() => {
  localStorage.removeItem(LOCALE_STORAGE_KEY);
});

describe("locale detection", () => {
  it("maps zh* to zh and everything else to en", () => {
    expect(localeFromBrowserLanguage("zh")).toBe("zh");
    expect(localeFromBrowserLanguage("zh-CN")).toBe("zh");
    expect(localeFromBrowserLanguage("zh-TW")).toBe("zh");
    expect(localeFromBrowserLanguage("ZH-cn")).toBe("zh");
    expect(localeFromBrowserLanguage("en-US")).toBe("en");
    expect(localeFromBrowserLanguage("fr")).toBe("en");
    expect(localeFromBrowserLanguage("")).toBe("en");
    expect(localeFromBrowserLanguage(undefined)).toBe("en");
  });

  it("persists an override in localStorage", () => {
    saveLocale("zh");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh");
    expect(loadLocale()).toBe("zh");
    saveLocale("en");
    expect(loadLocale()).toBe("en");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "de");
    expect(loadLocale()).toBe(localeFromBrowserLanguage(navigator.language));
  });
});

describe("string lookup", () => {
  it("returns Chinese and English guidance for the same prompt key", () => {
    expect(translate("zh", "READY")).toBe("可以拍了");
    expect(translate("en", "READY")).toBe("Ready to capture");
    expect(translate("zh", "SWEEP_RIGHT_EAR")).toContain("慢慢向左转");
    expect(translate("en", "SWEEP_RIGHT_EAR")).toContain(
      "turn slowly left until the ear looks clearest",
    );
  });

  it("covers every prompt key in both locales", () => {
    for (const key of PROMPT_KEYS) {
      const zh = translate("zh", key);
      const en = translate("en", key);
      expect(zh.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(zh).not.toBe(en);
    }
  });

  it("updates UI chrome when the locale switches", () => {
    expect(translate("zh", "shootLeftEar")).toBe("拍左耳");
    expect(translate("en", "shootLeftEar")).toBe("Left ear");
    expect(translate("zh", "helpTitle")).toBe("使用说明");
    expect(translate("en", "helpTitle")).toBe("Instructions");
    expect(translate("zh", "relearn")).toBe("重新学习此侧");
    expect(translate("en", "relearn")).toBe("Relearn this side");
  });

  it("NEAR_PEAK does not tell the user to hold still", () => {
    expect(translate("zh", "NEAR_PEAK")).not.toMatch(/保持不动|很好，保持/);
    expect(translate("en", "NEAR_PEAK")).not.toMatch(/hold still/i);
    expect(translate("zh", "SWEEP_RIGHT_EAR")).toContain("慢慢向左转");
    expect(translate("zh", "HOLD_STILL")).toMatch(/保持不动/);
  });

  it("WRONG_SIDE names body left/right vs the target ear", () => {
    expect(translate("zh", "WRONG_SIDE")).toMatch(/拍右耳/);
    expect(translate("zh", "WRONG_SIDE")).toMatch(/拍左耳/);
    expect(translate("zh", "WRONG_SIDE")).toMatch(/身体/);
    expect(translate("en", "WRONG_SIDE")).toMatch(/right ear/i);
    expect(translate("en", "WRONG_SIDE")).toMatch(/left ear/i);
    expect(translate("en", "WRONG_SIDE")).toMatch(/body/i);
  });

  it("save-image copy says the preview is mirrored vs the body", () => {
    expect(translate("zh", "lastCaptureCaption")).toMatch(/镜像/);
    expect(translate("en", "lastCaptureCaption")).toMatch(/mirror/i);
    expect(translate("zh", "footer")).toMatch(/镜子/);
    expect(translate("en", "footer")).toMatch(/mirror/i);
  });

  it("has no calibrate-offset UX and a confirmable relearn", () => {
    for (const locale of ["zh", "en"] as const) {
      const table = messagesFor(locale);
      for (const key of Object.keys(table) as Array<keyof typeof table>) {
        expect(key).not.toMatch(/helpCalibrate/i);
        expect(table[key]).not.toMatch(/校准此侧偏移/);
      }
    }
    expect(translate("zh", "relearn")).toBe("重新学习此侧");
    expect(translate("zh", "relearnConfirm")).toMatch(/确认/);
    expect(translate("en", "relearnConfirm").length).toBeGreaterThan(0);
  });

  it("keeps user-facing help and sweep copy free of rigid angle checklists", () => {
    for (const key of userFacingKeys()) {
      expect(looksLikeRigidAngleChecklist(translate("zh", key))).toBe(false);
      expect(looksLikeRigidAngleChecklist(translate("en", key))).toBe(false);
    }
  });

  it("help describes auto-learn, header language switch, and turn pairing", () => {
    const zh = [
      translate("zh", "helpIntro"),
      translate("zh", "helpTurnBody"),
      translate("zh", "helpStuckBody"),
      translate("zh", "helpLimitsBody"),
      translate("zh", "relearn"),
    ].join("\n");
    expect(zh).toContain("页头");
    expect(zh).toContain("记住这侧最清楚");
    expect(zh).toContain("拍右耳 → 向左转头");
    expect(zh).toContain("拍左耳 → 向右转头");
    expect(zh).toContain("重新学习此侧");
    expect(zh).toContain("医院耳镜");
    expect(zh).not.toContain("校准此侧偏移");
    expect(zh).not.toMatch(/60\s*[–-]\s*95/);

    const en = [
      translate("en", "helpIntro"),
      translate("en", "helpTurnBody"),
      translate("en", "helpStuckBody"),
      translate("en", "helpLimitsBody"),
      translate("en", "relearn"),
    ].join("\n");
    expect(en.toLowerCase()).toContain("header");
    expect(en.toLowerCase()).toContain("remembers the clearest angle");
    expect(en.toLowerCase()).toContain("right ear → turn your head left");
    expect(en.toLowerCase()).toContain("left ear → turn your head right");
    expect(en).toContain("Relearn this side");
    expect(en.toLowerCase()).toContain("clinical ear scanner");
    expect(en.toLowerCase()).not.toContain("calibrate this side");
  });

  it("side intro names body left/right with no absolute degrees", () => {
    expect(translate("zh", "INTRO_RIGHT")).toMatch(/身体/);
    expect(translate("zh", "INTRO_RIGHT")).toMatch(/右耳/);
    expect(translate("zh", "INTRO_LEFT")).toMatch(/左耳/);
    expect(translate("en", "INTRO_RIGHT")).toMatch(/body/i);
    expect(translate("en", "INTRO_LEFT")).toMatch(/left ear/i);
    expect(looksLikeRigidAngleChecklist(translate("zh", "INTRO_RIGHT"))).toBe(
      false,
    );
    expect(looksLikeRigidAngleChecklist(translate("en", "INTRO_LEFT"))).toBe(
      false,
    );
  });

  it("stuck copy offers retry, relearn, and hair/light — not a dead shutter", () => {
    expect(translate("zh", "STUCK_NO_PROGRESS")).toMatch(/头发|亮/);
    expect(translate("zh", "STUCK_NO_PROGRESS")).toMatch(/重新学习/);
    expect(translate("zh", "stuckRetry")).toBe("再试一次");
    expect(translate("en", "STUCK_NO_PROGRESS")).toMatch(/hair|light/i);
    expect(translate("en", "STUCK_NO_PROGRESS")).toMatch(/relearn/i);
    expect(translate("en", "stuckRetry")).toMatch(/try again/i);
  });

  it("post-capture copy is relative to the peak, with retake / other ear", () => {
    expect(translate("zh", "captureNearPeak")).toMatch(/最清楚/);
    expect(translate("zh", "captureOffPeak")).toMatch(/重拍/);
    expect(translate("zh", "retake")).toBe("重拍");
    expect(translate("zh", "shootOtherEar")).toMatch(/另一/);
    expect(translate("en", "captureNearPeak")).toMatch(/clearest/i);
    expect(translate("en", "retake")).toMatch(/retake/i);
    expect(translate("en", "shootOtherEar")).toMatch(/other ear/i);
    expect(translate("zh", "captureNearPeak")).not.toMatch(/\d+\s*°/);
    expect(translate("en", "captureNearPeak")).not.toMatch(/\d+\s*°/);
  });

  it("SOFT_READY is distinct from READY", () => {
    expect(translate("zh", "SOFT_READY")).not.toBe(translate("zh", "READY"));
    expect(translate("en", "SOFT_READY")).not.toBe(translate("en", "READY"));
    expect(translate("zh", "EAR_OUT_OF_FRAME")).toMatch(/出画|画面/);
    expect(translate("en", "EAR_OUT_OF_FRAME")).toMatch(/out of frame/i);
  });

  it("README.zh-CN teaches auto-learn, not 60–95 offset calibration", () => {
    const md = readFileSync(
      resolve(import.meta.dirname, "../../README.zh-CN.md"),
      "utf8",
    );
    expect(md).not.toMatch(/60\s*[–-]\s*95/);
    expect(md).not.toContain("校准此侧偏移");
    expect(md).toContain("重新学习此侧");
    expect(md).toContain("自动学");
  });

  it("interpolates placeholders", () => {
    expect(interpolate("err {error}", { error: "boom" })).toBe("err boom");
    expect(translate("en", "modelLoadFailed", { error: "404" })).toContain(
      "404",
    );
    expect(translate("zh", "cameraError", { error: "denied" })).toBe(
      "摄像头：denied",
    );
  });

  it("leaves unknown placeholders intact", () => {
    expect(interpolate("keep {missing}", {})).toBe("keep {missing}");
  });
});
