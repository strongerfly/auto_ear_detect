# Metrics template — capture PoC

Product pass thresholds marked **X% undecided** — do not invent certification bars.

## Core metrics

| Metric | Unit | Measured (fill) | Suggested threshold (draft) | Product threshold |
|--------|------|-----------------|-----------------------------|-------------------|
| Success rate (usable ear still) | % sessions | | ≥ 80% (lab draft) | **X% undecided** |
| Time-to-capture (consent→best frame) | s | | ≤ 45 s (lab draft) | **X% / Xs undecided** |
| Min HRI distance during approach | mm | | ≥ 80 mm (see SAFETY) | **undecided / site-specific** |
| Lost-track retreat rate | % sessions | | track & trend only | n/a |
| Peak combined score (0–1) | score | | ≥ 0.55 soft / lab | undecided |
| Operator abort rate | % | | track | n/a |

## Session log columns (CSV)

See `docs/metrics_template.csv`.

## Notes

- “Usable” = human rater or downstream model accepts frame — define per study.
- Compare SIM oracle peak vs discovered peak only for stub validation, not product KPIs.
- Never trade min HRI distance for higher score.
