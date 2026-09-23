"""SIM pipeline: consent → head pose → arcs → score → refine → burst pick-best.

All stages are offline stubs. Hardware gaps documented in docs/HARDWARE_GAPS.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Sequence

from .head_pose import HeadPose, offline_seated_head
from .score import DEFAULT_SCORE_CONFIG, ScoreConfig, score_synthetic_view
from .types import BurstPick, EarSide, ScoreBreakdown, Viewpoint
from .viewpoints import candidate_arc, refine_near_peak


@dataclass
class ConsentGate:
    """Explicit seated cooperative consent — required before any motion (SIM)."""

    granted: bool = False
    subject_id: str = "sim-subject"

    def require(self) -> None:
        if not self.granted:
            raise RuntimeError("Consent not granted — abort (SIM safety gate)")


@dataclass
class ScoredView:
    viewpoint: Viewpoint
    score: ScoreBreakdown


@dataclass
class PipelineResult:
    side: EarSide
    consent: bool
    head: HeadPose
    sparse: List[ScoredView]
    refined: List[ScoredView]
    peak: ScoredView
    burst: List[BurstPick]
    best: BurstPick
    notes: List[str] = field(default_factory=list)


def _score_views(
    views: Sequence[Viewpoint],
    peak_yaw: float,
    config: ScoreConfig,
) -> List[ScoredView]:
    out: List[ScoredView] = []
    for v in views:
        bd = score_synthetic_view(v.yaw_deg, peak_yaw, v.side, config=config)
        out.append(ScoredView(viewpoint=v, score=bd))
    return out


def _argmax(scored: Sequence[ScoredView]) -> ScoredView:
    return max(scored, key=lambda s: s.score.combined)


def run_side_capture(
    side: EarSide,
    *,
    consent: ConsentGate,
    head: Optional[HeadPose] = None,
    # Ground-truth peak for synthetic ROI (SIM oracle — not available on hardware)
    synthetic_peak_yaw_abs: float = 55.0,
    burst_frames: int = 3,
    config: ScoreConfig = DEFAULT_SCORE_CONFIG,
) -> PipelineResult:
    """Full min-path for one ear side (SIM)."""
    consent.require()
    head = head or offline_seated_head()
    if not head.face_present:
        raise RuntimeError("Lost face track — retreat (SIM)")

    sign = 1.0 if side == "rightEar" else -1.0
    peak_yaw = sign * abs(synthetic_peak_yaw_abs)

    sparse_views = candidate_arc(side)
    sparse = _score_views(sparse_views, peak_yaw, config)
    coarse_peak = _argmax(sparse)

    refined_views = refine_near_peak(coarse_peak.viewpoint)
    refined = _score_views(refined_views, peak_yaw, config)
    peak = _argmax(refined)

    # Burst: re-score same peak pose N times with tiny yaw jitter (SIM motion)
    burst: List[BurstPick] = []
    for i in range(burst_frames):
        jitter = (i - (burst_frames - 1) / 2.0) * 0.5
        yaw = peak.viewpoint.yaw_deg + jitter
        vp = Viewpoint(
            side=side,
            yaw_deg=yaw,
            pitch_deg=peak.viewpoint.pitch_deg,
            roll_deg=peak.viewpoint.roll_deg,
            label=f"{side}-burst-{i}",
        )
        bd = score_synthetic_view(yaw, peak_yaw, side, config=config)
        burst.append(BurstPick(viewpoint=vp, score=bd, frame_index=i))

    best = max(burst, key=lambda b: b.score.combined)
    notes = [
        "SIM: synthetic ROI + stub score; no real RGB-D / arm motion",
        f"oracle peak yaw (abs)={synthetic_peak_yaw_abs}° for synth image generator",
        "Vision is NOT sole safety basis — see docs/SAFETY.md",
    ]
    return PipelineResult(
        side=side,
        consent=consent.granted,
        head=head,
        sparse=sparse,
        refined=refined,
        peak=peak,
        burst=burst,
        best=best,
        notes=notes,
    )
