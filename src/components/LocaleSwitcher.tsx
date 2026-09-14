import { useLocale, type Locale } from "../i18n";

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="locales" role="group" aria-label={t("language")}>
      <LangButton
        current={locale}
        value="zh"
        label="中文"
        onSelect={setLocale}
      />
      <LangButton
        current={locale}
        value="en"
        label="English"
        onSelect={setLocale}
      />
    </div>
  );
}

function LangButton({
  current,
  value,
  label,
  onSelect,
}: {
  current: Locale;
  value: Locale;
  label: string;
  onSelect: (locale: Locale) => void;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      className={selected ? "on" : ""}
      aria-pressed={selected}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  );
}
