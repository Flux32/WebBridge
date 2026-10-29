import { readFileSync } from 'node:fs';

/**
 * Replies the dev backend sent (2026-10-30), verbatim: `play-scatter` → `step-1` → `step-2` are the start of
 * one scatter bonus; `play-buy-x75` and `state-mid-bonus` (free spin 3 of 10) are of one bought bonus.
 */
export const recorded = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`./fixtures/fruit-love-fever/${name}.json`, import.meta.url), 'utf8'));

/** A recorded reply with some fields changed. */
export const recordedWith = (name: string, changes: Record<string, unknown>): Record<string, unknown> => ({
  ...recorded(name),
  ...changes,
});

/** The scatter bonus cut to two free spins: the play reply and both steps, the second one finishing it. */
export const twoSpinBonus = () => {
  const bonus = (name: string): Record<string, unknown> => ({ ...(recorded(name).bonusGame as object), totalFreeSpinsAmount: 2 });
  return {
    play: recordedWith('play-scatter', { bonusGame: bonus('play-scatter') }),
    first: recordedWith('step-1', { bonusGame: bonus('step-1') }),
    last: recordedWith('step-2', { bonusGame: bonus('step-2'), isFinished: true }),
  };
};
