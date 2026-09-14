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
| READY | Must not ask “is the ear frontal?” as the primary gate | Near bestYaw **±5°** + score ≥ **92%** of peak + 12 stable frames; no confirm | Flat score curves can soft-succeed | Burst of 3 frames, pick by score (shipped) | Per-device blur calibration |
| Personal peak | Stale peaks (haircut, glasses) | Auto-learn while turning; “relearn” clears | Did **not** hard-narrow ±10° next time (that would miss 45°) | alwaysRescore in-session; optional weak narrow | Same person, same device |
| Laplacian | Tied to camera, compression, exposure | Raw min 80 / good 120; drifts across laptops | Absolute sharpness is not portable | One-shot blur calibration | Flat/hand calibration target |
| Product goal | Meatus imaging ≠ pinna frontal | Optimize **pinna** clearest stable frame | Not an otoscope | Separate ROI/model if meatus is in scope | Clinical definition + consent |
| Privacy / perf | Cloud ear models are out of scope | In-browser WASM Face Landmarker | Main-thread detect can hitch | Move inference to a worker | Device whitelist + ms budget |

## Tried, only partly shipped

- **Fixed 70–90 READY:** removed. Pose is guidance; READY is personal bestYaw.
- **Ask “are you a 45° person?”:** will not. Peak is learned during a normal turn.
- **Dedicated ear landmarks / 3D ear:** not wired. Face-mesh ear points are unreliable in profile, so we use head pose + ROI quality. Trigger: a stable profile ear-seg model within the latency budget.
- **Require 60% window coverage before READY:** `minSweepCoverageRatio` is in config and **intentionally not a hard gate**, so a clear ear that peaks at ~45° can still READY. Documented as false-peak risk.
- **45s timeout fail copy:** `FAIL_TIMEOUT` only if **no peak is locked and the user has stopped turning**. A 45° peak can still READY after a long session; it is recovery copy, not the main path.
- **Meatus-like dark-blob penalty:** weak center-brightness heuristic only. Without seg we cannot tell meatus from hair shadow.

## Won't do

- Fixed 70–90 as a hard READY gate
- Primary path that waits for the user to confirm “the ear is frontal”
- Dedicated ear landmarks / 3D ear without the trigger conditions in the table

## READY (as implemented)

1. Face in frame, distance OK  
2. This side has a **bestYaw** (highest quality score in the search window)  
3. Current yaw within **±5°** of that best; pitch/roll inside ready limits  
4. ~12 stable frames  
5. Ear score ≥ **92%** of the side’s peak; brightness 60–200  
6. No yaw ∈ [70, 90] requirement; no user confirm  

Guidance is one short line (中文 / English in the app). While the user is still turning we only talk about direction; hair / light / roll wait until they are close. READY promotes faster so prompts do not feel like a checklist.
