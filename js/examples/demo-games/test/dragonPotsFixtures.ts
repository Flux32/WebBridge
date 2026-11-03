import { readFileSync } from 'node:fs';

/**
 * Play replies the stage backend sent (2026-11-03), verbatim: a plain loss, coins that triggered nothing, a
 * ways win, Mighty (Hold & Win 3x5), a jackpot pick, Ultimate (jackpot pick + Hold & Win) and two
 * bought bonuses.
 */
export const recorded = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`./fixtures/dragon-pots/${name}.json`, import.meta.url), 'utf8'));

/** A recorded reply with some fields of its `roundResult` changed. */
export const recordedWith = (name: string, changes: Record<string, unknown>): Record<string, unknown> => {
  const reply = recorded(name);
  return { ...reply, roundResult: { ...(reply.roundResult as object), ...changes } };
};
