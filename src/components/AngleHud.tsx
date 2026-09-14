import type { PromptKey } from "../config";
import { poseConfig } from "../config";
import type { PeakSample } from "../lib/personal-best";

export function AngleHud({
  yaw,
  pitch,
  roll,
  bestYaw,
  prompt,
}: {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  bestYaw: PeakSample | null;
  prompt: PromptKey | null;
}) {
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
        最佳yaw <strong>{bestYaw ? `${bestYaw.yaw.toFixed(1)}°` : "学习中"}</strong>
      </span>
      {prompt ? (
        <span className="hud-state">{poseConfig.copy[prompt]}</span>
      ) : null}
    </div>
  );
}
