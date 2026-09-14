# Limits and blockers

On-device **face pose + ear-ROI quality peak search**. Not medical meatus imaging; not the same absolute yaw for everyone. We pick the clearest, highest-structure **stable** frame we can track while the user turns that side toward the camera.

Capture mode: `qualityPeakYaw` (`src/config/pose-config.json`). READY does **not** require yaw ∈ [70, 90]. A personal peak around **~45°** is allowed.

Chinese twin: [LIMITS.zh-CN.md](./LIMITS.zh-CN.md). Interaction P0 vs remaining gaps: [interaction-gaps.md](./interaction-gaps.md).

## Boundary one-liner

Head pose from MediaPipe is for **direction**. Ear-ROI sharpness/structure is how we judge “is this ear frontal for this person?”. We search a trackable side-turn range instead of locking 70–90°.

## Ceiling vs explicit cannot-do

**Ceiling** = best we can do with today’s tracker + ROI score. Tuneable, but physics/model-limited.

**Cannot-do** = out of product scope. We will not ship these as the main path even if a threshold is sitting in config.

| Theme | Blockers | Ceiling today | Explicit cannot-do | Shortfalls | Next (if conditions met) |
|-------|----------|---------------|--------------------|------------|--------------------------|
| Pose source | No dedicated 3D ear; tracker drops at high yaw | FISWG yaw/pitch/roll; search \|yaw\| **35–90°** | Dedicated ear landmarks / 3D ear without a stable profile model | ~90° tracking is shaky; peak may sit on the inner edge | Ear detector/seg; freeze last-good on loss |
| Search band | Cannot guarantee a meatus axis | Configurable 35–90, soft preferred 40–80; **45° is allowed** | Hard READY in 70–90; asking “are you a 45° person?” | True peaks outside the window are missed | Widen with device FOV; stop search on track loss |
| Score without ear seg | Hair, background texture, motion blur → false peaks | 0.45 Laplacian + 0.35 edges + 0.20 side-face prior; outside preferred only **−0.1** | Treating Laplacian as portable across laptops | Dark blob / hair can beat a real pinna | Learned quality head; light segmentation |
| READY | Must not ask “is the ear frontal?” as the primary gate | Enter **±5°** / exit **±8°** of bestYaw + score ≥ **92%** of peak + 12 stable frames; no confirm | User-confirm “ear is frontal” as the main path | Flat score curves can soft-succeed | Burst of 3 frames, pick by score (shipped) |
| Guidance | Soft prior is not a person | Unlocked = sweep intro only; turn-back only after peak lock; overshoot vs bestYaw + score drop | TURN_MORE/TURN_BACK aimed at a universal 60° | False peaks still possible | Stronger score; optional weak next-time narrow |
| Personal peak | Stale peaks (haircut, glasses) | Auto-learn while turning; relearn with confirm, then sweep intro | Calling relearn “校准/calibration” | Did **not** hard-narrow ±10° next time (that would miss 45°) | alwaysRescore in-session; optional weak narrow |
| Product goal | Meatus imaging ≠ pinna frontal | Optimize **pinna** clearest stable frame | Clinical otoscope / meatus diagnosis | Not an otoscope | Separate ROI/model if meatus is in scope |
| Privacy / perf | Cloud ear models are out of scope | In-browser WASM Face Landmarker | Uploading ear video to a cloud model | Main-thread detect can hitch | Move inference to a worker |

## Tried, only partly shipped

- **Fixed 70–90 READY:** removed. Pose is guidance; READY is personal bestYaw.
- **Ask “are you a 45° person?”:** will not. Peak is learned during a normal turn.
- **Dedicated ear landmarks / 3D ear:** not wired. Face-mesh ear points are unreliable in profile, so we use head pose + ROI quality. Trigger: a stable profile ear-seg model within the latency budget.
- **Require 60% window coverage before READY:** `minSweepCoverageRatio` is in config and **intentionally not a hard gate**, so a clear ear that peaks at ~45° can still READY. Documented as false-peak risk (ceiling), not a user-facing rule.
- **45s timeout fail copy:** `failure.timeoutMs` exists; we do not nag it as the main path.
- **Meatus-like dark-blob penalty:** weak center-brightness heuristic only. Without seg we cannot tell meatus from hair shadow.
- **Soft prior as a turn target:** removed from unlocked guidance. `search.priorYawAbs` remains a score/debug prior only.

## Won't do (explicit cannot-do)

- Fixed 70–90 as a hard READY gate
- Primary path that waits for the user to confirm “the ear is frontal”
- Dedicated ear landmarks / 3D ear without the trigger conditions in the table
- Unlocked TURN_MORE / TURN_BACK / HOLD aimed at a universal yaw
- Absolute yaw / bestYaw in the normal HUD (debug fold only)
- Relearn without a confirm, or copy that says 校准

## READY (as implemented)

1. Face in frame, distance OK  
2. This side has a **bestYaw** (highest quality score in the search window)  
3. Current yaw within **±5°** to enter, stays until **±8°** to leave; pitch/roll inside ready limits  
4. ~12 stable frames  
5. Ear score ≥ **92%** of the side’s peak; brightness 60–200  
6. No yaw ∈ [70, 90] requirement; no user confirm  
7. Optional auto-shutter: first run **off**; when on, burst of 3 pick-by-score then a cancelable `autoshutterMs` countdown  

Guidance is one short line (中文 / English in the app). Until a peak is locked we only introduce the sweep. After lock, going past bestYaw with a score drop says ease back; returning toward best is HOLD, not MORE. READY promotes faster so prompts do not feel like a checklist.
