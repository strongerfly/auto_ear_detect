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
  looksLikeRigidAngleChecklist,
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
