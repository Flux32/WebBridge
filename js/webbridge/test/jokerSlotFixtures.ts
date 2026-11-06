import { readFileSync } from 'node:fs';
import type { JokerSlotSpinResult } from '@omega/webbridge-protocol';

/** Play replies the stage backend sent (2026-11-06), verbatim. */
export const RECORDED_PLAYS = [
  'play-lose',
  'play-win-lines',
  'play-coins',
  'play-super-strike',
  'play-super-strike-lines',
  'play-bonus',
  'play-buy-x75-0',
  'play-buy-x75-1',
  'play-buy-x75-2',
  'play-buy-x200-0',
  'play-buy-x200-1',
  'play-buy-x200-2',
] as const;

export type RecordedPlay = (typeof RECORDED_PLAYS)[number];

// Recorded server replies: the shape is the server's, which the protocol types describe.
export const recorded = (name: RecordedPlay): JokerSlotSpinResult =>
  JSON.parse(readFileSync(new URL(`./fixtures/joker-slot/${name}.json`, import.meta.url), 'utf8')) as JokerSlotSpinResult;

export const RECORDED_STATE: unknown = JSON.parse(readFileSync(new URL('./fixtures/joker-slot/state-none.json', import.meta.url), 'utf8'));

/** The price in bets a recorded play was charged at: its buy, or 1 for a spin. */
export const priceOf = (name: RecordedPlay): number => (name.startsWith('play-buy-x200') ? 200 : name.startsWith('play-buy-x75') ? 75 : 1);
