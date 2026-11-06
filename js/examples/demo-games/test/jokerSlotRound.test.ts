import type { JokerSlotSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { JokerSlotRoundError, planJokerSlotRound, type JokerSlotStep } from '../src/modes/joker-slot/jokerSlotRound';
import { recorded } from './jokerSlotFixtures';

const kindsOf = (steps: readonly JokerSlotStep[]): string[] => steps.map((step) => step.kind);

describe('planJokerSlotRound', () => {
  it('lights the cells of every payline the server paid', () => {
    const plan = planJokerSlotRound(recorded('play-win-lines'));

    expect(plan.boards[0]?.steps).toEqual([
      { kind: 'lines', cells: [0, 4, 8], coeff: 1 },
      { kind: 'lines', cells: [2, 5, 8], coeff: 1 },
    ]);
    expect(plan.winText).toBe('2.00 USD');
  });

  it('puts a Super Joker’s coins on the board before it collects them', () => {
    const [board] = planJokerSlotRound(recorded('play-super-strike')).boards;

    expect(kindsOf(board!.steps)).toEqual(['place', 'collect']);
    expect(board!.steps[1]).toEqual({ kind: 'collect', collection: { triggerIndex: 6, coins: [{ index: 0, coeff: 1 }, { index: 1, coeff: 2 }] } });
  });

  it('opens a bought bonus on the base board and counts its spins down to the end', () => {
    const plan = planJokerSlotRound(recorded('play-buy-x200-2'));

    expect(kindsOf(plan.boards[0]!.steps)).toEqual(['place', 'place', 'bonusBoard', 'collect']);
    expect(plan.boards[0]!.spinsLeft).toBeNull();
    expect(plan.boards.slice(1).map((board) => board.spinsLeft)).toEqual([2, 1, 3, 3, 3, 2, 1, 3, 2, 3, 2, 1, 0]);
    expect(kindsOf(plan.boards[3]!.steps)).toEqual(['place', 'collect', 'collect', 'collect']);
  });

  it('reads a coin without its coeff by the symbol the bonus board put in its cell', () => {
    const reply = recorded('play-bonus');
    const [first] = reply.actions;
    const collection = first![2] as { coins: { index: number; symbol: string }[] };
    collection.coins = collection.coins.map(({ index, symbol }) => ({ index, symbol }));

    const step = planJokerSlotRound(reply).boards[0]!.steps[2];

    expect(step).toEqual({ kind: 'collect', collection: { triggerIndex: 5, coins: [{ index: 2, coeff: 1 }, { index: 11, coeff: 1 }] } });
  });

  it('passes over an action it does not know', () => {
    const reply = recorded('play-coins');
    reply.actions[0]!.unshift({ action: 'SUPER_STRIKE_JACKPOT_ADDED', triggerIndex: 7 });

    expect(kindsOf(planJokerSlotRound(reply).boards[0]!.steps)).toEqual(['collect']);
  });

  it.each([
    ['a board of an unknown symbol', 'play-coins', (reply: JokerSlotSpinResult): void => void (reply.boards[0] = '12345678912z')],
    ['a joker off the board', 'play-coins', (reply: JokerSlotSpinResult): void => void ((reply.actions[0]![0] as { triggerIndex: number }).triggerIndex = 12)],
    [
      'a payline that does not exist',
      'play-win-lines',
      (reply: JokerSlotSpinResult): void => void ((reply.actions[0]![0] as { winLines: { winLineNumber: number }[] }).winLines[0]!.winLineNumber = 8),
    ],
  ] as const)('refuses %s', (_, name, breakIt) => {
    const reply = recorded(name);
    breakIt(reply);

    expect(() => planJokerSlotRound(reply)).toThrow(JokerSlotRoundError);
  });
});
