import { useLocale } from "../i18n";

export function InstructionsPanel() {
  const { t } = useLocale();
  return (
    <details className="help">
      <summary>{t("helpTitle")}</summary>
      <p>{t("helpIntro")}</p>
      <h3>{t("helpTurnHeading")}</h3>
      <p>{t("helpTurnBody")}</p>
      <h3>{t("helpSideHeading")}</h3>
      <p>{t("helpSideBody")}</p>
      <h3>{t("helpCalibrateHeading")}</h3>
      <p>{t("helpCalibrateBody")}</p>
      <h3>{t("helpReadyHeading")}</h3>
      <p>{t("helpReadyBody")}</p>
      <p>{t("helpMirror")}</p>
    </details>
  );
}
