import type { PromptKey } from "../config";
import { useLocale } from "../i18n";

export function AngleHud({
  yaw,
  pitch,
  roll,
  offset,
  prompt,
}: {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  offset: number;
  prompt: PromptKey | null;
}) {
  const { t } = useLocale();
  const fmt = (v: number | null) =>
    v === null || Number.isNaN(v) ? "—" : v.toFixed(1);
  return (
    <div className="hud" aria-live="polite">
      <span>
        yaw <strong>{fmt(yaw)}°</strong>
      </span>
      <span>
        pitch <strong>{fmt(pitch)}°</strong>
      </span>
      <span>
        roll <strong>{fmt(roll)}°</strong>
      </span>
      <span>
        {t("hudOffset")}{" "}
        <strong>
          {offset >= 0 ? "+" : ""}
          {offset.toFixed(1)}°
        </strong>
      </span>
      {prompt ? <span className="hud-state">{t(prompt)}</span> : null}
    </div>
  );
}
