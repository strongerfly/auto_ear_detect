import { useLocale } from "../i18n";

export function InstructionsPanel() {
  const { t } = useLocale();
  return (
    <details className="help">
      <summary>{t("helpTitle")}</summary>
      <p>{t("helpIntro")}</p>
      <h3>{t("helpTurnHeading")}</h3>
      <p>{t("helpTurnBody")}</p>
      <h3>{t("helpStuckHeading")}</h3>
      <p>{t("helpStuckBody")}</p>
      <h3>{t("helpLimitsHeading")}</h3>
      <p>{t("helpLimitsBody")}</p>
    </details>
  );
}
