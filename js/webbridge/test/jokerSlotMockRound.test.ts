import type { JokerSlotBonusBuy, JokerSlotSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { evaluateLines } from '../src/joker-slot/jokerSlotMockBoards';
import { dealJokerSlotRound, type JokerSlotMockOutcome } from '../src/joker-slot/jokerSlotMockRound';
import { RECORDED_PLAYS, priceOf, recorded } from './jokerSlotFixtures';
import { expectRules } from './jokerSlotRoundRules';

/** A seeded generator: the same rounds on every run. */
const seeded = (seed: number) => {
  let state = seed;
  return (): number => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
};

const deal = (seed: number, choice: { bonusBuy?: JokerSlotBonusBuy; outcome?: JokerSlotMockOutcome } = {}): JokerSlotSpinResult =>
  dealJokerSlotRound({ bet: 0.5, currency: 'USD', random: seeded(seed), ...choice });

const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);
const actionsOf = (reply: JokerSlotSpinResult): string[] => reply.actions.flat().map((action) => action.action);
const openingOf = (reply: JokerSlotSpinResult) => reply.actions[0]!.find((action) => action.action === 'BONUS_BUY');

describe('the recorded replies', () => {
  it.each(RECORDED_PLAYS)('keep the round rules: %s', (name) => {
    expectRules(recorded(name), priceOf(name));
  });

  it('show a bought x75 bonus a cent below its parts: the coeff they write times the price, cut to cents', () => {
    expect(recorded('play-buy-x75-1').winAmount).toBe('30.99');
    expect(recorded('play-buy-x75-0').winAmount).toBe('5.00');
  });
});

describe('evaluateLines', () => {
  it.each(['play-win-lines', 'play-super-strike-lines'] as const)('pays the lines of the recorded %s board as the server did', (name) => {
    const reply = recorded(name);
    const recordedLines = reply.actions[0]!.find((action) => action.action === 'WIN_LINES');

    const lines = evaluateLines([...reply.boards[0]!], 1);

    expect(lines?.winLines.map((line) => line.winLineNumber)).toEqual(
      (recordedLines?.winLines as { winLineNumber: number }[]).map((line) => line.winLineNumber),
    );
  });
});

describe('dealJokerSlotRound', () => {
  it.each(SEEDS)('deals spins that keep the round rules (seed %i)', (seed) => {
    expectRules(deal(seed));
  });

  it.each(['lines', 'collect', 'superJoker', 'bonus'] as const)('deals a forced %s that keeps the rules', (outcome) => {
    for (const seed of SEEDS) expectRules(deal(seed, { outcome }));
  });

  it.each([
    ['x75', 75],
    ['x200', 200],
  ] as const)('sells the %s bonus at its full price and keeps the rules', (bonusBuy, price) => {
    for (const seed of SEEDS) {
      const reply = deal(seed, { bonusBuy });
      expect(reply.betAmount).toBe((0.5 * price).toFixed(2));
      expectRules(reply, price);
    }
  });

  it('starts an x75 bonus with Joker Coins and an x200 one with one Super Joker Coin', () => {
    const x75 = SEEDS.map((seed) => openingOf(deal(seed, { bonusBuy: 'x75' }))!.strikes as { symbol: string }[]);
    const x200 = SEEDS.map((seed) => openingOf(deal(seed, { bonusBuy: 'x200' }))!.strikes as { symbol: string }[]);

    expect(x75.flat().every((strike) => strike.symbol === 'l')).toBe(true);
    expect(x200.every((strikes) => strikes.length === 1 && strikes[0]!.symbol === 'm')).toBe(true);
  });

  it('collects with a forced joker and lets a Super Joker add its coins first', () => {
    expect(actionsOf(deal(3, { outcome: 'collect' }))).toContain('STRIKE_COINS_COLLECTION');
    expect(actionsOf(deal(3, { outcome: 'superJoker' })).slice(-2)).toEqual(['SUPER_STRIKE_COINS_ADDED', 'STRIKE_COINS_COLLECTION']);
  });

  it('opens a landed bonus with PILE_OF_GOLD and runs it to the end', () => {
    const reply = deal(5, { outcome: 'bonus' });

    expect(actionsOf(reply)).toEqual(expect.arrayContaining(['PILE_OF_GOLD', 'BONUS_RUN', 'BONUS_SPINS_COUNT']));
    expect(reply.rounds).toBeGreaterThan(3);
  });
});
