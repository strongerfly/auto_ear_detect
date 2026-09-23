# Architecture — robot ear workstation PoC (SIM skeleton)

## Product framing

- **Scene:** seated, cooperative adult workstation; collaborative arm + wrist RGB-D.
- **Goal (short-term):** consent-gated sparse viewpoint sweep → ear ROI quality score
  → refine near peak → burst pick-best still frame.
- **Out of scope:** medical otoscope, mobile base, unattended near-face high-speed,
  ear canal/eardrum imaging, home navigation, child chase.
- **Mid-term (not implemented):** NBV, ear segmentation, auto-exposure — see FOLLOWUPS.

## Pipeline (logical)

```
consent gate
    → face / head pose (offline stub in SIM; MediaPipe-class tracker on HW)
    → L/R ear candidate arcs (~35°–90° relative head viewpoint)
    → sparse viewpoints along arc
    → per-view ear ROI score (sharp + struct + content → combined)
    → refine near peak (denser local samples)
    → burst capture → pick-best by score
```

| Stage | SIM (`sim/`) | Real (future) |
|-------|--------------|---------------|
| Consent | `ConsentGate` flag | UI + logged affirmative |
| Head pose | `head_pose.offline_seated_head` | Face/head tracker on RGB |
| Arcs | `viewpoints.candidate_arc` 35–90° | Same math → IK targets |
| Score | `score.measure_ear_quality` + `frontal_quality_score` | Same interface on wrist crop |
| Refine | `refine_near_peak` | Arm micro-moves |
| Burst | N synthetic jitters, max score | Camera burst / AE-locked frames |

## Reuse boundary vs `strongerfly/auto_ear_detect`

Fetched from `main` (curl raw / gh api trees; **no full clone**). Public surface
to reuse conceptually (and mirrored in Python stub):

### In-boundary (quality / score)

| Module | Public symbols | Role |
|--------|----------------|------|
| `src/lib/types.ts` | `EarQuality`, `RoiBox`, `EulerDeg`, `Landmark` | Shared structs |
| `src/lib/quality.ts` | `measureEarQuality`, `frontalQualityScore`, `unitInterval`, `classifyEarQuality`, `qualityAlongYawCurve`, `ImageDataLike`, `QualityKind` | Sharp (Laplacian) + struct (Sobel edge energy) + content (side-face yaw band + dark-center penalty) → combined 0–1 |
| `src/config/pose-config.json` (`score.*`, `search.*`, `ready.*`) | weights `sharp=0.45 / struct=0.35 / content=0.2`; yaw search 35–90°, preferred 40–80°; ready band / burst / autoshutter | Thresholds & weights |

### Adjacent (guidance / peak bookkeeping — **do not drive the robot UI verbatim**)

| Module | Public symbols | Reuse note |
|--------|----------------|------------|
| `src/lib/personal-best.ts` | `updatePersonalBest`, `qualityNearPeak`, `yawInSearchWindow`, `loadPersonalBests` / `savePersonalBests`, `PeakSample` | Peak-yaw logic useful; **drop `localStorage`** on robot |
| `src/lib/guidance.ts` | `evaluateGuidance` (etc.), `captureUiFor`, `captureHintKey`, `GuidanceResult` | Human phone prompts — **not** robot motion commands |
| `src/lib/auto-shutter.ts` | `stepAutoShutter`, `countdownSeconds` | Timing idea only; robot uses arm settle + burst |
| `src/lib/effective-targets.ts` | `effectiveTargets`, `inNearBand`, `inReadyBand` | Band hysteresis around bestYaw |
| `src/lib/progress.ts`, `capture-feedback.ts`, `chosen-side.ts`, `side-session.ts` | web session UX | **Out of robot reuse** |
| `src/lib/landmarks.ts`, `euler.ts`, `one-euro.ts`, `dwell.ts` | face geometry / filters | Optional later for head-pose bridge |

**Boundary rule:** robot owns motion, consent, HRI envelope, and burst orchestration.
Web modules own *image quality math* and *search-window constants*. Do not import
phone guidance copy as e-stop or trajectory logic.

Python parity lives in `sim/score.py` (stdlib). Optional TS bridge notes:
`sim/ts_adapter_notes.md`.

## Hardware assumptions (declared)

- Seated adult; cooperative; explicit consent each session.
- Collaborative arm with wrist RGB-D within a **fixed workstation envelope**.
- Subject does **not** walk; robot does not chase.
- Speed / force limited (placeholders in SAFETY.md); vision is **not** sole safety.

## Honest ceiling / shortfalls

- This tree is a **skeleton**: synthetic ROIs, no IK, no collision model, no depth.
- Score stub matches equations/weights but is **not** bit-identical to canvas ImageData
  (no browser gamma / ROI crop pipeline).
- Peak yaw in demo is an **oracle** for the synth image generator — real systems
  discover the peak from scores only (`personal-best` style).
- No claim of clinical / medical diagnostic use.
