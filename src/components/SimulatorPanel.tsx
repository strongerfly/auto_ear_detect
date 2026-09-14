import type { EarQuality } from "../lib/types";

export type SimState = {
  enabled: boolean;
  hasFace: boolean;
  faceHeightRatio: number;
  yaw: number;
  pitch: number;
  roll: number;
  quality: EarQuality;
  qualityFollowsYaw: boolean;
  qualityPeakYaw: number;
};

export const DEFAULT_SIM: SimState = {
  enabled: false,
  hasFace: true,
  faceHeightRatio: 0.4,
  yaw: 0,
  pitch: 0,
  roll: 0,
  quality: { laplacian: 180, brightness: 120, edgeEnergy: 40 },
  qualityFollowsYaw: false,
  qualityPeakYaw: 45,
};

export function SimulatorPanel({
  sim,
  onChange,
}: {
  sim: SimState;
  onChange: (next: SimState) => void;
}) {
  const set = (patch: Partial<SimState>) => onChange({ ...sim, ...patch });
  const setQ = (patch: Partial<EarQuality>) =>
    onChange({ ...sim, quality: { ...sim.quality, ...patch } });

  return (
    <details className="sim" open={sim.enabled}>
      <summary>姿态模拟器（无摄像头时可验证引导）</summary>
      <label className="sim-row">
        <input
          type="checkbox"
          checked={sim.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        启用模拟
      </label>
      <label className="sim-row">
        <input
          type="checkbox"
          checked={sim.hasFace}
          onChange={(e) => set({ hasFace: e.target.checked })}
          disabled={!sim.enabled}
        />
        画面中有脸
      </label>
      <label className="sim-row">
        <input
          type="checkbox"
          checked={sim.qualityFollowsYaw}
          onChange={(e) => set({ qualityFollowsYaw: e.target.checked })}
          disabled={!sim.enabled}
        />
        质量随 yaw 变化（峰值可调，用于验证 45° 也能 READY）
      </label>
      <Slider
        label="yaw"
        min={-120}
        max={120}
        value={sim.yaw}
        disabled={!sim.enabled}
        onChange={(yaw) => set({ yaw })}
      />
      <Slider
        label="pitch"
        min={-40}
        max={40}
        value={sim.pitch}
        disabled={!sim.enabled}
        onChange={(pitch) => set({ pitch })}
      />
      <Slider
        label="roll"
        min={-40}
        max={40}
        value={sim.roll}
        disabled={!sim.enabled}
        onChange={(roll) => set({ roll })}
      />
      <Slider
        label="脸高比"
        min={0.1}
        max={0.9}
        step={0.01}
        value={sim.faceHeightRatio}
        disabled={!sim.enabled}
        onChange={(faceHeightRatio) => set({ faceHeightRatio })}
      />
      <Slider
        label="质量峰值 yaw"
        min={-100}
        max={100}
        value={sim.qualityPeakYaw}
        disabled={!sim.enabled || !sim.qualityFollowsYaw}
        onChange={(qualityPeakYaw) => set({ qualityPeakYaw })}
      />
      <Slider
        label={sim.qualityFollowsYaw ? "峰值清晰度" : "清晰度"}
        min={0}
        max={400}
        value={sim.quality.laplacian}
        disabled={!sim.enabled}
        onChange={(laplacian) => setQ({ laplacian })}
      />
      <Slider
        label="亮度"
        min={0}
        max={255}
        value={sim.quality.brightness}
        disabled={!sim.enabled}
        onChange={(brightness) => setQ({ brightness })}
      />
    </details>
  );
}

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  disabled,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="sim-slider">
      <span>
        {label} <em>{value.toFixed(step < 1 ? 2 : 0)}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
