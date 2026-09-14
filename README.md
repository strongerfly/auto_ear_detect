# auto_ear_detect

[![CI](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml/badge.svg)](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml)

Real-time **head-pose guided ear capture**. MediaPipe Face Landmarker estimates yaw / pitch / roll. On-screen copy (Chinese) tells the user which way to turn. Capture is gated by a **quality-adaptive personal best yaw**, not a universal 70–90° band.

Stack: **Vite + React + TypeScript** + `@mediapipe/tasks-vision` Face Landmarker (`VIDEO` mode, `outputFacialTransformationMatrixes: true`).

Limits, blockers, and what we will not pretend to solve: **[docs/LIMITS.md](docs/LIMITS.md)** · **[docs/LIMITS.zh-CN.md](docs/LIMITS.zh-CN.md)**. Interaction coverage: **[docs/ear-guide-interaction-gaps.md](docs/ear-guide-interaction-gaps.md)**.

## 能实现的天花板 / Ceiling that ships

- Per-side **quality peak yaw** while the user turns (\|yaw\| 35–90, soft preferred 40–80).
- READY near that personal best (**±5°**, exit hysteresis 8°) with score ≥ 92% of peak and stable frames — including a **~45°** peak.
- Progressive copy: sweep / 再转一点点 / 往回一点（过了个人峰值）. No 70–90 gate. No “confirm the ear is frontal”.
- Unlocked (still learning): **only** sweep intro — no fake HOLD / TURN_BACK from a 60° prior.

## 明确做不到的 / Explicitly not solved

Hair/occlusion, score ≠ anatomical ear-normal, high-yaw tracker drop, laptop-specific blur numbers, medical meatus, camera E2E without a device. See LIMITS for 卡点 / 上限 / 短板 / 后续 / 条件. Do not treat those as done.

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

This repo has **no i18n tree**. UI copy is Chinese in `src/config/pose-config.json`; English lives in the README and `docs/LIMITS.md`.

## Left / right convention (FISWG)

| Sign | Meaning |
|------|---------|
| **+yaw** | right ear more visible (right profile) |
| **−yaw** | left ear more visible (left profile) |
| **+pitch** | nose up (tilt head back) |
| **+roll** | subject’s right ear up |

Euler order is **YXZ** (intrinsic `R = Ry · Rx · Rz`), units **degrees**. The 4×4 facial transformation matrix is treated as **row-major**. MediaPipe’s metric face has +X = subject’s right, +Y = up, +Z = toward the camera. Under that axis set, a positive raw Ry shows the *left* ear, so the implementation **negates yaw** (`FISWG_YAW_SIGN = -1` in `src/lib/euler.ts`) to match FISWG. Pitch and roll are not flipped.

Soft prior (not a capture gate): about **±60°**, preferred search **40–80°**, full search **35–90°**. A clear ear that peaks near **45°** can READY.

## Front-camera / mirror caveat

**Chosen approach: CSS-mirror the preview only. Do not flip yaw.**

1. The `<video>` (and overlay canvas) use `transform: scaleX(-1)` so a front camera feels like a mirror.
2. Face Landmarker runs on the **raw, unmirrored** `HTMLVideoElement` buffer. CSS does not change those pixels.
3. Saved stills are drawn from that unmirrored buffer, so anatomical left/right in the file match FISWG.
4. Guidance copy refers to the user’s **physical** left/right, not screen-left.

**Do not also negate yaw** to “compensate” for the CSS mirror — that would double-correct and swap sides.

## Capture (qualityPeakYaw)

Head pose is for **direction** and side. Ready-to-shoot is **ear frontal quality** for this person.

While the user turns, each side stores `bestYaw` = yaw at the highest ear-ROI score in \|yaw\| **35–90°** (sign matches the chosen ear). Score = 0.45 Laplacian + 0.35 edge energy + 0.20 side-face content (preferred 40–80 is a **soft** −0.1, never a refusal). Near-ties prefer the **smaller \|yaw\|**.

READY when all of:

1. Face present, size in `[minFaceHeightRatio, maxFaceHeightRatio]`
2. A personal **bestYaw** is locked for this side
3. Current yaw within **±5°** of that best; pitch/roll inside ready limits
4. Stable ~**12** frames (\|Δangle\| &lt; 3°)
5. Score ≥ **92%** of the personal peak, brightness 60–200

Sitting in 70–90° with generic “ok” quality is **not** enough if the peak is elsewhere, or if no peak is locked yet. No “confirm the ear is frontal” step. Auto-shutter waits 3 ready frames and shoots; the button is available as soon as READY.

Guidance is one short line. Far from the peak we only say which way to turn (sweep / a bit more / come back). Hair, light, and mild roll wait until the user is close. Dwell is 400 ms in-family, 700 ms across families, **200 ms** to promote READY.

**重新学习** clears the stored peak. Learning itself is automatic.

## Tuning

Thresholds and Chinese strings: **`src/config/pose-config.json`**. Refresh after edits.

| Want… | Touch |
|--------|--------|
| Search / preferred band | `search.yawAbsMin` / `yawAbsMax` / `preferredAbs*` |
| READY vs personal peak | `ready.bandDegAroundBest`, `ready.scoreRatioOfBest` |
| Less flicker | `promptUx.minDwellMs`, `crossFamilyDwellMs`, `smoothing.oneEuro` |
| Sharpness floor | `score.sharp`, `score.struct` |
| Copy | `copy.*` |

## Project layout

```
src/config/pose-config.json   qualityPeakYaw thresholds + Chinese copy
src/lib/euler.ts              matrix → YXZ → FISWG signs
src/lib/guidance.ts           progressive prompts + READY gate
src/lib/personal-best.ts      running bestYaw from ROI quality
src/lib/quality.ts            Laplacian / edges / weighted score
docs/LIMITS.md                blockers, ceiling, next steps (EN)
docs/LIMITS.zh-CN.md          卡点 / 上限 / 短板 / 后续
docs/ear-guide-interaction-gaps.md  P0/P1 coverage checklist
src/components/EarCaptureApp.tsx
```

Unit tests (`npm test`) cover Euler, prompt flow, bestYaw (including a 45° peak), rejection of a 70–90-only gate, dwell, and ROI quality — no camera required.

The in-app **姿态模拟器** can enable **质量随 yaw 变化** (default peak 45°) to watch READY fire outside 70–90.
