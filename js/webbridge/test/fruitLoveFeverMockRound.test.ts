import type { FruitLoveFeverSpinResult, FruitLoveFeverStepResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { evaluateLines, type MockBoard } from '../src/fruit-love-fever/fruitLoveFeverMockBoards';
import { FruitLoveFeverMockRound } from '../src/fruit-love-fever/fruitLoveFeverMockRound';
import { BOUGHT_SPIN, LAST_STEP, SCATTER_SPIN, WIN_SPIN } from './fruitLoveFeverFixtures';

/** A seeded generator: the same rounds on every run. */
const seeded = (seed: number) => {
  let state = seed;
  return (): number => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
};

const boardOf = (reply: FruitLoveFeverSpinResult): MockBoard =>
  (['1', '2', '3', '4', '5'] as const).map((reel) =>
    reply.slot.reelsCells[reel].map((cell) => ({
      symbol: cell.outcomeNumber,
      ...(cell.coeff === undefined ? {} : { coeff: Number(cell.coeff) }),
    })),
  );

const playToTheEnd = (round: FruitLoveFeverMockRound): FruitLoveFeverStepResult[] => {
  const steps: FruitLoveFeverStepResult[] = [];
  while (!round.isFinished) steps.push(round.nextStep());
  return steps;
};

/** Every top-level key and the keys of `slot` and `bonusGame`: the shape a scene reads. */
const shapeOf = (reply: FruitLoveFeverSpinResult): string[] => [
  ...Object.keys(reply).sort(),
  ...Object.keys(reply.slot).sort().map((key) => `slot.${key}`),
  ...Object.keys(reply.bonusGame ?? {}).sort().map((key) => `bonusGame.${key}`),
];

describe('evaluateLines', () => {
  it('pays the lines of a recorded spin as the server did', () => {
    expect(evaluateLines(boardOf(WIN_SPIN))).toEqual(WIN_SPIN.slot.winLines);
  });

  it('adds up the multipliers of the wilds in a line, as the last free spin of a recorded bonus', () => {
    expect(evaluateLines(boardOf(LAST_STEP))).toEqual(LAST_STEP.slot.winLines);
  });
});

describe('FruitLoveFeverMockRound', () => {
  it('finishes a spin without three scatters in the play reply', () => {
    const round = new FruitLoveFeverMockRound({ amount: 1, currency: 'USD', random: () => 0.5 });

    expect(round.isFinished).toBe(true);
    expect(round.lastReply.bonusGame).toBeUndefined();
    expect(round.lastReply.winAmount).toBe(Number(round.lastReply.coeff).toFixed(2));
  });

  it('answers in the shape of the recorded replies', () => {
    const bought = new FruitLoveFeverMockRound({ amount: 7.5, currency: 'USD', bonusBuy: 'x75', random: seeded(1) });
    const opening = bought.lastReply;
    const [firstStep] = playToTheEnd(bought);

    expect(shapeOf(opening)).toEqual(shapeOf(BOUGHT_SPIN));
    expect(shapeOf(firstStep!)).toEqual(shapeOf(BOUGHT_SPIN));
  });

  it('opens a bought bonus at its price with nothing paid and no free spin played', () => {
    const round = new FruitLoveFeverMockRound({ amount: 200, currency: 'USD', bonusBuy: 'x200', random: seeded(2) });

    expect(round.lastReply).toMatchObject({ betAmount: '200.00', bonusBuy: 'x200', isFinished: false, winAmount: '0.00', coeff: 0 });
    expect(round.lastReply.bonusGame?.currentGameNumber).toBeNull();
    expect(round.lastReply.bonusGame?.totalFreeSpinsAmount).toBeGreaterThanOrEqual(8);
    expect(round.lastReply.bonusGame?.totalFreeSpinsAmount).toBeLessThanOrEqual(12);
  });

  it('keeps every wild of a free spin in its cell until the bonus ends', () => {
    const round = new FruitLoveFeverMockRound({ amount: 1, currency: 'USD', bonusBuy: 'x200', random: seeded(3) });
    const wildsOf = (step: FruitLoveFeverStepResult): string[] =>
      Object.entries(step.slot.reelsCells).flatMap(([reel, cells]) =>
        cells.filter((cell) => cell.outcomeNumber === 0).map((cell) => `${reel}:${cell.index}`),
      );

    const steps = playToTheEnd(round);

    steps.slice(1).forEach((step, index) => expect(wildsOf(step)).toEqual(expect.arrayContaining(wildsOf(steps[index]!))));
    expect(wildsOf(steps.at(-1)!).length).toBeGreaterThan(0);
  });

  it('runs the total in winAmount and settles the coefficient on the last free spin', () => {
    const round = new FruitLoveFeverMockRound({ amount: 7.5, currency: 'USD', bonusBuy: 'x75', random: seeded(4) });

    const steps = playToTheEnd(round);
    const total = steps.reduce((sum, step) => sum + Number(step.bonusGame.winAmount), 0);
    const last = steps.at(-1)!;

    steps.slice(0, -1).forEach((step) => expect(step).toMatchObject({ isFinished: false, coeff: 0 }));
    expect(last.isFinished).toBe(true);
    expect(last.winAmount).toBe(total.toFixed(2));
    expect(last.coeff).toBeCloseTo(total / 7.5, 3);
  });

  it('pays the scatters of the spin that starts a bonus, as the recorded scatter spin did', () => {
    const random = seeded(5);
    let round = new FruitLoveFeverMockRound({ amount: 1, currency: 'USD', random });
    for (let attempt = 0; attempt < 2000 && round.isFinished; attempt += 1) {
      round = new FruitLoveFeverMockRound({ amount: 1, currency: 'USD', random });
    }

    expect(round.isFinished).toBe(false);
    expect(Number(round.lastReply.winAmount)).toBeGreaterThanOrEqual(Number(SCATTER_SPIN.winAmount));
    expect(round.lastReply.bonusGame?.currentGameNumber).toBeNull();
  });

  it('deals wilds on reels 2-4 only and no scatter in a free spin', () => {
    const round = new FruitLoveFeverMockRound({ amount: 1, currency: 'USD', bonusBuy: 'x200', random: seeded(6) });

    const cells = playToTheEnd(round).flatMap((step) =>
      Object.entries(step.slot.reelsCells).flatMap(([reel, reelCells]) => reelCells.map((cell) => ({ reel, code: cell.outcomeNumber }))),
    );

    expect(cells.filter((cell) => cell.code === 12)).toEqual([]);
    expect(new Set(cells.filter((cell) => cell.code === 0).map((cell) => cell.reel))).not.toContain('1');
    expect(new Set(cells.filter((cell) => cell.code === 0).map((cell) => cell.reel))).not.toContain('5');
  });

  it('refuses a free spin once the bonus is over', () => {
    const round = new FruitLoveFeverMockRound({ amount: 1, currency: 'USD', random: () => 0.5 });

    expect(() => round.nextStep()).toThrow(/no free spin left/);
  });
});
