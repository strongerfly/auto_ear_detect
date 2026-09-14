import { afterEach, describe, expect, it } from "vitest";
import { PROMPT_KEYS } from "../config";
import {
  LOCALE_STORAGE_KEY,
  loadLocale,
  localeFromBrowserLanguage,
  saveLocale,
} from "./locale";
import {
  interpolate,
  looksLikeCalibrationWording,
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
    expect(translate("zh", "relearnConfirm")).toContain("确定吗");
    expect(translate("zh", "TURN_BACK_OVERSHOOT")).toBe(
      "往回一点，刚才那边更清楚",
    );
    expect(translate("en", "TURN_BACK_OVERSHOOT")).toContain(
      "it was clearer just now",
    );
  });

  it("keeps user-facing help and sweep copy free of rigid angle checklists", () => {
    for (const key of userFacingKeys()) {
      expect(looksLikeRigidAngleChecklist(translate("zh", key))).toBe(false);
      expect(looksLikeRigidAngleChecklist(translate("en", key))).toBe(false);
    }
  });

  it("never uses 校准 wording in Chinese UI copy", () => {
    for (const text of Object.values(messagesFor("zh"))) {
      expect(looksLikeCalibrationWording(text)).toBe(false);
    }
    expect(translate("zh", "relearn")).not.toContain("校准");
    expect(translate("zh", "relearnConfirm")).not.toContain("校准");
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
