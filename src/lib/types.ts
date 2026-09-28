export type EulerDeg = {
  yaw: number;
  pitch: number;
  roll: number;
};

export type EarQuality = {
  laplacian: number;
  brightness: number;
  edgeEnergy: number;
  /** Mean luma of the ROI center (meatus-like dark-blob cue). */
  centerBrightness?: number;
  /** Laplacian variance in the inner half of the crop. */
  centerSharpness?: number;
  /** Laplacian variance outside that inner half. */
  borderSharpness?: number;
};

export type RoiBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};
