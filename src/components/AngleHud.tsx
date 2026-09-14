import type { PeakSample } from "../lib/personal-best";
import { useLocale } from "../i18n";

export function AngleHud({
  yaw,
  pitch,
  roll,
  bestYaw,
}: {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  bestYaw: PeakSample | null;
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
        {t("hudBest")}{" "}
        <strong>
          {bestYaw ? `${bestYaw.yaw.toFixed(0)}°` : t("hudLearning")}
        </strong>
      </span>
    </div>
  );
}
