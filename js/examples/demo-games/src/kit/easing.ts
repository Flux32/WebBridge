/** Easing curves shared by every demo game: the same motion language across modes. */
export type Easing = (progress: number) => number;

export const linear: Easing = (t) => t;
export const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3;
export const easeInCubic: Easing = (t) => t ** 3;
export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const BACK_OVERSHOOT = 1.70158;
export const easeOutBack: Easing = (t) =>
  1 + (BACK_OVERSHOOT + 1) * (t - 1) ** 3 + BACK_OVERSHOOT * (t - 1) ** 2;

/** A decaying bounce for landings: ends exactly at 1. */
export const easeOutBounce: Easing = (t) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
  if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
  return n * (t - 2.625 / d) ** 2 + 0.984375;
};

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
