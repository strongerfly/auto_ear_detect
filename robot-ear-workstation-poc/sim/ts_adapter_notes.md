# Optional adapter: wire extracted TypeScript score later

This PoC uses a **pure-Python stub** (`sim/score.py`) that mirrors:

| Python | TypeScript (`strongerfly/auto_ear_detect`) |
|--------|-------------------------------------------|
| `measure_ear_quality` | `src/lib/quality.ts` → `measureEarQuality` |
| `frontal_quality_score` | `src/lib/quality.ts` → `frontalQualityScore` |
| `unit_interval` | `src/lib/quality.ts` → `unitInterval` |
| `classify_ear_quality` | `src/lib/quality.ts` → `classifyEarQuality` |
| `EarQuality` | `src/lib/types.ts` |

## Suggested later wiring (not implemented)

1. Extract / vendor the TS modules + `pose-config.json` into a Node package.
2. Expose a tiny HTTP or stdin JSON RPC: `{rgba, width, height, yaw?} → EarQuality + score`.
3. Keep `sim/score.py` as the interface; add `sim/score_ts_bridge.py` that POSTs ROI bytes.
4. Do **not** depend on the web UI (`guidance.ts` prompts, `localStorage` personal-best).

Peak / refine / burst orchestration stays in the robot pipeline (this repo), not in the web app.
