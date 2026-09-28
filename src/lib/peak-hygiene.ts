export type PeakHygieneState = {
  lostStreak: number;
  /** Frames still ignored after a brief face-loss blip. */
  cooldown: number;
};

export const EMPTY_PEAK_HYGIENE: PeakHygieneState = {
  lostStreak: 0,
  cooldown: 0,
};

export type PeakHygieneConfig = {
  ignoreFrameIfFaceLost: boolean;
  maxFaceLostFrames: number;
};

/**
 * Do not move bestYaw while the face is gone, while the ear box is clipped,
 * or for a short cooldown after a brief tracking blip. A long absence is
 * capped at `maxFaceLostFrames` so learning can resume. Not a yaw gate.
 * `earInFrame === undefined` means unknown (simulator) and is allowed.
 */
export function stepPeakHygiene(
  state: PeakHygieneState,
  hasFace: boolean,
  earInFrame: boolean | undefined,
  config: PeakHygieneConfig,
): { state: PeakHygieneState; allowPeakUpdate: boolean } {
  if (!hasFace) {
    return {
      state: { lostStreak: state.lostStreak + 1, cooldown: 0 },
      allowPeakUpdate: false,
    };
  }

  let cooldown = state.cooldown;
  if (state.lostStreak > 0 && config.ignoreFrameIfFaceLost) {
    cooldown = Math.min(
      state.lostStreak,
      Math.max(0, config.maxFaceLostFrames),
    );
  }

  return {
    state: {
      lostStreak: 0,
      cooldown: cooldown > 0 ? cooldown - 1 : 0,
    },
    allowPeakUpdate: earInFrame !== false && cooldown === 0,
  };
}
