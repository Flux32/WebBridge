import { readFileSync } from 'node:fs';
import type { DragonPotsSpinResult } from '@omega/webbridge-protocol';

/** Play replies the stage backend sent (2026-11-03), verbatim. */
export const RECORDED_PLAYS = [
  'play-lose',
  'play-lose-coins',
  'play-win',
  'play-win-ways',
  'play-mighty',
  'play-mega',
  'play-super',
  'play-jackpot',
  'play-supreme',
  'play-ultimate',
  'play-buy-mighty',
  'play-buy-mega',
  'play-buy-super',
] as const;

export type RecordedPlay = (typeof RECORDED_PLAYS)[number];

// Recorded server replies: the shape is the server's, which the protocol types describe.
export const recorded = (name: RecordedPlay): DragonPotsSpinResult =>
  JSON.parse(readFileSync(new URL(`./fixtures/dragon-pots/${name}.json`, import.meta.url), 'utf8')) as DragonPotsSpinResult;

export const RECORDED_STATE: unknown = JSON.parse(readFileSync(new URL('./fixtures/dragon-pots/state-none.json', import.meta.url), 'utf8'));
