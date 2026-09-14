import type { PeakSample } from "../lib/personal-best";
import type { CaptureUi } from "../lib/guidance";
import { useLocale } from "../i18n";

export function AngleHud({
  yaw,
  pitch,
  roll,
  bestYaw,
  captureUi,
  overshootPastBestDeg,
}: {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  bestYaw: PeakSample | null;
  captureUi: CaptureUi;
  overshootPastBestDeg: number;
}) {
  const { t } = useLocale();
  const fmt = (v: number | null) =>
    v === null || Number.isNaN(v) ? "—" : v.toFixed(1);
  const stateLabel =
    captureUi === "ready"
      ? t("hudReady")
      : captureUi === "hold"
        ? t("hudHold")
        : t("hudLearning");

  return (
    <div className="hud-wrap">
      <div className="hud" aria-live="polite" data-ui={captureUi}>
        <span className="hud-state" data-ui={captureUi}>
          {stateLabel}
        </span>
        <span className="hud-note">
          {bestYaw ? t("learnedNote") : t("learningNote")}
        </span>
      </div>
      <details className="debug">
        <summary>{t("debugSummary")}</summary>
        <div className="hud debug-nums" aria-hidden="false">
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
          <span>
            overshootPastBestDeg <strong>{overshootPastBestDeg}°</strong>
          </span>
        </div>
      </details>
    </div>
  );
}
