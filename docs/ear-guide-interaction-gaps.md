# Ear guide — interaction coverage

Checklist for quality-peak capture. **North star: best interaction, not rigid tables.** The system picks the clearest personal angle; past that peak must turn back. Absolute target yaw is **not** shown in the normal UI.

Unit tests: `src/lib/guidance.test.ts` → `interaction coverage (coherent pass)` plus shutter / sweep / i18n suites.

P0/P1 items below are implemented on this branch unless marked leftover.

## P0 — must

| # | Gap | Status |
|---|-----|--------|
| 1 | Under-rotate → TURN_MORE / sweep | Done (after peak locked: TURN_MORE; before lock: **INTRO** sweep only — `SWEEP_*`, no naked target degrees) |
| 2 | Overshoot vs **personal bestYaw** (not only \|yaw\|>88) | Done. Past best by ~**6°+** → `TURN_BACK` copy「往回一点，刚才那边更清楚」. Approaching the peak from the overshoot side (`signedYawDelta` toward best, within exit band) → **HOLD**, not TURN_MORE |
| 3 | Wrong side / reverse turn | Done (`WRONG_SIDE` after `failure.wrongSideFrames` = 8; body L/R not mirror) |
| 4 | Severe roll before yaw; mild roll waits until close | Done |
| 5 | Hair / bad light only when close to the peak | Done |
| 6 | Too fast → SLOW_DOWN | Done (`fastTurnDegPerFrame` / `slowYawDeltaDeg`) |
| 7 | Face lost → FAIL_TRACKING; **bestYaw kept** | Done. Scoring and stability pause; recover guides back to the peak |
| 8 | Too near / far | Done |
| 9 | READY only near personal best (45° path); never 70–90 alone | Done + tests |
| 10 | Unlocked: sweep intro only, **no** prior TURN_BACK / TURN_MORE / HOLD | Done + tests |
| 11 | Grey capture button matches learning / hold / ready | Done (`phase` + title) |
| 12 | Hide absolute yaw / bestYaw in normal HUD | Done (debug `<details>`) |
| 13 | Relearn confirm; no「校准」wording | Done. 「重新学习此侧」clears best/offset, resweeps, resets shutter / dwell / coverage |
| 14 | Autoshutter state machine | Done: **armed (idle) → countdown → capture → cooldown**; default **off**; cancel returns idle; burst of last 3 READY frames picks highest score |
| 15 | exitBandDeg hysteresis enter 5° / exit 8° | Done + tests |
| 16 | First camera: body L/R ≠ mirror; saved stills opposite selfie | Done (preview hint) |
| — | Cold start coverage | Done as a **hybrid**: weak peaks need `minSweepCoverageRatio` (0.6) before READY; a **confident ~45°** peak (`ready.confidentPeakScore`) still READYs. A hard 60% gate is a leftover (would block a clear 45° hold) — see LIMITS |

## P1

| # | Gap | Status |
|---|-----|--------|
| 17 | Soft-best UI distinct from true READY | Done (gold prompt / `learnedNote` vs green READY + stage border) |
| 18 | Camera permission denied empty state | Done (`cameraDenied` overlay + retry) |
| 19 | After capture, cue the other ear | Done (`otherEarHint`) |
| 20 | In-app limits hint (短句) | Done (`limitsHint` in the footer; zh+en) |
| 21 | Search-window edge: keep prompting (sweep / turn-back), not silence | Done (`TURN_BACK_OVERSHOOT` 「到头了，往回一点」) |
| 22 | i18n key structure | Done (`src/i18n/` zh + en, **same keys**; pose-config has no `copy`). Coordinate with i18n PR #3: keys are the contract |
| 23 | MULTI_FACE | Done (Landmarker `faceLandmarks.length`) |
| 24 | Ear ROI out of frame | Done — clipped ROI near the peak → `TOO_CLOSE` (too close / out) |

## P2 leftovers (see LIMITS — 卡点 / 条件)

| # | Gap | Why later | 卡点 | 条件 |
|---|-----|-----------|------|------|
| 25 | Hard 60% sweep coverage before **every** READY | Would block a clear ~45° hold | Weak false peaks vs a real 45° pinna | Labeled ear-angle set so a hard gate is safe |
| 26 | `clampOffsetDeg` / next-session search narrow ±10° | Would refuse 45° if last peak was 80°. **Unused on purpose**; `alwaysRescore` keeps 35–90 | Stale session peak vs new device FOV | Same person, same device, plus a 45° acceptance test |
| 27 | Timeout as terminal fail | `FAIL_TIMEOUT` only if stuck with **no** peak | Long honest search vs abandon | Product SLA on give-up copy |
| 28 | Aligned burst fusion | **3-frame score pick shipped**; not aligned JPEG / super-res | Motion between frames | Align budget + N-frame buffer |
| 29 | Dedicated ear segmentation / meatus | No model; dark-center penalty is weak | Face-mesh ear points fail in profile | Profile-labeled seg model + latency budget |
| 30 | Device Laplacian calibration | Raw 80/120 | Camera / compression drift | One-shot blur/FOV calibration target |
| 31 | Show absolute target yaw | **Won't do** in normal UI | Users chase a number, not clarity | — |
| 32 | Ask user “is the ear frontal?” | **Won't do** as primary gate | Confirm is not a quality signal | — |

## Suggested JSON (shipped in `pose-config.json`)

`captureMode: qualityPeakYaw`, `search.*.yawAbsMin/Max` 35–90, `search.overshootTurnBackDeg` 6, `search.fastTurnDegPerFrame` 18, `search.minSweepCoverageRatio` 0.6, `ready.bandDegAroundBest` 5, `ready.exitBandDeg` 8, `ready.scoreRatioOfBest` 0.92, `ready.requireUserConfirm` false, `ready.burstFrames` 3, `ready.countdownMs` 1000, `ready.cooldownMs` 2000, `ready.confidentPeakScore` 0.5, `failure.timeoutMs` 45000, `failure.wrongSideFrames` 8.

## Copy / INTRO

- Intro keys are `SWEEP_RIGHT_EAR` / `SWEEP_LEFT_EAR` (documented as INTRO; no duplicate PromptKey). No naked target degrees.
- `TURN_BACK`: 「往回一点，刚才那边更清楚」 / “Ease back toward the clearer pose”.
- `limitsHint` footer 短句. zh and en tables share the same keys (`messagesFor`).

## Boundary / won't do

- Not medical meatus imaging.
- Not the same yaw for everyone.
- Not a 70–90 hard READY.
- Guarantees: clearest/highest-structure **stable** frame in the trackable side-turn range.
