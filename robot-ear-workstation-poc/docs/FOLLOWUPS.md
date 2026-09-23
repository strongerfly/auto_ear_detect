# Follow-ups (later tickets only — do not implement in this PoC)

| ID | Topic | Why later |
|----|-------|-----------|
| FU-01 | **NBV** (next-best-view planner) | Needs calibrated camera + collision-aware IK + information gain model; sparse arc is enough for short-term |
| FU-02 | **Ear segmentation** | Would tighten ROI vs hair/background; quality stub works on bbox crop first |
| FU-03 | **Auto-exposure / AE lock** | Hardware ISP + wrist cam controls; burst pick-best is a stopgap |
| FU-04 | TS score bridge | Optional Node RPC to `measureEarQuality` — see `sim/ts_adapter_notes.md` |
| FU-05 | Real head-pose tracker | Mediapipe / vendor face mesh → yaw for content prior |
| FU-06 | Personal-best persistence | Port `updatePersonalBest` without browser `localStorage` |

Keep this file as the backlog fence: **no NBV / ear-seg / AE code in `sim/` for this delivery.**
