"""Runnable SIM demo: python -m sim.demo

Prints sparse + refine score tables and the peak / burst-best viewpoint.
"""

from __future__ import annotations

import argparse
import sys

from .pipeline import ConsentGate, run_side_capture
from .types import EarSide


def _table(title: str, rows: list[tuple]) -> None:
    print(f"\n=== {title} ===")
    hdr = f"{'label':<28} {'yaw':>7} {'sharp':>7} {'struct':>7} {'content':>8} {'combined':>9}"
    print(hdr)
    print("-" * len(hdr))
    for label, yaw, sharp, struct, content, combined in rows:
        print(
            f"{label:<28} {yaw:7.1f} {sharp:7.3f} {struct:7.3f} {content:8.3f} {combined:9.3f}"
        )


def _rows_from_scored(scored) -> list[tuple]:
    return [
        (
            s.viewpoint.label,
            s.viewpoint.yaw_deg,
            s.score.sharp,
            s.score.struct,
            s.score.content,
            s.score.combined,
        )
        for s in scored
    ]


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="SIM robot-ear workstation min path")
    p.add_argument(
        "--side",
        choices=("leftEar", "rightEar", "both"),
        default="rightEar",
        help="Which ear arc to sweep (default: rightEar)",
    )
    p.add_argument(
        "--peak-abs",
        type=float,
        default=55.0,
        help="Synthetic oracle peak |yaw| degrees (SIM only)",
    )
    args = p.parse_args(argv)

    print("robot-ear-workstation-poc  [SIM MODE]")
    print("consent → offline head pose → L/R arcs → ROI score → refine → burst")
    print("No ROS / no arm / no live RGB-D. Stub score mirrors auto_ear_detect quality.ts")

    consent = ConsentGate(granted=True, subject_id="sim-coop-01")
    sides: list[EarSide]
    if args.side == "both":
        sides = ["leftEar", "rightEar"]
    else:
        sides = [args.side]  # type: ignore[list-item]

    for side in sides:
        result = run_side_capture(
            side,
            consent=consent,
            synthetic_peak_yaw_abs=args.peak_abs,
        )
        print(f"\n--- side={side} consent={result.consent} "
              f"head_yaw={result.head.yaw_deg:.1f} track={result.head.tracking_confidence:.2f} ---")
        _table("sparse viewpoints", _rows_from_scored(result.sparse))
        _table("refine near peak", _rows_from_scored(result.refined))
        pk = result.peak
        print(
            f"\nPEAK viewpoint: {pk.viewpoint.label}  yaw={pk.viewpoint.yaw_deg:.1f}°  "
            f"combined={pk.score.combined:.3f}  "
            f"(sharp={pk.score.sharp:.3f} struct={pk.score.struct:.3f} content={pk.score.content:.3f})"
        )
        _table(
            "burst frames",
            [
                (
                    b.viewpoint.label,
                    b.viewpoint.yaw_deg,
                    b.score.sharp,
                    b.score.struct,
                    b.score.content,
                    b.score.combined,
                )
                for b in result.burst
            ],
        )
        best = result.best
        print(
            f"\nBURST PICK-BEST: frame={best.frame_index} yaw={best.viewpoint.yaw_deg:.1f}° "
            f"combined={best.score.combined:.3f}"
        )
        for n in result.notes:
            print(f"  note: {n}")

    print("\n[SIM] demo complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
