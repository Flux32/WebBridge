/**
 * Every demo game, by the game mode — one bundle each. The order fixes the dev ports (`5190 + index`), so a
 * new mode goes at the end.
 */
export const DEMO_MODE_IDS = ['plinko', 'plinko-aztec', 'crush', 'twist', 'slot-coin', 'wheel', 'jumper', 'mine-slot', 'fruit-love-fever'] as const;

export type DemoModeId = (typeof DEMO_MODE_IDS)[number];

export const isDemoModeId = (value: string): value is DemoModeId =>
  DEMO_MODE_IDS.some((mode) => mode === value);
