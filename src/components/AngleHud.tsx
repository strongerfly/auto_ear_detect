import { useState } from "react";
import type { PeakSample } from "../lib/personal-best";

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
  const [open, setOpen] = useState(false);
  const fmt = (v: number | null) =>
    v === null || Number.isNaN(v) ? "—" : v.toFixed(1);
  return (
    <details
      className="hud"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>调试角度（平时不用看）</summary>
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
        bestYaw <strong>{bestYaw ? `${bestYaw.yaw.toFixed(0)}°` : "—"}</strong>
      </span>
    </details>
  );
}
