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
- **Soft-success vs READY:** heuristic (weak absolute peak or a wide flat sweep). Not a calibrated “this is definitely not an ear” check. Same quality gate as READY; soft uses yellow chrome, a distinct shutter hint, and its own post-capture line. Strong peaks stay green READY. Not a fixed yaw band. Auto-shutter still counts down.
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

Guidance is one short line (中文 / English in the app). Cold start requires choosing a body left/right ear (not the screen) before INTRO; the pick is stored. Switching left/right still calls the side-session reset (shutter, dwell, intro) and keeps the other side’s stored peak. While the peak is still unknown we only **sweep** (no prior-driven “a little more / ease back”). `SLOW_DOWN` can preempt a sweep line on a fast yaw jump, then yields back to SWEEP on a short window (`slowDownHoldMs`=200, same idea as READY’s `readyPromoteMs`) so 「转慢一点」 does not sit for a full yaw-family `minDwellMs`. After lock, going past `bestYaw` by `overshootPastBestDeg` with a score drop says ease back; returning toward best is HOLD, not MORE. Near a locked peak but not yet stable the shutter stays grey and uses **NEAR_PEAK** (「快到了…」), never **HOLD_STILL**. READY hysteresis: enter ±5° / leave ±8°. Auto-shutter is a cancelable `autoshutterMs` countdown after Ready. After a shot, feedback is relative to the remembered peak (no absolute degrees), with retake / other ear. Absolute yaw/pitch/roll numbers stay behind a debug toggle.

## Cannot-do + breakthrough conditions (1–8)

1) One “standard angle” for everyone
Cannot-do: Fixed 70–90 as READY.
To break through: Tighten preferred after population profile-angle distribution data (still not a hard READY).

2) Medical meatus / otoscope-grade
Cannot-do: Today we only optimize a clear, stable pinna frame.
To break through: A separate meatus ROI/model + clinical definition and informed consent.

3) No false peaks
Cannot-do: Without ear segmentation, hair/background can beat a real pinna.
To break through: Profile ear segmentation or occlusion model + labels by angle.

4) True peak outside the window (|yaw|<35 or >90)
Cannot-do: Search cannot sample outside the window; high yaw easily loses tracking.
To break through: FOV calibration to widen the window; freeze last-good / PnP on track loss.

5) System automatically switching the selected left/right ear
Cannot-do: Product contract is that the user taps to choose; a wrong tap is not self-checked.
To break through: A reliable left/right ear classifier (latency acceptable).

6) Cross-device absolute sharpness threshold
Cannot-do: Laplacian is tied to camera/exposure.
To break through: Boot-time blur calibration (flat/palm).

7) Automatically decide “should relearn”
Cannot-do: We do not know about haircut/glasses changes.
To break through: Long-term same-person same-device signals.

8) timeout cannot explain “why we are stuck”
Cannot-do: Only “not found this time” + change light / clear hair / relearn.
To break through: An attributable quality head or segmentation.

## HarmonyOS shell (packaging ceiling · path B)

Not one of items 1–8. Shipping and packaging ceiling only. Do not read it as capture-quality work.

**Shipping ceiling today: Web + Android.** Browser capture, plus the Android debug APK already on `main`, is the deliverable path. Harmony is not a supported platform today. That APK does not install on HarmonyOS NEXT.

Path B: `harmony/` is a reviewable ArkWeb/Web thin-shell scaffold plus a dist→rawfile sync. It is not a HAP, and it is not an old local tree brought back as support. An installable HAP is produced on a local DevEco machine, or on a dedicated CI that already has signing secrets. Do not claim the default Cursor cloud VM can build an installable HAP. Ionic has no HarmonyOS NEXT Capacitor plan. Community OpenHarmony/Oniro adapters are not the Huawei store path. Do not write this as official Capacitor Harmony, or as store-ready.

**HM-IX-0 device smoke has not been run.** It stays blocked until every box in [harmony-next-path.md](./harmony-next-path.md) §1.3 is checked. Signing certificates and a device UDID are not in hand. This work does not invent them.

- **Blockers:** No official Capacitor → HarmonyOS NEXT path. Needs Huawei Command Line Tools / SDK (or local DevEco) plus the signing trio (`.p12` / `.cer` / `.p7b`) and passwords. Default CI syncs the web build into `rawfile` only. It does not run `hvigorw` and does not upload a HAP. This cloud VM is not the build machine and not an emulator host. On-device Harmony camera permission and the ear-capture path are not accepted here.
- **Ceiling today:** Web and the Android debug APK on `main`. Harmony is at most an in-progress shell. A scaffold in the tree ≠ supported Harmony, ≠ an installable HAP, ≠ store-ready.
- **Shortfalls:** Signing materials, device UDID/Profile, in-ArkWeb camera permission, and MediaPipe WASM behavior are not verified on a real device in this repo. In-app `cameraDenied` tells the user to allow the site in browser settings. That sentence is the web/Android path. It is not Harmony recovery copy, and this tree does not add Harmony-specific failure lines before a device run (HM-IX-2).
- **Next:** Recipe and the §1.3 checklist: [harmony-next-path.md](./harmony-next-path.md). Material names only: [harmony-signing-secrets.md](./harmony-signing-secrets.md). Do not change the claim to supported, installable, or store-ready until the breakthrough conditions are met.
- **Breakthrough conditions** (all of them, before saying there is an installable debug HAP): Huawei CLI/SDK (or local DevEco) available on a persistent builder, not a fresh Cursor VM; the signing trio can sign non-interactively; one acceptance device (handset UDID on the debug profile, or a local DevEco emulator — not this VM); `harmony/` actually assembles after the web sync; evidence of `assembleHap` + signed HAP + `hdc install`; on-device camera permission takes effect, and the ear-capture main path (getUserMedia inside the web shell plus the existing quality-peak flow, READY or SOFT_READY, no 70–90° hard gate) runs through once. Store listing is a later step and stays out of scope until those conditions exist.

## Next cuts within the ceiling (shippable; not items 1–8 above)
- #7 string-key alignment landed
- First-run side pick landed
- IX-B soft vs READY distinction landed (yellow soft hint/copy, green READY; no fixed yaw gate)
- Copy polish after simulator defaults to collapsed (simulator default collapsed already done)

Note: Items 1–8 are documentation-only (no implementation tickets). In “next cuts,” #7 string-key alignment, first-run side pick, and IX-B soft vs READY copy have landed. The remaining eng ticket (simulator copy polish) is owned by the lead.
