# Hardware gaps — real arm + wrist RGB-D

What this SIM skeleton does **not** provide:

| Gap | Impact | Needed for real path |
|-----|--------|----------------------|
| Collaborative arm + drivers | No motion | Vendor SDK / ROS2 control, collab mode |
| Wrist RGB-D camera | No real ROI / depth | Intrinsics, sync, mount TF |
| Hand–eye calibration | Viewpoints ≠ TCP poses | Eye-in-hand calib routine |
| IK + collision model | Arc angles not executable | Robot URDF, head/torso keep-out meshes |
| Force/torque / speed limiting | Safety incomplete | Verified collab parameters + e-stop wiring |
| Live face/head tracker | Content prior / lost-track | RGB tracker process, latency budget |
| Depth-based min HRI distance | Soft keep-out unrealized | Point cloud / depth ROI → distance estimate |
| Lighting / AE control | Score brittle | Controlled workstation light + AE lock |
| Consent UI + audit log | Compliance | Operator tablet / logged consent |
| Burst camera API | Fake jitter only | Hardware trigger or multi-frame grab |

## Scaffold vs deferred

- **Scaffolded here:** consent flag, arc math 35–90°, score interface, refine/burst logic, docs.
- **Deferred:** everything in the table above; offline traj file format TBD once arm brand chosen.

Until gaps close, treat all demo scores as **SIM fixtures**, not field performance.
