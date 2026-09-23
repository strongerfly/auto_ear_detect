# robot-ear-workstation-poc (SIM skeleton)

Short-term **workstation** robot ear-capture PoC: seated cooperative subject,
collaborative arm + wrist RGB-D (hardware deferred). This tree is **simulation /
offline only** — no ROS, no arm drivers, no live camera.

**Not in scope:** medical otoscope, mobile base, unattended near-face high-speed,
ear canal / eardrum, home nav, child chase. Mid-term NBV / ear seg / AE → see
`docs/FOLLOWUPS.md` only.

## Layout

```
robot-ear-workstation-poc/
  README.md
  requirements.txt
  docs/           ARCHITECTURE, SAFETY, METRICS, FOLLOWUPS, HARDWARE_GAPS (+ zh)
  sim/            pure-Python offline pipeline + quality stub
```

## How to run (SIM)

From the repo root:

```bash
cd robot-ear-workstation-poc
# optional venv
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # currently empty / comments only

python -m sim.demo
python -m sim.demo --side both --peak-abs 55
```

Expected: sparse + refine score tables, a **PEAK viewpoint**, burst pick-best,
and clear `[SIM]` banners.

## Score reuse

Python stub in `sim/score.py` mirrors `strongerfly/auto_ear_detect` web modules
(`measureEarQuality` / `frontalQualityScore` sharp+struct+content). See
`docs/ARCHITECTURE.md` reuse boundary and `sim/ts_adapter_notes.md`.

## Docs

| File | Purpose |
|------|---------|
| `docs/ARCHITECTURE.md` (+ `.zh-CN.md`) | Pipeline + reuse boundary + HW assumptions |
| `docs/SAFETY.md` (+ zh) | Envelope, e-stop; vision ≠ sole safety |
| `docs/METRICS_TEMPLATE.md` | Success / time / min HRI distance |
| `docs/FOLLOWUPS.md` | NBV / ear seg / AE tickets later |
| `docs/HARDWARE_GAPS.md` | What’s missing for real arm+RGB-D |
