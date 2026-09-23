"""Shared types mirroring auto_ear_detect src/lib/types.ts (EarQuality subset)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional


EarSide = Literal["leftEar", "rightEar"]


@dataclass(frozen=True)
class EarQuality:
    """Mirrors auto_ear_detect EarQuality (src/lib/types.ts)."""

    laplacian: float
    brightness: float
    edge_energy: float
    center_brightness: Optional[float] = None


@dataclass(frozen=True)
class ScoreBreakdown:
    """Combined frontal score + sharp/struct/content unit components."""

    sharp: float
    struct: float
    content: float
    combined: float
    quality: EarQuality
    yaw_deg: float
    side: EarSide


@dataclass(frozen=True)
class Viewpoint:
    """Sparse camera pose relative to head (SIM framing)."""

    side: EarSide
    yaw_deg: float  # relative head viewpoint (signed: + right, - left)
    pitch_deg: float
    roll_deg: float
    label: str = ""


@dataclass(frozen=True)
class BurstPick:
    viewpoint: Viewpoint
    score: ScoreBreakdown
    frame_index: int
