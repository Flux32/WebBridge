import { DRAGON_POTS_BONUS_TYPES, type DragonPotsBonusBuy, type DragonPotsSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { evaluateWays, highlightOf } from '../src/dragon-pots/dragonPotsMockBoard';
import { dealDragonPotsRound, type DragonPotsMockOutcome } from '../src/dragon-pots/dragonPotsMockRound';
import { RECORDED_PLAYS, recorded } from './dragonPotsFixtures';
import { expectCoinsOnTheirCells, expectHoldAndWin, expectJackpotPick, expectTotals } from './dragonPotsRoundRules';

/** A seeded generator: the same rounds on every run. */
const seeded = (seed: number) => {
  let state = seed;
  return (): number => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
};

const PRICES: Readonly<Record<DragonPotsBonusBuy, number>> = { Mighty: 30, Mega: 55, Super: 80 };

/** Every rule of a reply; `priceInBets` is 1 unless the round was bought. */
const expectRules = (reply: DragonPotsSpinResult, priceInBets = 1): void => {
  expectCoinsOnTheirCells(reply);
  expectTotals(reply);
  const { jackpotResult, holdAndWinResult } = reply.roundResult;
  if (jackpotResult !== undefined) expectJackpotPick(jackpotResult);
  if (holdAndWinResult !== undefined) expectHoldAndWin(holdAndWinResult, priceInBets);
};

const keysOf = (reply: DragonPotsSpinResult): string[] => [
  ...Object.keys(reply).sort(),
  ...Object.keys(reply.roundResult).sort().map((key) => `roundResult.${key}`),
];

describe('evaluateWays', () => {
  it.each(RECORDED_PLAYS)('pays the ways of the recorded %s board as the server did', (name) => {
    const { mainGameResult } = recorded(name).roundResult;

    const wins = evaluateWays(mainGameResult.matrix);

    expect(wins).toEqual(mainGameResult.wins);
    expect(wins.map(highlightOf)).toEqual(mainGameResult.winsHighlight);
  });
});

describe('the recorded replies', () => {
  it.each(RECORDED_PLAYS.filter((name) => !name.startsWith('play-buy')))('keep the round rules: %s', (name) => {
    expectRules(recorded(name));
  });

  it.each(['play-mighty', 'play-mega', 'play-super', 'play-jackpot', 'play-ultra', 'play-supreme', 'play-ultimate'] as const)(
    'name the index and the board the protocol gives their outcome: %s',
    (name) => {
      const { bonusTypeName, bonusTypeIndex, holdAndWinResult } = recorded(name).roundResult;
      const outcome = DRAGON_POTS_BONUS_TYPES[bonusTypeName as keyof typeof DRAGON_POTS_BONUS_TYPES];

      expect(bonusTypeIndex).toBe(outcome.index);
      expect(holdAndWinResult?.boardSize ?? null).toBe(outcome.boardSize);
    },
  );

  it.each(['Mighty', 'Mega', 'Super'] as const)('keep the round rules of a bought %s', (buy) => {
    expectRules(recorded(`play-buy-${buy.toLowerCase()}` as 'play-buy-mighty'), PRICES[buy]);
  });
});

describe('dealDragonPotsRound', () => {
  it('deals rounds that keep the rules the recorded replies keep', () => {
    const random = seeded(7);
    for (let round = 0; round < 400; round += 1) {
      const reply = dealDragonPotsRound({ bet: 0.1, currency: 'USD', random });
      expectRules(reply);
      expect(reply.roundResult.mainGameResult.wins).toEqual(evaluateWays(reply.roundResult.mainGameResult.matrix));
    }
  });

  it('names no outcome when no coin landed, and Lose when coins landed without a trigger', () => {
    const random = seeded(11);
    const names = new Set<string>();
    for (let round = 0; round < 200; round += 1) {
      const { roundResult } = dealDragonPotsRound({ bet: 1, currency: 'USD', random });
      if (roundResult.coins.length === 0) expect([roundResult.bonusTypeName, roundResult.bonusTypeIndex]).toEqual(['', null]);
      names.add(roundResult.bonusTypeName);
    }
    expect(names).toContain('');
    expect(names).toContain('Lose');
  });

  it.each([
    ['Mighty', 0, false, '3x5'],
    ['Mega', 1, false, '4x5'],
    ['Super', 2, false, '5x5'],
    ['Jackpot', 3, true, null],
    ['Ultra', 4, true, '3x5'],
    ['Supreme', 5, true, '4x5'],
    ['Ultimate', 6, true, '5x5'],
    ['Lose', 7, false, null],
  ] as const)('forces %s: index %i, jackpot %s, Hold & Win %s', (outcome: DragonPotsMockOutcome, index, hasJackpot, boardSize) => {
    const reply = dealDragonPotsRound({ bet: 0.1, currency: 'USD', random: seeded(index + 20), outcome });

    const { roundResult } = reply;
    expect([roundResult.bonusTypeName, roundResult.bonusTypeIndex]).toEqual([outcome, index]);
    expect(roundResult.isJackpot).toBe(hasJackpot);
    expect(roundResult.holdAndWinResult?.boardSize ?? null).toBe(boardSize);
    expect(roundResult.coins.length).toBeGreaterThan(0);
    expectRules(reply);
  });

  it('gives every pot that triggers a coin', () => {
    const { roundResult } = dealDragonPotsRound({ bet: 0.1, currency: 'USD', random: seeded(3), outcome: 'Ultimate' });

    expect(new Set(roundResult.coins.map((coin) => coin.color))).toEqual(new Set(['Red', 'Green', 'Blue']));
  });

  it.each([
    ['Mighty', '3x5', 6, ['Blue']],
    ['Mega', '4x5', 8, ['Green']],
    ['Super', '5x5', 10, ['Blue', 'Green']],
  ] as const)('sells %s at its full price with an unnamed Hold & Win on %s from %i coins', (bonusBuy, boardSize, startCoins, pots) => {
    const reply = dealDragonPotsRound({ bet: 0.12, currency: 'USD', random: seeded(startCoins), bonusBuy });

    const { roundResult } = reply;
    expect(reply.betAmount).toBe((0.12 * PRICES[bonusBuy]).toFixed(2));
    expect([roundResult.bonusTypeName, roundResult.bonusTypeIndex, roundResult.isJackpot]).toEqual(['', null, false]);
    expect(roundResult.holdAndWinResult?.boardSize).toBe(boardSize);
    expect(roundResult.holdAndWinResult?.initial.coins.length).toBe(startCoins);
    // Coin values are in bets of the base bet, not of the price.
    roundResult.holdAndWinResult?.initial.coins.forEach((coin) => expect(Number(coin.coinWinAmount)).toBeCloseTo(coin.coinCoeff * 0.12, 9));
    expect([...roundResult.coins.map((coin) => coin.color)].sort()).toEqual([...pots].sort());
    expect(roundResult.mainGameResult.wins).toEqual([]);
    expectRules(reply, PRICES[bonusBuy]);
  });

  it('answers in the shape of the recorded replies', () => {
    expect(keysOf(dealDragonPotsRound({ bet: 0.1, currency: 'USD', random: seeded(1), outcome: 'Supreme' }))).toEqual(keysOf(recorded('play-supreme')));
    expect(keysOf(dealDragonPotsRound({ bet: 0.1, currency: 'USD', random: seeded(1), outcome: 'Ultra' }))).toEqual(keysOf(recorded('play-ultra')));
    expect(keysOf(dealDragonPotsRound({ bet: 0.1, currency: 'USD', random: seeded(1) }))).toEqual(
      keysOf(recorded('play-lose')).filter((key) => !key.includes('jackpot') && !key.includes('holdAndWin')),
    );
    expect(keysOf(dealDragonPotsRound({ bet: 0.12, currency: 'USD', random: seeded(1), bonusBuy: 'Mega' }))).toEqual(keysOf(recorded('play-buy-mega')));
  });
});
