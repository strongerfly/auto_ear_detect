# Limits and blockers

On-device **face pose + ear-ROI quality peak search**. Not medical meatus imaging; not the same absolute yaw for everyone. We pick the clearest, highest-structure **stable** frame we can track while the user turns that side toward the camera.

Capture mode: `qualityPeakYaw` (`src/config/pose-config.json`). READY does **not** require yaw ∈ [70, 90]. A personal peak around **~45°** is allowed.

Chinese twin: [LIMITS.zh-CN.md](./LIMITS.zh-CN.md). Interaction checklist: [ear-guide-interaction-gaps.md](./ear-guide-interaction-gaps.md).

## Boundary one-liner

Head pose from MediaPipe is for **direction**. Ear-ROI sharpness/structure is how we judge “is this ear frontal *for this person*?”. We search a trackable side-turn range instead of locking 70–90°.

**Numbers vs UX:** search max is **90** (not 100) because tracking dies there — not because a table said so. READY **enters at ±5°** of `bestYaw`. `exitBandDeg` **8°** is kept on purpose so READY does not flicker; it is hysteresis, not a looser enter gate.

---

## 卡点 / Blockers

What we **still cannot fully solve**. Each item lists what we tried and what partial path shipped — “cannot” is not a skip.

| Still blocked | Tried | Partial path that shipped |
|---------------|-------|---------------------------|
| **No dedicated ear segmentation / detector** | Looked at MediaPipe face-mesh ear points as a stand-in 3D ear | **Not wired.** Those points are unstable in profile, so READY uses head pose for direction + a **face-mesh-derived ear ROI crop**, not ear identity. |
| **MediaPipe ear landmarks unreliable at profile** | Same as above | ROI box from face landmarks when a face is present; if the crop is hair/background, the score can still peak there. |
| **Laptop webcam FOV / working distance** | Wider search (max 100°) and a 70–90 READY band | Search is **\|yaw\| 35–90** (soft preferred 40–80). We do **not** force the user into a laptop-specific 70–90 pose. Peaks outside 35–90 are missed. |
| **Motion blur while turning** | One-Euro smoothing; SLOW_DOWN when yaw jumps; READY needs ~12 stable frames | Blurred frames are less likely to lock a peak, but a slow blurry hold can still score. No optical-flow / gyro fusion. |
| **Hair occlusion** | CLEAR_HAIR when Laplacian/edges are low **near the locked peak**; FAIL_TIMEOUT if stuck with no peak | We cannot see under hair. A shiny/hair texture can beat a real pinna (false peak). |
| **False peaks from background texture** | Weighted score (0.45 Laplacian + 0.35 edges + 0.20 side-face); dark-center meatus-like penalty; near-ties prefer **smaller \|yaw\|** | Without seg, a busy curtain or glasses frame in the ROI can win. Preferred-band miss is only **−0.1**, never a 45° refusal. |
| **High-yaw tracker drop (~90°)** | Face-lost copy (`FAIL_TRACKING`); **bestYaw is kept**; scoring paused while there is no face | No last-good Euler freeze into a 3D ear. Past ~90° the landmarker often dies. |
| **Device-tied Laplacian** | Raw min 80 / good 120 in config | Thresholds drift across laptops. No one-shot blur calibration pass. |
| **Anatomical “ear frontal normal” ≠ our score** | Replaced fixed 70–90 READY with personal `bestYaw` | Sharpest stable pinna ≠ meatus axis. Not an otoscope. |

---

## 当前上限 / Ceiling

What works **reliably today** in the browser, with a webcam or the pose simulator:

- Per-side **quality-peak yaw** while the user turns. Search \|yaw\| **35–90°**, soft preferred **40–80°**. A **~45°** peak can READY.
- Score = **0.45 Laplacian + 0.35 edge energy + 0.20 side-face content**. `bestYaw` is the yaw at the running max; near-ties use `smallerAbsYaw`.
- **READY** (all of): face in frame and size OK; this side has a locked `bestYaw`; current yaw within **±5°** of that best (`bandDegAroundBest` / enter band — **not** 8). `exitBandDeg` **8°** is hysteresis so READY does not flicker; it is not a wider enter gate. Pitch/roll in ready limits; ~**12** stable frames; score ≥ **92%** of the personal peak; brightness 60–200. **No** yaw ∈ [70, 90]. **No** “confirm the ear is frontal”.
- Unlocked (still learning): **sweep intro only** — a 60° prior never fires TURN_MORE / TURN_BACK / HOLD.
- Locked overshoot: TURN_BACK toward the **personal** peak when past bestYaw by ~**6°+** (not merely \|yaw\|>88); approaching the peak from the overshoot side **HOLDs** (not TURN_MORE); outer-edge “到头了，往回一点”.
- Face lost: pause scoring and stability, **keep** `bestYaw`, recover toward the peak.
- Autoshutter optional (default **off**): **idle → countdown → fire → cooldown**; cancel returns idle. After READY, a **3-frame buffer picks the highest score** (`ready.pickBurstBy: "score"`). Manual Capture uses the same pick when the buffer is warm.
- Soft-best (learned peak, not yet READY) is visually distinct from green READY. Footer `limitsHint` is a 短句; absolute target yaw is **not** shown in the normal UI (debug disclosure only).
- zh / en copy in `src/i18n/` (same keys). Relearn clears the stored peak after confirm and resweeps.
- Ear ROI clipped out of frame near the peak → too close / out (`TOO_CLOSE`). `MULTI_FACE` when more than one face is tracked. `WRONG_SIDE` waits `wrongSideFrames` (8).

