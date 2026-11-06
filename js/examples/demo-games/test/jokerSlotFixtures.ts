import { readFileSync } from 'node:fs';
import type { JokerSlotSpinResult } from '@omega/webbridge-protocol';

/**
 * Play replies the stage backend sent (2026-11-06), verbatim: a loss, two paylines, a Joker collection, a
 * Super Joker, the bonus from landed jokers, and the x75 and x200 buys.
 */
export const recorded = (name: string): JokerSlotSpinResult =>
  JSON.parse(readFileSync(new URL(`./fixtures/joker-slot/${name}.json`, import.meta.url), 'utf8')) as JokerSlotSpinResult;
