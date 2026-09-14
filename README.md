# auto_ear_detect

[English](README.md) · [中文说明](README.zh-CN.md)

[![CI](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml/badge.svg)](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml)

Real-time **head-pose guided ear capture**. Turn slowly until the ear looks clearest — the app remembers that angle for each side. It learns a personal pose; it does not assume one universal ear angle.

Stack: **Vite + React + TypeScript** + `@mediapipe/tasks-vision` Face Landmarker (`VIDEO` mode, `outputFacialTransformationMatrixes: true`).

**中文 / English** toggle in the header. Preference is stored in `localStorage` (`auto-ear-detect:locale:v1`). Default: browser `zh*` → Chinese, otherwise English.

Limits, blockers, and what we will not pretend to solve: **[docs/LIMITS.md](docs/LIMITS.md)** · **[docs/LIMITS.zh-CN.md](docs/LIMITS.zh-CN.md)**. Interaction coverage: **[docs/ear-guide-interaction-gaps.md](docs/ear-guide-interaction-gaps.md)**.

## How to use

1. Allow the camera. Switch language in the header if you want.
2. Tap **Left ear** or **Right ear** (your body, not the mirror). Right ear → turn left; left ear → turn right.
3. Turn your **head** slowly (not the laptop/phone) until the ear looks clearest. The first sweep is how the app learns that side; capture stays off until then.
4. Wait for **Ready to capture**. Auto-shutter is **off** by default — turn it on if you want the app to shoot for you. Then switch sides and turn again.

If the remembered angle is wrong, use **Relearn this side** and turn slowly once more. Expand **Instructions** in the app for overshoot, camera permission, and limits.

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
3. Current yaw within **±5°** of that best (exit hysteresis **8°** once already ready); pitch/roll inside ready limits
4. Stable ~**12** frames
5. Score ≥ **92%** of the personal peak, brightness in range

No “confirm the ear is frontal” step. Auto-shutter is optional and off by default; when on, it waits 3 ready frames and **keeps the highest-score still**. **Relearn this side** clears the stored peak; learning itself is automatic.

While still learning (no locked peak), prompts stay on the sweep intro — a 60° prior never fires TURN_BACK / HOLD. Absolute yaw is hidden in a debug disclosure; the normal UI does not show a target degree.

## Ceiling vs cannot-do（上限与做不到）

The five product-owner columns live in full in **[docs/LIMITS.md](docs/LIMITS.md)** · **[docs/LIMITS.zh-CN.md](docs/LIMITS.zh-CN.md)**. Summary:

### 能实现的天花板 / Ceiling that ships

- Per-side **quality peak yaw** while turning (\|yaw\| 35–90, soft preferred 40–80). A **~45°** peak can READY; a generic 70–90 hold with no locked peak cannot.
- READY near that personal best (**±5°**, exit hysteresis 8°) with score ≥ 92% of peak and ~12 stable frames. No “confirm the ear is frontal”.
- Unlocked: sweep intro only. Locked overshoot: turn back toward the **personal** peak. Face-lost keeps `bestYaw`. After READY, 3 frames pick the highest score.

### 明确做不到的 / Explicitly not solved

Do not treat these as done. Each one was tried; the partial path is in LIMITS.

- **No ear segmentation model.** Face-mesh ear points were considered and not wired — they fail in profile. We crop a guessed ROI and score sharpness.
- **Hair / occlusion / background texture** can still make a false peak. CLEAR_HAIR is a near-peak heuristic, not a detector.
- **Motion blur** and **laptop FOV** are only partly handled (slow-down, 35–90 search). Laplacian 80/120 is not portable across webcams.
- **Quality score ≠ anatomical ear-normal / meatus.** Not a clinical ear scanner. No camera E2E in CI.
- High-yaw **tracker drop** (~90°) pauses scoring; we do not reconstruct a 3D ear.

### 短板 / Shortfalls

False peaks, inner-edge lock after tracker drop, unsynced 3-frame burst (not aligned fusion), no worker, stale peaks after a haircut (Relearn).

### 后续优化 / Next optimizations

Ear detector/seg → learned quality head → device blur calibration → aligned multi-frame fusion → last-good freeze → worker inference. Meatus only with clinical scope.

### 优化条件 / Conditions

Labeled ear-angle dataset (including ~45°), on-device size/latency budget, per-device calibration pass, profile-labeled set that still works when the landmarker is shaky.

## Tuning

Numeric thresholds: **`src/config/pose-config.json`**. User-visible strings: **`src/i18n/`**. Refresh after editing thresholds.

| Want… | Touch |
|--------|--------|
| Search / preferred band | `search.rightEar` / `search.leftEar` (`yawAbsMin` / `yawAbsMax` / `preferredAbs*`) |
| READY vs personal peak | `ready.bandDegAroundBest`, `ready.scoreRatioOfBest` |
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
docs/LIMITS.md                blockers, ceiling, next steps (EN)
docs/LIMITS.zh-CN.md          卡点 / 上限 / 短板 / 后续
docs/ear-guide-interaction-gaps.md  P0/P1 coverage checklist
src/components/EarCaptureApp.tsx
```

Unit tests (`npm test`) cover Euler, prompt flow, bestYaw (including a 45° peak), locale lookup, dwell, and ROI quality — no camera required.

The in-app **pose simulator** can vary quality with yaw so you can watch READY fire away from a fixed high-yaw band.