---

## 短板 / Shortfalls

Gaps versus an ideal “always finds the true frontal ear”:

- The score is **sharpness/structure in a guessed ROI**, not a geometric ear-normal or a clinician’s frontal pinna.
- Hair, glasses, earrings, and background texture still produce **false peaks**; Relearn is the recovery, not a detector.
- Tracker loss at deep profile can pin `bestYaw` on the **inner edge** of the window (~35–45°) even if a better pose exists further out.
- Laptop vs phone FOV: the same person can peak at 45° on a laptop and 70° on a phone; we learn that, but we cannot promise a portable degree.
- Burst fusion is **three unsynced full frames, pick max score** — not aligned multi-frame super-resolution, not JPEG stack fusion.
- `minSweepCoverageRatio` (0.6) is a **weak-peak** cold-start gate only. A **confident ~45°** peak (`ready.confidentPeakScore`) can still READY without covering 60% of the window. A hard 60% gate would block that hold — leftover, see 卡点 / 条件.
- Next-session `clampOffsetDeg` / narrow-by-10° is **not** applied (unused on purpose; would refuse a new 45° after an old 80°).
- Main-thread Face Landmarker can hitch; no worker yet.
- No camera E2E guarantee in CI (unit tests + simulator only).

---

## 后续优化 / Next optimizations

In product order, not a wishlist dump:

1. **Ear detector / light segmentation** in the ROI — drop hair and background from the score.
2. **Learned quality head** (even a tiny on-device classifier) trained on labeled ear-angle crops, replacing raw Laplacian weights.
3. **Device-calibrated blur thresholds** — one-shot flat/hand target so min/good Laplacian are per camera, not 80/120 forever.
4. **Stronger multi-frame burst fusion** — keep N ready frames, align, pick or fuse; today’s 3-frame score pick is the first step.
5. **Last-good pose freeze** on tracker drop; optional IMU / slower yaw prior.
6. **Move inference to a worker** so the UI thread does not hitch.
7. Separate **meatus** ROI/model only if product scope actually includes the canal (clinical definition + consent).

---

## 优化条件 / Conditions

These are the gates before the next optimizations are honest, not aspirational:

- **Labeled ear-angle dataset** (left/right, yaw bins including ~45° and ~80°, hair on/off, several webcams). Without it, a learned quality head will overfit laptop glare.
- **On-device model size + latency budget** (WASM / GPU-lite, target ms/frame on the laptop SKU we actually ship).
- **Per-device calibration pass** (blur + FOV) if we want portable Laplacian numbers.
- **Profile-labeled set** for any ear-seg model; must stay stable when the landmarker is already shaky (~80–90°).
- Same person / same device if we ever persist a **weak** next-session search narrow — and even then it must not refuse a new 45° peak.
- Clinical definition + consent if meatus imaging is ever in scope.

---

## Theme table (same five columns)

