"""L/R ear candidate arcs (~35°–90° relative head viewpoint) → sparse samples.

Mirrors search window from auto_ear_detect pose-config.json:
  search.yawAbsMin=35, yawAbsMax=90, preferredAbsMin=40, preferredAbsMax=80.
Robot moves the wrist RGB-D (SIM: abstract viewpoints), not the subject.
"""

from __future__ import annotations

from typing import Iterable, List

from .types import EarSide, Viewpoint

# Product arc (relative head viewpoint magnitude)
YAW_ABS_MIN = 35.0
YAW_ABS_MAX = 90.0
# Sparse coarse samples then refine near peak
DEFAULT_SPARSE_STEP = 10.0
DEFAULT_REFINE_HALF_WIDTH = 8.0
DEFAULT_REFINE_STEP = 2.0


def _signed_yaw(abs_yaw: float, side: EarSide) -> float:
    return abs_yaw if side == "rightEar" else -abs_yaw


def candidate_arc(
    side: EarSide,
    abs_min: float = YAW_ABS_MIN,
    abs_max: float = YAW_ABS_MAX,
    step: float = DEFAULT_SPARSE_STEP,
    pitch_deg: float = 0.0,
    roll_deg: float = 0.0,
) -> List[Viewpoint]:
    """Sparse viewpoints along the ear-frontal arc for one side."""
    views: List[Viewpoint] = []
    abs_y = abs_min
    while abs_y <= abs_max + 1e-9:
        yaw = _signed_yaw(abs_y, side)
        views.append(
            Viewpoint(
                side=side,
                yaw_deg=yaw,
                pitch_deg=pitch_deg,
                roll_deg=roll_deg,
                label=f"{side}-sparse-{abs_y:.0f}",
            )
        )
        abs_y += step
    return views


def refine_near_peak(
    peak: Viewpoint,
    half_width: float = DEFAULT_REFINE_HALF_WIDTH,
    step: float = DEFAULT_REFINE_STEP,
) -> List[Viewpoint]:
    """Local denser samples around a coarse peak (still inside ~35–90 abs)."""
    side = peak.side
    center_abs = abs(peak.yaw_deg)
    views: List[Viewpoint] = []
    abs_y = max(YAW_ABS_MIN, center_abs - half_width)
    abs_end = min(YAW_ABS_MAX, center_abs + half_width)
    while abs_y <= abs_end + 1e-9:
        yaw = _signed_yaw(abs_y, side)
        views.append(
            Viewpoint(
                side=side,
                yaw_deg=yaw,
                pitch_deg=peak.pitch_deg,
                roll_deg=peak.roll_deg,
                label=f"{side}-refine-{abs_y:.0f}",
            )
        )
        abs_y += step
    return views


def both_sides_sparse(**kwargs: float) -> List[Viewpoint]:
    out: List[Viewpoint] = []
    for side in ("leftEar", "rightEar"):  # type: ignore[assignment]
        out.extend(candidate_arc(side, **kwargs))  # type: ignore[arg-type]
    return out
