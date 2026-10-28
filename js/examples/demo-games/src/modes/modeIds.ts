/**
 * Every demo game, by the configurator's game mode — one bundle each. The configurator's demo registry
 * (`features/demo-games`) lists the same ids; `scripts/export-to-configurator.ts` copies the bundles there.
 */
export const DEMO_MODE_IDS = ['plinko', 'plinko-aztec', 'crush', 'twist', 'slot', 'wheel', 'jumper'] as const;

export type DemoModeId = (typeof DEMO_MODE_IDS)[number];

export const isDemoModeId = (value: string): value is DemoModeId =>
  DEMO_MODE_IDS.some((mode) => mode === value);