| Theme | Blockers | Ceiling today | Shortfalls | Next optimizations | Conditions |
|-------|----------|---------------|------------|--------------------|------------|
| Pose source | No dedicated 3D ear; tracker drops at high yaw | FISWG yaw/pitch/roll; search \|yaw\| **35–90°** | ~90° tracking is shaky; peak may sit on the inner edge | Ear detector/seg; freeze last-good on loss | Profile-labeled set; on-device latency budget |
| Search band | Cannot guarantee a meatus axis | Configurable 35–90, soft preferred 40–80; **45° is allowed** | True peaks outside the window are missed | Widen with device FOV; stop search on track loss | Laptop/phone FOV calibration |
| Score without ear seg | Hair, background texture, motion blur → false peaks | 0.45 Laplacian + 0.35 edges + 0.20 side-face prior; outside preferred only **−0.1** | Dark blob / hair can beat a real pinna | Learned quality head; light segmentation | Ear ROIs labeled by angle |
| READY | Must not ask “is the ear frontal?” as the primary gate | Near bestYaw **±5°** + score ≥ **92%** of peak + 12 stable frames; no confirm | Flat score curves can soft-succeed | 3-frame burst pick-by-score (shipped); later aligned fusion | Per-device blur calibration |
| Personal peak | Stale peaks (haircut, glasses) | Auto-learn while turning; “relearn” clears | Did **not** hard-narrow ±10° next time (that would miss 45°) | alwaysRescore in-session; optional weak narrow | Same person, same device |
| Laplacian | Tied to camera, compression, exposure | Raw min 80 / good 120; drifts across laptops | Absolute sharpness is not portable | One-shot blur calibration | Flat/hand calibration target |
| Product goal | Meatus imaging ≠ pinna frontal | Optimize **pinna** clearest stable frame | Not an otoscope | Separate ROI/model if meatus is in scope | Clinical definition + consent |
| Privacy / perf | Cloud ear models are out of scope | In-browser WASM Face Landmarker | Main-thread detect can hitch | Move inference to a worker | Device whitelist + ms budget |

## Tried, only partly shipped

- **Fixed 70–90 READY:** removed. Pose is guidance; READY is personal bestYaw.
- **Ask “are you a 45° person?”:** will not. Peak is learned during a normal turn.
- **Dedicated ear landmarks / 3D ear:** not wired. Face-mesh ear points are unreliable in profile, so we use head pose + ROI quality. Trigger: a stable profile ear-seg model within the latency budget.
- **Require 60% window coverage before READY:** `minSweepCoverageRatio` is in config. **Weak** cold-start peaks must keep sweeping; a **confident ~45°** peak still READYs. A hard 60% gate on every READY is leftover (卡点: false-peak vs a real 45° pinna; 条件: labeled ear-angle set).
- **45s timeout fail copy:** `FAIL_TIMEOUT` only if **no peak is locked and the user has stopped turning**. A 45° peak can still READY after a long session; it is recovery copy, not the main path.
- **Meatus-like dark-blob penalty:** weak center-brightness heuristic only. Without seg we cannot tell meatus from hair shadow.
- **Burst pick-by-score:** last **3 READY frames**, keep the highest score still. Not aligned fusion (卡点: inter-frame motion; 条件: align budget).
- **`clampOffsetDeg` unused on purpose:** narrowing next session to last peak ±10° would refuse a new 45° after an 80° session (卡点: FOV / haircut change; 条件: same person + device and a 45° acceptance test).

## Won't do

- Fixed 70–90 as a hard READY gate
- Primary path that waits for the user to confirm “the ear is frontal”
- Dedicated ear landmarks / 3D ear without the trigger conditions above
- Showing an absolute target yaw in the normal UI

## READY (as implemented)

1. Face in frame, distance OK  
2. This side has a **bestYaw** (highest quality score in the search window)  
3. Current yaw within **±5°** of that best (exit **8°** once already ready); pitch/roll inside ready limits  
4. ~12 stable frames  
5. Ear score ≥ **92%** of the side’s peak; brightness 60–200  
6. No yaw ∈ [70, 90] requirement; no user confirm  

Guidance is one short line (中文 / English in the app). While the user is still turning we only talk about direction; hair / light / roll wait until they are close. READY promotes faster so prompts do not feel like a checklist.

## Interaction coverage (this PR)

Unit tests in `src/lib/guidance.test.ts` (`interaction coverage (coherent pass)` plus the older suites) lock:

under-rotate → TURN_MORE; over-rotate **6°+ past personal bestYaw** → TURN_BACK (copy「往回一点，刚才那边更清楚」); approaching the peak from overshoot HOLDs (not TURN_MORE); wrong-side both ears (`wrongSideFrames`); roll then pitch then yaw; hair / too-bright / too-fast (`fastTurnDegPerFrame`); face lost **keeps** `bestYaw`; too near/far; ROI clipped near peak → TOO_CLOSE; MULTI_FACE; flat score curve still READYs at the smaller \|yaw\|; relearn (null peak) is sweep not READY; ~45° peak READYs; 70–90 alone does not; weak cold-start peak without sweep coverage is not READY; autoshutter idle→countdown→fire→cooldown.

**Not a hard gate (see 短板 / 卡点 / 条件):** 60% coverage on a **confident** 45° peak; `flatPeakRangeDeg` 25 (tie-break + 92% score ratio instead); `clampOffsetDeg` unused; aligned burst fusion; ear-seg; device Laplacian.
