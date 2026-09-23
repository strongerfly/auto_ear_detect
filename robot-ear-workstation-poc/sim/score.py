"""Pure-Python quality score stub mirroring auto_ear_detect src/lib/quality.ts.

Reuse boundary (web → this SIM stub):
  - measure_ear_quality  ≈ measureEarQuality(ImageDataLike) → EarQuality
  - frontal_quality_score ≈ frontalQualityScore(quality, yaw?, config) → 0..1
  - unit_interval         ≈ unitInterval
  - classify_ear_quality  ≈ classifyEarQuality → ok|hair|light

Weights / thresholds copied from pose-config.json (score.*) for honest parity.
Synthetic ROI images only — no MediaPipe / canvas / TS runtime here.
Optional later adapter: extract TS score via Node bridge; keep this interface.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional, Sequence, Tuple, Union

from .types import EarQuality, EarSide, ScoreBreakdown

# --- Defaults from strongerfly/auto_ear_detect src/config/pose-config.json ---

@dataclass(frozen=True)
class ScoreConfig:
    w_sharp: float = 0.45
    w_struct: float = 0.35
    w_content: float = 0.2
    laplacian_min: float = 80.0
    laplacian_good: float = 120.0
    edge_min: float = 15.0
    edge_good: float = 40.0
    yaw_abs_min: float = 35.0
    yaw_abs_max: float = 90.0
    preferred_abs_min: float = 40.0
    preferred_abs_max: float = 80.0
    outside_preferred_soft_penalty: float = 0.1
    require_side_face_proxy: bool = True
    penalize_meatus_dark: bool = True
    meatus_center_below: float = 40.0
    meatus_penalty: float = 0.25
    brightness_min: float = 60.0
    brightness_max: float = 200.0
    score_min_absolute: float = 0.35


DEFAULT_SCORE_CONFIG = ScoreConfig()

# Image: list of rows of (R,G,B) or flat RGB bytes + (w,h)
RgbImage = Union[Sequence[Sequence[Tuple[int, int, int]]], bytes]


def unit_interval(value: float, vmin: float, good: float) -> float:
    """Mirrors quality.unitInterval — clamp ((v-min)/(good-min)) to [0,1]."""
    if good <= vmin:
        return 1.0 if value >= good else 0.0
    return max(0.0, min(1.0, (value - vmin) / (good - vmin)))


def _to_gray(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def _as_gray_grid(
    image: RgbImage, width: Optional[int] = None, height: Optional[int] = None
) -> Tuple[list[list[float]], int, int]:
    if isinstance(image, (bytes, bytearray)):
        if width is None or height is None:
            raise ValueError("bytes image requires width and height")
        gray: list[list[float]] = []
        row: list[float] = []
        for i in range(0, len(image), 3):
            row.append(_to_gray(image[i], image[i + 1], image[i + 2]))
            if len(row) == width:
                gray.append(row)
                row = []
        return gray, width, height
    # nested RGB tuples
    h = len(image)
    w = len(image[0]) if h else 0
    gray = [[_to_gray(*px) for px in row] for row in image]
    return gray, w, h


def measure_ear_quality(
    image: RgbImage,
    width: Optional[int] = None,
    height: Optional[int] = None,
) -> EarQuality:
    """Mirrors measureEarQuality: Laplacian variance, Sobel edge energy, luma."""
    gray, w, h = _as_gray_grid(image, width, height)
    if w == 0 or h == 0:
        return EarQuality(0.0, 0.0, 0.0, 0.0)

    flat = [g for row in gray for g in row]
    brightness = sum(flat) / len(flat)

    x0, x1 = int(w * 0.35), max(int(w * 0.35) + 1, int(math.ceil(w * 0.65)))
    y0, y1 = int(h * 0.35), max(int(h * 0.35) + 1, int(math.ceil(h * 0.65)))
    center_vals = [gray[y][x] for y in range(y0, min(y1, h)) for x in range(x0, min(x1, w))]
    center_brightness = sum(center_vals) / len(center_vals) if center_vals else brightness

    if w < 3 or h < 3:
        return EarQuality(0.0, brightness, 0.0, center_brightness)

    laps: list[float] = []
    edge_sum = 0.0
    edge_n = 0
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = gray[y][x]
            L = gray[y - 1][x] + gray[y + 1][x] + gray[y][x - 1] + gray[y][x + 1] - 4 * c
            laps.append(L)
            gx = (
                -gray[y - 1][x - 1]
                + gray[y - 1][x + 1]
                - 2 * gray[y][x - 1]
                + 2 * gray[y][x + 1]
                - gray[y + 1][x - 1]
                + gray[y + 1][x + 1]
            )
            gy = (
                -gray[y - 1][x - 1]
                - 2 * gray[y - 1][x]
                - gray[y - 1][x + 1]
                + gray[y + 1][x - 1]
                + 2 * gray[y + 1][x]
                + gray[y + 1][x + 1]
            )
            edge_sum += math.hypot(gx, gy)
            edge_n += 1

    mean_l = sum(laps) / len(laps)
    laplacian = sum((v - mean_l) ** 2 for v in laps) / len(laps)
    edge_energy = 0.0 if edge_n == 0 else edge_sum / edge_n
    return EarQuality(laplacian, brightness, edge_energy, center_brightness)


def frontal_quality_score(
    quality: EarQuality,
    yaw: Optional[float] = None,
    config: ScoreConfig = DEFAULT_SCORE_CONFIG,
) -> ScoreBreakdown:
    """Mirrors frontalQualityScore: sharp + struct + content → combined 0..1.

    side is inferred from yaw sign when provided (SIM convenience).
    """
    sharp = unit_interval(quality.laplacian, config.laplacian_min, config.laplacian_good)
    struct = unit_interval(quality.edge_energy, config.edge_min, config.edge_good)

    content = 0.5
    side: EarSide = "rightEar" if (yaw is None or yaw >= 0) else "leftEar"
    if yaw is not None:
        abs_y = abs(yaw)
        in_search = config.yaw_abs_min <= abs_y <= config.yaw_abs_max
        content = 0.0 if (config.require_side_face_proxy and not in_search) else 1.0
        if in_search and (
            abs_y < config.preferred_abs_min or abs_y > config.preferred_abs_max
        ):
            content = max(0.0, content - config.outside_preferred_soft_penalty)

    if (
        config.penalize_meatus_dark
        and quality.center_brightness is not None
        and quality.center_brightness < config.meatus_center_below
        and quality.brightness > config.brightness_min
    ):
        content = max(0.0, content - config.meatus_penalty)

    combined = (
        config.w_sharp * sharp + config.w_struct * struct + config.w_content * content
    )
    return ScoreBreakdown(
        sharp=sharp,
        struct=struct,
        content=content,
        combined=combined,
        quality=quality,
        yaw_deg=float(yaw if yaw is not None else 0.0),
        side=side,
    )


def classify_ear_quality(
    quality: Optional[EarQuality],
    config: ScoreConfig = DEFAULT_SCORE_CONFIG,
) -> str:
    """Mirrors classifyEarQuality → 'ok' | 'hair' | 'light'."""
    if quality is None:
        return "hair"
    if (
        quality.laplacian < config.laplacian_min
        or quality.edge_energy < config.edge_min
    ):
        return "hair"
    if (
        quality.brightness < config.brightness_min
        or quality.brightness > config.brightness_max
    ):
        return "light"
    return "ok"


def make_synthetic_roi(
    yaw_deg: float,
    peak_yaw: float,
    size: int = 64,
    base_brightness: float = 120.0,
) -> list[list[Tuple[int, int, int]]]:
    """Build a tiny RGB ROI whose focus/edges peak near `peak_yaw` (SIM only).

    Smooth sinusoidal texture sized so Laplacian variance sits near the web
    pose-config raw bands (good ≈ 80–120). Far-from-peak views are flatter.
    Soft center dimming far from peak demonstrates meatus-like content penalty
    without hard edges that inflate Laplacian.
    """
    sigma = 12.0
    d = yaw_deg - peak_yaw
    scale = math.exp(-(d * d) / (2 * sigma * sigma))
    amp = 1.2 + 12.5 * scale
    freq = 0.50 + 0.40 * scale
    mean = float(base_brightness)
    # Soft center dim when off-peak (no hard disk edge)
    center_dim = max(0.0, 0.55 * (1.0 - scale))
    img: list[list[Tuple[int, int, int]]] = []
    cx = cy = (size - 1) / 2.0
    for y in range(size):
        row: list[Tuple[int, int, int]] = []
        for x in range(size):
            v = mean + amp * math.sin(freq * x) * math.cos(freq * y)
            v += 0.6 * math.sin(0.12 * x + 0.09 * y)
            # radial soft dim
            r = math.hypot(x - cx, y - cy) / (size * 0.5)
            if r < 0.45:
                v -= center_dim * 70.0 * (1.0 - r / 0.45)
            vi = max(0, min(255, int(round(v))))
            row.append((vi, vi, vi))
        img.append(row)
    return img



def score_synthetic_view(
    yaw_deg: float,
    peak_yaw: float,
    side: EarSide,
    config: ScoreConfig = DEFAULT_SCORE_CONFIG,
) -> ScoreBreakdown:
    """Convenience: synth ROI → measure → frontal score for one viewpoint."""
    roi = make_synthetic_roi(yaw_deg, peak_yaw)
    q = measure_ear_quality(roi)
    bd = frontal_quality_score(q, yaw=yaw_deg, config=config)
    # Preserve caller side (yaw sign already agrees for arc generators)
    return ScoreBreakdown(
        sharp=bd.sharp,
        struct=bd.struct,
        content=bd.content,
        combined=bd.combined,
        quality=bd.quality,
        yaw_deg=yaw_deg,
        side=side,
    )
