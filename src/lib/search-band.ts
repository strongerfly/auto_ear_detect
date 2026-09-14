import type { EarSide, PoseConfig } from "../config";
import { poseConfig } from "../config";

export function earSearch(
  side: EarSide,
  config: PoseConfig = poseConfig,
): PoseConfig["search"]["rightEar"] {
  return config.search[side];
}
