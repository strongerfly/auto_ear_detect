export type EulerDeg = {
  yaw: number;
  pitch: number;
  roll: number;
};

export type EarQuality = {
  laplacian: number;
  brightness: number;
  edgeEnergy: number;
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
