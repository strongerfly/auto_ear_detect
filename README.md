# auto_ear_detect

[English](README.md) · [中文说明](README.zh-CN.md)

[![CI](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml/badge.svg)](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml)

Real-time **head-pose guided ear capture**. Turn slowly until the ear looks clearest — the app remembers that angle for each side. It is not a rigid 70–90° pose checklist.

Stack: **Vite + React + TypeScript** + `@mediapipe/tasks-vision` Face Landmarker (`VIDEO` mode, `outputFacialTransformationMatrixes: true`).

**中文 / English** toggle in the header. Preference is stored in `localStorage` (`auto-ear-detect:locale:v1`). Default: browser `zh*` → Chinese, otherwise English.

Honest ceiling and shortfalls: **[docs/LIMITS.md](docs/LIMITS.md)** · **[docs/LIMITS.zh-CN.md](docs/LIMITS.zh-CN.md)**. Interaction P0 vs remaining gaps: **[docs/interaction-gaps.md](docs/interaction-gaps.md)**.

## How to use

1. Allow the camera. Switch language in the header if you want.
2. Tap **Left ear** or **Right ear** (your body, not the mirror). Right ear → turn left; left ear → turn right.
3. Turn your **head** slowly (not the laptop/phone) until the ear looks clearest. The first sweep is how the app learns that side; capture stays off until then.
4. Wait for **Ready to capture**. Auto-shutter starts **off**; turn it on for a cancelable countdown. Then switch sides and turn again.

If the remembered angle is wrong, use **Relearn this side**, confirm, and turn slowly once more. Expand **Instructions** in the app for overshoot, camera permission, and limits. Angle numbers live under **Debug: angle numbers**, not the normal HUD.

## Run

```bash
npm install
npm test
npm run dev
```

Open the printed local URL (default http://localhost:5173).

```bash
npm run build
npm run preview
```

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, `npm test`, and `npm run build` on push and pull requests to `main`.

No API keys. Face Landmarker WASM loads from jsDelivr; the `.task` model is served from `public/models/` when present, otherwise Google’s MediaPipe model host.

## Left / right convention (FISWG)

| Sign | Meaning |
|------|---------|
| **+yaw** | right ear more visible (right profile) |
| **−yaw** | left ear more visible (left profile) |
| **+pitch** | nose up (tilt head back) |
| **+roll** | subject’s right ear up |

Euler order is **YXZ** (intrinsic `R = Ry · Rx · Rz`), units **degrees**. The 4×4 facial transformation matrix is treated as **row-major**. MediaPipe’s metric face has +X = subject’s right, +Y = up, +Z = toward the camera. Under that axis set, a positive raw Ry shows the *left* ear, so the implementation **negates yaw** (`FISWG_YAW_SIGN = -1` in `src/lib/euler.ts`) to match FISWG. Pitch and roll are not flipped.

Guidance copy refers to the user’s **physical** left/right, not screen-left.

## Front-camera / mirror caveat

**CSS-mirror the preview only. Do not flip yaw.**

1. The `<video>` (and overlay canvas) use `transform: scaleX(-1)` so a front camera feels like a mirror.
2. Face Landmarker runs on the **raw, unmirrored** `HTMLVideoElement` buffer.
3. Saved stills come from that unmirrored buffer, so anatomical left/right in the file is correct.
4. Do not also negate yaw to “compensate” for the CSS mirror — that double-corrects and swaps sides.

## Capture (qualityPeakYaw)

Head pose is for **direction**. Ready-to-shoot is **ear frontal quality** for this person, learned while they turn.

Each side stores `bestYaw` at the highest ear-ROI score in a trackable side-turn window. Score = 0.45 Laplacian + 0.35 edge energy + 0.20 side-face content. Near-ties prefer the **smaller \|yaw\|**. A clear peak around ~45° can READY; sitting in a generic high-yaw band with no locked peak cannot.

READY when all of:

1. Face present, size in `[minFaceHeightRatio, maxFaceHeightRatio]`
2. A personal **bestYaw** is locked for this side
3. Current yaw within **±5°** of that best to enter, stays until **±8°** to leave; pitch/roll inside ready limits
4. Stable ~**12** frames
5. Score ≥ **92%** of the personal peak, brightness in range

Until a peak is locked, prompts are sweep-only (no prior-driven turn-back or hold). After lock, going past `bestYaw` by `overshootPastBestDeg` with a score drop asks the user to ease back; returning toward best is HOLD. No “confirm the ear is frontal” step. Auto-shutter is off on first run; when enabled it waits 3 ready frames, picks by score, then a cancelable countdown (`autoshutterMs`). **Relearn this side** asks for confirm, then returns to the sweep intro.

## Tuning

Numeric thresholds: **`src/config/pose-config.json`**. User-visible strings: **`src/i18n/`**. Refresh after editing thresholds.

| Want… | Touch |
|--------|--------|
| Search / preferred band | `search.yawAbsMin` / `yawAbsMax` / `preferredAbs*` |
| READY vs personal peak | `ready.bandDegAroundBest`, `ready.exitBandDeg`, `ready.scoreRatioOfBest` |
| Overshoot past best | `ready.overshootPastBestDeg` |
| Auto-shutter countdown | `ready.autoshutterMs`, `ready.burstFrames` |
| Less flicker | `promptUx.minDwellMs`, `crossFamilyDwellMs`, `smoothing.oneEuro` |
| Sharpness floor | `score.sharp`, `score.struct` |
| Copy | `src/i18n/messages.ts` |

## Project layout

```
src/config/pose-config.json   qualityPeakYaw thresholds (language-neutral)
src/i18n/                     Chinese / English UI + guidance copy
src/lib/euler.ts              matrix → YXZ → FISWG signs
src/lib/guidance.ts           progressive prompts + READY gate
src/lib/personal-best.ts      running bestYaw from ROI quality
src/lib/quality.ts            Laplacian / edges / weighted score
docs/LIMITS.md                blockers, ceiling vs cannot-do (EN)
docs/LIMITS.zh-CN.md          卡点 / 上限 / 明确做不到
docs/interaction-gaps.md      interaction P0 vs remaining gaps (EN)
src/components/EarCaptureApp.tsx
```

Unit tests (`npm test`) cover Euler, prompt flow, bestYaw (including a 45° peak), locale lookup, dwell, and ROI quality — no camera required.

The in-app **pose simulator** can vary quality with yaw so you can watch READY fire away from a fixed high-yaw band.
