# Ear guide — interaction coverage

Checklist for quality-peak capture. **North star: best interaction, not rigid tables.** Absolute target yaw is not shown in the normal UI.

Unit tests: `src/lib/guidance.test.ts` → `interaction coverage (coherent pass)`.

P0/P1 items below are implemented on this branch unless marked leftover.

## P0 — must

| # | Gap | Status |
|---|-----|--------|
| 1 | Under-rotate → TURN_MORE / sweep | Done (after peak locked: TURN_MORE; before lock: sweep intro only) |
| 2 | Overshoot vs **personal bestYaw** → TURN_BACK | Done; copy「往回一点，刚才那边更清楚」. Not driven by 70–90 or a 60° prior while unlocked |
| 3 | Wrong side / reverse turn | Done (`WRONG_SIDE`, body L/R not mirror) |
| 4 | Severe roll before yaw; mild roll waits until close | Done |
| 5 | Hair / bad light only when close to the peak | Done |
| 6 | Too fast → SLOW_DOWN | Done (`slowYawDeltaDeg`) |
| 7 | Face lost → FAIL_TRACKING; **bestYaw kept** | Done (not cleared on loss) |
| 8 | Too near / far | Done |
| 9 | READY only near personal best (45° path); never 70–90 alone | Done + tests |
| 10 | Unlocked: sweep intro only, **no** prior TURN_BACK / TURN_MORE / HOLD | Done + tests |
| 11 | Grey capture button matches learning / hold / ready | Done (`phase` + title) |
| 12 | Hide absolute yaw / bestYaw in normal HUD | Done (debug `<details>`) |
| 13 | Relearn confirm; no「校准」wording | Done |
| 14 | Autoshutter default **off**; cancel while armed | Done (burst still picks stable ready frames) |
| 15 | exitBandDeg hysteresis enter 5° / exit 8° | Done + tests |
| 16 | First camera: body L/R ≠ mirror; saved stills opposite selfie | Done (preview hint) |

## P1

| # | Gap | Status |
|---|-----|--------|
| 17 | SOFT_BEST distinct from READY | Done (status line vs green READY) |
| 18 | Camera permission denied empty state | Done (`cameraDenied` overlay + retry) |
| 19 | After capture, cue the other ear | Done (`otherEarHint`) |
| 20 | In-app limits hint | Done (Instructions + LIMITS docs) |
| 21 | Search-window edge: keep prompting (sweep / turn-back), not silence | Done |
| 22 | i18n key structure | Done (`src/i18n/` zh + en; pose-config has no `copy`) |
| 23 | MULTI_FACE | Done (Landmarker `faceLandmarks.length`) |
| 24 | Ear ROI out of frame | Partial — too-close / face-size gates; no dedicated ROI-clipped prompt |

## P2 leftovers (see LIMITS)

| # | Gap | Why later |
|---|-----|-----------|
| 25 | Cold start **require** 60% sweep coverage before READY | Would block a clear ~45° hold; config key exists, **not a hard gate** |
| 26 | `clampOffsetDeg` / next-session search narrow ±10° | Would refuse 45° if last peak was 80°; `alwaysRescore` keeps 35–90 |
| 27 | Timeout as terminal fail | `FAIL_TIMEOUT` only if stuck with **no** peak |
| 28 | Burst image buffer pick-by-score | **Done** — last 3 READY frames, keep highest score. Not aligned JPEG fusion (LIMITS next) |
| 29 | Dedicated ear segmentation / meatus | No model; dark-center penalty is weak |
| 30 | Device Laplacian calibration | Raw 80/120 |
| 31 | Show absolute target yaw | **Won't do** in normal UI |
| 32 | Ask user “is the ear frontal?” | **Won't do** as primary gate |

## Suggested JSON (shipped in `pose-config.json`)

`captureMode: qualityPeakYaw`, `search.*.yawAbsMin/Max` 35–90, `ready.bandDegAroundBest` 5, `ready.exitBandDeg` 8, `ready.scoreRatioOfBest` 0.92, `ready.requireUserConfirm` false, `ready.burstFrames` 3, `failure.timeoutMs` 45000.

## Boundary / won't do

- Not medical meatus imaging.
- Not the same yaw for everyone.
- Not a 70–90 hard READY.
- Guarantees: clearest/highest-structure **stable** frame in the trackable side-turn range.
