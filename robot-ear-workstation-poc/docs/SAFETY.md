# Safety envelope — workstation ear capture PoC

**Vision is NOT the sole safety basis.** Tracking loss, ROI scores, or face
presence must never be the only layer preventing contact. Collaborative-arm
force/torque limits, speed limits, workspace fencing, and a hard e-stop are
mandatory before any real motion.

## Placeholders (tune per robot / site — undecided product numbers)

| Parameter | Placeholder | Notes |
|-----------|-------------|-------|
| TCP linear speed (approach) | ≤ **50 mm/s** | Near-face zone |
| TCP linear speed (workspace transit) | ≤ **200 mm/s** | Away from head |
| Angular speed (wrist) | ≤ **15 °/s** | Near-face |
| Min HRI distance (TCP ↔ skin estimate) | ≥ **80 mm** | Depth + model; fail closed |
| Near-face keep-out sphere radius | **120 mm** from estimated ear | Soft virtual wall |
| Lost-track timeout | **200 ms** without face/head | Trigger retreat |
| Force/torque trip | vendor collab defaults | Do not raise for “better view” |

These are **engineering placeholders**, not certified limits.

## Behavioral rules

1. **Consent first** — no motion until explicit seated cooperative consent.
2. **Lost-track retreat** — if face/head track drops or depth invalid: stop
   approach, retract along last safe path to stow, open gripper/idle wrist cam.
3. **No chase** — subject movement out of seat / envelope → abort session.
4. **No high-speed near face** — never use industrial speeds in head envelope.
5. **Score ≠ clearance** — high ear quality score does not authorize closer TCP.
6. **Adult workstation only** — no child subjects; no home mobile base.

## Hard e-stop checklist (pre-hardware bring-up)

- [ ] Physical e-stop within operator reach; tested latched stop of arm power path
- [ ] Software stop + motion-disable discrete from vision process
- [ ] Collaborative mode / power & force limiting enabled and verified
- [ ] Workspace fence / table mount torque checks
- [ ] Lost-track retreat rehearsed in SIM then slow real
- [ ] Single-operator deadman or hold-to-run for first powered runs
- [ ] Clear abort phrase / UI cancel; cancels countdown and motion
- [ ] No auto-resume after e-stop without manual reset + re-consent

## SIM note

`sim/` only gates on a boolean `ConsentGate` and a fake `face_present` flag.
It does **not** implement e-stop, force limits, or depth keep-out.
