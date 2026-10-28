/**
 * Every demo game, by the game mode — one bundle each. The order fixes the dev ports (`5190 + index`), so a
 * new mode goes at the end.
 */
export const DEMO_MODE_IDS = ['plinko', 'plinko-aztec', 'crush', 'twist', 'slot-coin', 'wheel', 'jumper', 'mine-slot'] as const;

export type DemoModeId = (typeof DEMO_MODE_IDS)[number];

/**
 * The demo games the configurator's demo registry (`features/demo-games`) lists; `scripts/export-to-configurator.ts`
 * copies only these. mine-slot is left out until the shell and the configurator have a mine-slot game mode.
 */
export const CONFIGURATOR_MODE_IDS: readonly DemoModeId[] = DEMO_MODE_IDS.filter((mode) => mode !== 'mine-slot');

export const isDemoModeId = (value: string): value is DemoModeId =>
  DEMO_MODE_IDS.some((mode) => mode === value);
