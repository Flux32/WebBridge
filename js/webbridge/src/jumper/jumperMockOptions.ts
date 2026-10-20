/**
 * Options of the jumper mock: the ladders it serves, the bet it plays for and
 * how its made-up rounds go.
 */
import type { JumperAccelerator, JumperDifficulty, JumperLadder } from '@omega/webbridge-protocol';
import { DEV_BACKEND_JUMPER_LADDERS } from './jumperMockLadders';

/** What a hidden slot turns out to be. */
export type JumperSlotContent = 'NONE' | JumperAccelerator;

/** Inclusive bounds of a random count. */
export interface JumperMockRange {
  readonly min: number;
  readonly max: number;
}

export interface JumperMockHostOptions {
  /** One ladder per difficulty; by default the dev backend's tables. */
  ladders: readonly JumperLadder[];
  /** The difficulty in play until `setDifficulty`. */
  difficulty: JumperDifficulty;
  /** Chance to fall on each jump; in a free game, chance its next jump is the last. */
  loseChance: number;
  /** How many accelerator slots a round spreads over its ladder. */
  slotCount: JumperMockRange;
  /** Relative odds of what a slot holds; in a free game, of how each jump goes. */
  slotWeights: Readonly<Record<JumperSlotContent, number>>;
  /** How many free games a bought bonus holds. */
  bonusGameCount: JumperMockRange;
  /** The bet as the server's decimal string. */
  betAmount: string;
  currency: string;
  decimalPlaces: number;
  /** Source of randomness; tests replace it so the outcome is known. */
  random: () => number;
}

export const DEFAULT_JUMPER_MOCK_OPTIONS: JumperMockHostOptions = {
  ladders: DEV_BACKEND_JUMPER_LADDERS,
  difficulty: 'EASY',
  loseChance: 0.15,
  slotCount: { min: 5, max: 18 },
  slotWeights: { NONE: 4, TRAMPOLINE: 3, JETPACK: 2, ROCKET: 1 },
  bonusGameCount: { min: 3, max: 10 },
  betAmount: '1.00',
  currency: 'USD',
  decimalPlaces: 2,
  random: Math.random,
};
