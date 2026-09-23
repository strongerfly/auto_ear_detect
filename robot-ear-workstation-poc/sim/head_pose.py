"""Offline / simulated head pose (SIM). No MediaPipe, no live camera."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class HeadPose:
    """Head orientation in degrees (camera/world relative, SIM convention).

    yaw > 0: subject turns left → right ear more frontal to camera
    yaw < 0: subject turns right → left ear more frontal
    (Matches auto_ear_detect side convention: rightEar yaw>0, leftEar yaw<0.)
    """

    yaw_deg: float
    pitch_deg: float = 0.0
    roll_deg: float = 0.0
    face_present: bool = True
    tracking_confidence: float = 0.95


def offline_seated_head(
    yaw_deg: float = 0.0,
    pitch_deg: float = 0.0,
    roll_deg: float = 0.0,
) -> HeadPose:
    """Static seated cooperative subject — default PoC fixture."""
    return HeadPose(
        yaw_deg=yaw_deg,
        pitch_deg=pitch_deg,
        roll_deg=roll_deg,
        face_present=True,
        tracking_confidence=0.98,
    )
