# auto_ear_detect

Real-time **head-pose guided ear capture**. The webcam + MediaPipe Face Landmarker estimate yaw / pitch / roll, Chinese on-screen copy tells the user how to turn, and capture is gated until a frontal view of the chosen ear is stable and sharp.

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

No API keys. The Face Landmarker WASM loads from jsDelivr; the `.task` model is served from `public/models/` when present, otherwise Google’s MediaPipe model host.

## Left / right convention (FISWG)

| Sign | Meaning |
|------|---------|
| **+yaw** | right ear more visible (right profile) |
| **−yaw** | left ear more visible (left profile) |
| **+pitch** | nose up (tilt head back) |
| **+roll** | subject’s right ear up |

Euler order is **YXZ** (intrinsic `R = Ry · Rx · Rz`), units **degrees**. The 4×4 facial transformation matrix is treated as **row-major**. MediaPipe’s metric face has +X = subject’s right, +Y = up, +Z = toward the camera. Under that axis set, a positive raw Ry shows the *left* ear, so the implementation **negates yaw** (`FISWG_YAW_SIGN = -1` in `src/lib/euler.ts`) to match FISWG. Pitch and roll are not flipped.

Default targets (also in `src/config/pose-config.json`):

- Right ear: yaw **70–90°** (center 80), \|pitch\|≤8, \|roll\|≤8
- Left ear: yaw **−90–−70°** (center −80), same pitch/roll

## Front-camera / mirror caveat

**Chosen approach: CSS-mirror the preview only. Do not flip yaw.**

1. The `<video>` (and overlay canvas) use `transform: scaleX(-1)` so a front camera feels like a mirror.
2. Face Landmarker runs on the **raw, unmirrored** `HTMLVideoElement` buffer. CSS does not change those pixels.
3. Saved stills are drawn from that unmirrored buffer, so anatomical left/right in the file match FISWG.
4. Guidance copy (`请向左转头，露出右耳`) refers to the user’s **physical** left/right, not screen-left.

**Do not also negate yaw** to “compensate” for the CSS mirror — that would double-correct and swap sides.

If you instead draw a mirrored canvas and run Face Landmarker on *that*, MediaPipe’s left/right landmarks swap. You would then need to **negate yaw and swap ear ROI indices**. This project deliberately avoids that path.

## Capture gates

Ready (button enabled + optional auto-shutter) only when all of:

1. Face present, size in `[minFaceHeightRatio, maxFaceHeightRatio]`
2. Pose in the **ready** band around the offset-adjusted yaw center (`readyMaxAbsYawError` 5°, pitch/roll 8°)
3. Stable for **12** frames with \|Δangle\| &lt; 3° on yaw, pitch, and roll
4. Ear ROI quality: Laplacian ≥ 100, brightness 60–200, Sobel edge energy ≥ 15

Guidance is a single Chinese line with **400 ms** dwell (anti-flicker). Priority:

`NO_FACE` → distance → roll → pitch → yaw turn hints → hair/blur (`CLEAR_HAIR`) / light (`BAD_LIGHT`) → `HOLD_STILL` → `READY`

## Personal yaw offset

Some ears sit at a slightly different profile angle. A per-side offset (clamped ±15°) is stored in `localStorage` key `auto-ear-detect:offset:v1`.

**校准此侧偏移**: slowly turn while \|yaw\| is in 60–95°. The yaw at peak ear-ROI Laplacian becomes `offset = clamp(yawPeak − yawCenter, −15, 15)`. The yaw target band and turn-hint thresholds are translated by that offset, then clamped to a plausible profile range (~50–100° or −100–−50°).

## Tuning

All numeric thresholds and Chinese strings live in **`src/config/pose-config.json`**. Restart/refresh after edits.

| Want… | Touch |
|--------|--------|
| Stricter “ready” | `captureBands.readyMaxAbsYawError` |
| Less flicker | `promptUx.minDwellMs`, `smoothing.oneEuro` |
| Harder sharpness gate | `earRoiQuality.laplacianMin` / `minEdgeEnergy` |
| Different copy | `copy.*` |

Smoothing is a One Euro filter (`minCutoff` 1.0, `beta` 0.007, `dCutoff` 1.0).

## Project layout

```
src/config/pose-config.json   thresholds + Chinese copy
src/lib/euler.ts              matrix → YXZ → FISWG signs
src/lib/guidance.ts           pickPrompt state machine
src/lib/quality.ts            Laplacian / brightness / edges
src/components/EarCaptureApp.tsx
```

Unit tests (`npm test`) cover Euler round-trip, FISWG yaw sign, prompt priority, offset clamp, dwell, and ROI quality — no camera required.

The in-app **姿态模拟器** feeds synthetic yaw/pitch/roll so you can exercise guidance without a webcam.
