export type Locale = "zh" | "en";

export const LOCALE_STORAGE_KEY = "auto-ear-detect:locale:v1";

/** Browser `zh*` → Chinese; anything else → English. */
export function localeFromBrowserLanguage(
  lang: string | undefined | null,
): Locale {
  return (lang ?? "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const listed = navigator.languages?.find((item) => item.length > 0);
  return localeFromBrowserLanguage(navigator.language || listed);
}

/**
 * Stored override wins. Otherwise: browser `zh*` → zh, else en.
 */
export function loadLocale(): Locale {
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored === "zh" || stored === "en") return stored;
    } catch {
      // ignore quota / privacy errors
    }
  }
  return detectBrowserLocale();
}

export function saveLocale(locale: Locale): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore quota / privacy errors
  }
}

export function htmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en";
}
