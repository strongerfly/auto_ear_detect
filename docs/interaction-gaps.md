# Interaction gaps

North star: **best interaction, not rigid**. The system finds the clearest ear angle. Turn-back exists only after a personal peak is locked.

This is the interaction companion to [LIMITS.md](./LIMITS.md) (technical ceiling). Chinese: [interaction-gaps.zh-CN.md](./interaction-gaps.zh-CN.md).

## Ceiling vs cannot-do (interaction)

| | Ceiling (honest limit of this build) | Explicit cannot-do |
|---|--------------------------------------|--------------------|
| Unlocked prompts | Sweep intro + wrong-side / slow-down / face gates | Using the ~60° soft prior to say TURN_MORE, TURN_BACK, HOLD, or READY |
| Locked overshoot | Relative to `bestYaw`; `overshootPastBestDeg` (12°) + score drop → TURN_BACK_OVERSHOOT | Absolute “you hit 88° / the back of the head” as the main overshoot copy |
| Returning | Moving toward best → HOLD, then READY in-band | TURN_MORE that would push the user farther past the peak |
| Ready band | Enter ±5° / exit ±8° (`exitBandDeg`) | A single hard ±5° with no hysteresis |
| HUD | Three-state: learning / hold-near-peak / ready | Absolute yaw / bestYaw on the normal HUD (those live in the debug fold only) |
| Capture button | Grey while learning or holding; green only on READY | HOLD_STILL while still learning |
| Auto-shutter | First run **off**; when on, 3-frame burst pick-by-score then cancelable `autoshutterMs` | Surprise instant shutter on the first visit |
| Relearn | Confirm dialog, then sweep intro | Copy that says 校准 / “calibrate”; silent wipe |

## Shipped P0 (this pass)

1. Unlocked: sweep intro only until peak locked. No prior-driven TURN_MORE / TURN_BACK / HOLD.
2. Locked overshoot: past `bestYaw` by `overshootPastBestDeg` with a score drop → 「往回一点，刚才那边更清楚」. Returning toward best → HOLD, not MORE.
3. `exitBandDeg` hysteresis (~enter 5 / exit 8).
4. No absolute yaw/best in the normal HUD; numbers are behind **Debug: angle numbers**.
5. Grey button / prompt three-state: learning vs hold-near-peak vs ready.
6. Auto-shutter: default off first run + cancelable countdown; burst still pick-by-score.
7. Relearn: confirm, then sweep intro; no 校准 wording.

## Remaining gaps (not P0 / still ceiling)

These are **not** promised this pass:

- No dedicated ear detector, so a hair/background false peak can still lock. Relearn is the recovery, not a clinical check that the user picked the correct ear.
- `minSweepCoverageRatio` is still not a hard READY gate (would block a real ~45° hold). False-peak risk stays in LIMITS.
- Tracker loss near 90° can freeze a peak on the inner edge of the window.
- Auto-shutter countdown cannot know user intent beyond “left READY” or “hit cancel”.
- Debug fold still shows degrees for developers; that is intentional, not a user-facing checklist.

## Config knobs

| Want… | Touch |
|--------|--------|
| Enter / leave READY | `ready.bandDegAroundBest`, `ready.exitBandDeg` |
| Overshoot copy | `ready.overshootPastBestDeg`, `ready.scoreRatioOfBest` |
| Countdown | `ready.autoshutterMs`, `ready.burstFrames`, `ready.pickBurstBy` |
