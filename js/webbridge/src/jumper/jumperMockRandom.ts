/** Random draws of the jumper mock, all from the injected source so tests can fix them. */
import type { JumperLadder } from '@omega/webbridge-protocol';
import { lastStepOf } from './jumperMockLadders';
import type { JumperMockRange, JumperSlotContent } from './jumperMockOptions';

export type RandomSource = () => number;

/** An integer within the range, both ends included. */
export const drawCount = (range: JumperMockRange, random: RandomSource): number =>
  range.min + Math.floor(random() * (range.max - range.min + 1));

export const drawWeighted = <T extends string>(weights: Readonly<Record<T, number>>, random: RandomSource): T => {
  const entries = Object.entries(weights) as [T, number][]; // Object.entries widens the keys back to string.
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) throw new RangeError('Jumper mock: slot weights must add up to more than zero');

  let remaining = random() * total;
  for (const [value, weight] of entries) {
    remaining -= weight;
    if (remaining < 0) return value;
  }
  // `random()` below 1 always lands inside; this is the last entry for a rounding edge.
  return entries[entries.length - 1]![0];
};

/**
 * Where a round's slots stand and what each holds. Slots spread over every step
 * below the top, as on the server, where the whole set is known from `play`.
 */
export const drawSlotLayout = (
  ladder: JumperLadder,
  count: number,
  weights: Readonly<Record<JumperSlotContent, number>>,
  random: RandomSource,
): ReadonlyMap<number, JumperSlotContent> => {
  const candidates = Array.from({ length: lastStepOf(ladder) }, (_, step) => step);
  const picked = Math.min(count, candidates.length);
  for (let index = 0; index < picked; index++) {
    const swapIndex = index + Math.floor(random() * (candidates.length - index));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex]!, candidates[index]!];
  }

  const steps = candidates.slice(0, picked).sort((left, right) => left - right);
  return new Map(steps.map((step) => [step, drawWeighted(weights, random)]));
};
