# auto_ear_detect

[![CI](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml/badge.svg)](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml)

Real-time **head-pose guided ear capture**. The webcam + MediaPipe Face Landmarker estimate yaw / pitch / roll, Chinese on-screen copy tells the user how to turn, and capture is gated until a **quality-adaptive** frontal view of the chosen ear is stable and sharp.

Stack: **Vite + React + TypeScript** + `@mediapipe/tasks-vision` Face Landmarker (`VIDEO` mode, `outputFacialTransformationMatrixes: true`).

## Run

```bash
npm install
npm test
npm run dev
```

Open the printed local URL (default http://localhost:5173). Allow the camera. Use **拍左耳** / **拍右耳**.

```bash
npm run build
npm run preview
```

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, `npm test`, and `npm run build` on push and pull requests to `main`.

No API keys. The Face Landmarker WASM loads from jsDelivr; the `.task` model is served from `public/models/` when present, otherwise Google’s MediaPipe model host.

## Left / right convention (FISWG)

| Sign | Meaning |
|------|---------|
| **+yaw** | right ear more visible (right profile) |
| **−yaw** | left ear more visible (left profile) |
| **+pitch** | nose up (tilt head back) |
| **+roll** | subject’s right ear up |

Euler order is **YXZ** (intrinsic `R = Ry · Rx · Rz`), units **degrees**. The 4×4 facial transformation matrix is treated as **row-major**. MediaPipe’s metric face has +X = subject’s right, +Y = up, +Z = toward the camera. Under that axis set, a positive raw Ry shows the *left* ear, so the implementation **negates yaw** (`FISWG_YAW_SIGN = -1` in `src/lib/euler.ts`) to match FISWG. Pitch and roll are not flipped.

Default **soft prior** (also in `src/config/pose-config.json`):

- Right ear prior center: yaw **~80°**
- Left ear prior center: yaw **~−80°**
- Pitch / roll still limited to about ±8° when capturing

These priors only steer “turn left / right” **before** a personal peak is known. They do **not** refuse capture at other profile angles (for example **~45°**) if ear-ROI quality peaks there.

## Front-camera / mirror caveat

**Chosen approach: CSS-mirror the preview only. Do not flip yaw.**

1. The `<video>` (and overlay canvas) use `transform: scaleX(-1)` so a front camera feels like a mirror.
2. Face Landmarker runs on the **raw, unmirrored** `HTMLVideoElement` buffer. CSS does not change those pixels.
3. Saved stills are drawn from that unmirrored buffer, so anatomical left/right in the file match FISWG.
4. Guidance copy (`请向左转头，露出右耳`) refers to the user’s **physical** left/right, not screen-left.

**Do not also negate yaw** to “compensate” for the CSS mirror — that would double-correct and swap sides.

If you instead draw a mirrored canvas and run Face Landmarker on *that*, MediaPipe’s left/right landmarks swap. You would then need to **negate yaw and swap ear ROI indices**. This project deliberately avoids that path.

## Capture gates

Head pose is used for **direction** (turn left/right, fix roll/pitch) and side selection. “Ready to shoot” is driven by **ear frontal quality**, not by sitting in a universal 70–90° band.

Ready (button enabled + optional auto-shutter) only when all of:

1. Face present, size in `[minFaceHeightRatio, maxFaceHeightRatio]`
2. A per-side **personal bestYaw** has been observed (see below)
3. Current yaw is within `readyMaxAbsYawError` (8°) of that bestYaw; \|pitch\| / \|roll\| ≤ 8°
4. Stable for **12** frames with \|Δangle\| &lt; 3° on yaw, pitch, and roll
5. Ear ROI quality: Laplacian ≥ 100, brightness 60–200, Sobel edge energy ≥ 15, and the combined score is not collapsing vs the personal peak (`qualityCollapseRatio`)

Sitting in 70–90° with generic “ok” quality is **not** enough if no personal peak is locked, or if that person’s peak is elsewhere.

Guidance is a single Chinese line with **400 ms** dwell (anti-flicker). Priority:

`NO_FACE` → distance → roll → pitch → yaw turn hints (relative to personal best, or the ±80° prior) → hair/blur (`CLEAR_HAIR`) / light (`BAD_LIGHT`) → `HOLD_STILL` → `READY`

This repo has no separate i18n tree; UI copy stays Chinese and English documentation lives here.

## Quality-adaptive personal best yaw

While the user turns, each side keeps a running estimate:

`bestYaw` = yaw at the highest ear-ROI quality score seen in a wide search window (\|yaw\| **35–100°**, configurable, matching the selected ear’s sign).

Score = Laplacian variance + 0.5 × Sobel edge energy (focus/detail plus helix-like contours). Pitch/roll outliers are ignored so a tilted frame cannot steal the peak.

- **Background:** this updates continuously during normal turning — no 60–95° calibration band, no “are you a 45° person?” question.
- **Guidance:** turn-left / turn-right / turn-back are relative to the current bestYaw (or the ±80° prior before anything is learned).
- **Ready:** near that personal best, not near a hard 70–90° band.
- **重新学习此侧:** clears the stored peak so the next scan can re-learn. Peaks are stored in `localStorage` key `auto-ear-detect:best-yaw:v1`.

Someone whose ear looks most frontal around 45° can become READY at ~45° after the scan sees that peak.

## Tuning

All numeric thresholds and Chinese strings live in **`src/config/pose-config.json`**. Restart/refresh after edits.

| Want… | Touch |
|--------|--------|
| Wider / narrower search window | `personalBest.searchYawMinAbs` / `searchYawMaxAbs` |
| Stricter “ready” vs personal peak | `captureBands.readyMaxAbsYawError` |
| Coarser vs finer turn hints | `personalBest.guidanceCoarseAbsError` |
| Less flicker | `promptUx.minDwellMs`, `smoothing.oneEuro` |
| Harder sharpness gate | `earRoiQuality.laplacianMin` / `minEdgeEnergy` |
| Different copy | `copy.*` |

Smoothing is a One Euro filter (`minCutoff` 1.0, `beta` 0.007, `dCutoff` 1.0).

## Project layout

```
src/config/pose-config.json   thresholds + Chinese copy
src/lib/euler.ts              matrix → YXZ → FISWG signs
src/lib/guidance.ts           pickPrompt state machine
src/lib/personal-best.ts      running bestYaw from ROI quality
src/lib/quality.ts            Laplacian / brightness / edges
src/components/EarCaptureApp.tsx
```

Unit tests (`npm test`) cover Euler round-trip, FISWG yaw sign, prompt priority, bestYaw updates, READY at a 45° personal peak, rejection of a 70–90-only gate, dwell, and ROI quality — no camera required.

The in-app **姿态模拟器** feeds synthetic yaw/pitch/roll so you can exercise guidance without a webcam. Enable **质量随 yaw 变化** and sweep through a peak (default 45°) to watch bestYaw lock and READY fire outside 70–90.
