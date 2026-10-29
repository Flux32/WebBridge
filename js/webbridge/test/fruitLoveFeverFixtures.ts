import { readFileSync } from 'node:fs';
import type { FruitLoveFeverSpinResult, FruitLoveFeverStepResult } from '@omega/webbridge-protocol';

/** Replies the dev backend sent (2026-10-30), verbatim. */
const recorded = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/fruit-love-fever/${name}.json`, import.meta.url), 'utf8'));

// Recorded server replies: the shape is the server's, which the protocol types describe.
export const WIN_SPIN = recorded('play-win') as FruitLoveFeverSpinResult;
export const SCATTER_SPIN = recorded('play-scatter') as FruitLoveFeverSpinResult;
export const BOUGHT_SPIN = recorded('play-buy-x75') as FruitLoveFeverSpinResult;
export const FIRST_STEP = recorded('step-1') as FruitLoveFeverStepResult;
export const LAST_STEP = recorded('step-10') as FruitLoveFeverStepResult;
