# Limits and blockers

On-device **face pose + ear-ROI quality peak search**. Not medical meatus imaging; not the same absolute yaw for everyone. We pick the clearest, highest-structure **stable** frame we can track while the user turns that side toward the camera.

Capture mode: `qualityPeakYaw` (`src/config/pose-config.json`). READY does **not** require yaw ∈ [70, 90]. A personal peak around **~45°** is allowed.

Chinese twin: [LIMITS.zh-CN.md](./LIMITS.zh-CN.md).

## Boundary one-liner

Head pose from MediaPipe is for **direction**. Ear-ROI sharpness/structure is how we judge “is this ear frontal for this person?”. We search a trackable side-turn range instead of locking 70–90°.

## Table

| Theme | Blockers | Ceiling today | Shortfalls | Next optimizations | Conditions |
|-------|----------|---------------|------------|--------------------|------------|
| Pose source | No dedicated 3D ear; tracker drops at high yaw | FISWG yaw/pitch/roll; search \|yaw\| **35–90°** | ~90° tracking is shaky; peak may sit on the inner edge | Ear detector/seg; freeze last-good on loss | Profile-labeled set; on-device latency budget |
| Search band | Cannot guarantee a meatus axis | Configurable 35–90, soft preferred 40–80; **45° is allowed** | True peaks outside the window are missed | Widen with device FOV; stop search on track loss | Laptop/phone FOV calibration |
| Score without ear seg | Hair, background texture, motion blur → false peaks | 0.45 Laplacian + 0.35 edges + 0.20 side-face prior; outside preferred only **−0.1** | Dark blob / hair can beat a real pinna | Learned quality head; light segmentation | Ear ROIs labeled by angle |
| READY | Must not ask “is the ear frontal?” as the primary gate | Near bestYaw **±5°** + score ≥ **92%** of peak + 12 stable frames; no confirm. Weak/flat peaks use **SOFT_READY** (capture still allowed) | Flat score curves can still lock; timeout recovery if score/peak does not improve | Burst of 3 frames, pick by score (countdown waits 3 ready frames; does not store a buffer) | Per-device blur calibration |
| Personal peak | Stale peaks (haircut, glasses) | Auto-learn while turning; “relearn” clears | Did **not** hard-narrow ±10° next time (that would miss 45°) | alwaysRescore in-session; optional weak narrow | Same person, same device |
| Laplacian | Tied to camera, compression, exposure | Raw min 80 / good 120; drifts across laptops | Absolute sharpness is not portable | One-shot blur calibration | Flat/hand calibration target |
| Product goal | Meatus imaging ≠ pinna frontal | Optimize **pinna** clearest stable frame | Not an otoscope | Separate ROI/model if meatus is in scope | Clinical definition + consent |
| Privacy / perf | Cloud ear models are out of scope | In-browser WASM Face Landmarker | Main-thread detect can hitch | Move inference to a worker | Device whitelist + ms budget |

## Tried, only partly shipped

- **Fixed 70–90 READY:** removed. Pose is guidance; READY is personal bestYaw.
- **Ask “are you a 45° person?”:** will not. Peak is learned during a normal turn.
- **Dedicated ear landmarks / 3D ear:** not wired. Face-mesh ear points are unreliable in profile, so we use head pose + ROI quality. Trigger: a stable profile ear-seg model within the latency budget.
- **Require 60% window coverage before READY:** `minSweepCoverageRatio` is in config and **intentionally not a hard gate**, so a clear ear that peaks at ~45° can still READY. Grey capture copy says to sweep slowly past the peak first (`learningNote`); false-peak risk stays here, not a READY block.
- **45s no-progress timeout:** now a recovery narrative (`STUCK_NO_PROGRESS`) with **Try again** / **Relearn** / hair-light copy. Still not a hard fail, and it cannot diagnose *why* (hair vs light vs tracker vs false peak).
- **Meatus-like dark-blob penalty:** weak center-brightness heuristic only. Without seg we cannot tell meatus from hair shadow.
- **Ear-out-of-frame:** ROI clip ratio, not a real ear detector. Hair covering a fully in-frame pinna still looks like `CLEAR_HAIR`.
- **Soft-success vs READY:** heuristic (weak absolute peak or a wide flat sweep). Not a calibrated “this is definitely not an ear” check.
- **Burst pick-by-score of stored frames:** countdown still waits for 3 ready frames, then captures the current frame. It does not keep a 3-frame buffer and pick the sharpest.

## Won't do

- Fixed 70–90 as a hard READY gate
- Primary path that waits for the user to confirm “the ear is frontal”
- Dedicated ear landmarks / 3D ear without the trigger conditions in the table

## Interaction: ceiling vs cannot-do (copy)

User-facing strings live in `src/i18n/`. Unlocked prompts do not steer `TURN_MORE` / `TURN_BACK` against the prior. Grey shutter while learning is not “hold still.” Autoshutter countdown is cancelable. Relearn confirms and clears this side only. Absolute yaw/best numbers stay behind the debug toggle.

**Cannot-do in copy.** Will not teach a universal 70–90 (or 60–95) READY band, or call relearn 校准.

## READY (as implemented)

1. Face in frame, distance OK  
2. This side has a **bestYaw** (highest quality score in the search window)  
3. Current yaw within **±5°** of that best (stays READY until **±8°**, `exitBandDeg`); pitch/roll inside ready limits  
4. ~12 stable frames  
5. Ear score ≥ **92%** of the side’s peak; brightness 60–200  
6. No yaw ∈ [70, 90] requirement; no user confirm  

Guidance is one short line (中文 / English in the app). Switching left/right resets shutter, dwell, and guidance and shows a body-side intro; the other side’s stored peak is kept. While the peak is still unknown we only **sweep** (no prior-driven “a little more / ease back”). `SLOW_DOWN` can preempt a sweep line on a fast yaw jump, then yields back to SWEEP on a short window (`slowDownHoldMs`=200, same idea as READY’s `readyPromoteMs`) so 「转慢一点」 does not sit for a full yaw-family `minDwellMs`. After lock, going past `bestYaw` by `overshootPastBestDeg` with a score drop says ease back; returning toward best is HOLD, not MORE. Near a locked peak but not yet stable the shutter stays grey and uses **NEAR_PEAK** (「快到了…」), never **HOLD_STILL**. READY hysteresis: enter ±5° / leave ±8°. Auto-shutter is a cancelable `autoshutterMs` countdown after Ready. After a shot, feedback is relative to the remembered peak (no absolute degrees), with retake / other ear. Absolute yaw/pitch/roll numbers stay behind a debug toggle.

## Leftover cannot-do (this pass)

- Timeout cannot tell hair vs light vs tracker drop vs a false peak — it only notices no score/peak improvement.
- Ear-out-of-frame is a clipped-ROI heuristic, not ear segmentation.
- Soft-success is a score-span / weak-peak heuristic, not a clinical “this isn’t an ear” gate.
- Auto-shutter still does not keep a 3-frame still buffer and pick the sharpest.
- No dedicated ear detector; a hair/background false peak can still lock (Relearn is the recovery).
