import { describe, expect, it } from 'vitest';
import { CrushRound, toLadder } from '../src/modes/crush/crushRound';

const LADDER = [1.1, 1.5, 2.2];

describe('CrushRound', () => {
  it('starts in front of the first step', () => {
    const round = new CrushRound(LADDER);
    expect(round.step).toBe(-1);
    expect(round.coefficient).toBeNull();
  });

  it('advances one step on a survived step', () => {
    const round = new CrushRound(LADDER);
    expect(round.applyStep({ isWinMain: true, coinsTriggered: false, coinsCollected: [] })).toBe('advance');
    expect(round.step).toBe(0);
    expect(round.coefficient).toBe(1.1);
  });

  it('reaches the top on a survived last step', () => {
    const round = new CrushRound(LADDER);
    round.restore(1);
    expect(round.applyStep({ isWinMain: true, coinsTriggered: false, coinsCollected: [] })).toBe('top');
    expect(round.step).toBe(2);
  });

  it('is crushed on a lost step, on the step it aimed at', () => {
    const round = new CrushRound(LADDER);
    expect(round.applyStep({ isWinMain: false, coinsTriggered: false, coinsCollected: [] })).toBe('crush');
    expect(round.step).toBe(0);
  });

  it('goes back in front of the first step on reset', () => {
    const round = new CrushRound(LADDER);
    round.restore(1);
    round.reset();
    expect(round.step).toBe(-1);
  });

  it('keeps the step when a new ladder arrives', () => {
    const round = new CrushRound(LADDER);
    round.restore(1);
    round.setLadder([1.2, 1.9, 3]);
    expect(round.coefficient).toBe(1.9);
  });
});

describe('toLadder', () => {
  it('reads the coefficients the server sends as decimal strings', () => {
    expect(toLadder(['1.03', 1.5, '2'])).toEqual([1.03, 1.5, 2]);
  });

  it('refuses a ladder with a value that is not a number', () => {
    expect(toLadder(['1.03', 'x'])).toBeNull();
  });
});
