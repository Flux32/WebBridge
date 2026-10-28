import type { SlotCoinSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { planSlotCoinRound, SlotCoinRoundError } from '../src/modes/slot-coin/slotCoinRound';

/** Column-major, 3 reels x 4 rows: the coin `c` (x3) tops reel 1, the trigger `l` sits mid reel 2. */
const BOARD = 'c123' + '45l6' + '789b';

const spinResult = (overrides: Partial<SlotCoinSpinResult> = {}): SlotCoinSpinResult => ({
  betAmount: '1.000000000',
  coeff: '5',
  currency: 'USD',
  isFinished: true,
  isWin: true,
  winAmount: '5.00',
  rounds: 1,
  boards: [BOARD],
  actions: [
    [
      {
        action: 'STRIKE_COINS_COLLECTION',
        triggerIndex: 6,
        coins: [
          { index: 0, symbol: 'c', coeff: '3', payout: '3.00' },
          { index: 11, symbol: 'b', coeff: '2', payout: '2.00' },
        ],
      },
    ],
  ],
  ...overrides,
});

describe('planSlotCoinRound', () => {
  it('reads a board column by column, top to bottom', () => {
    const plan = planSlotCoinRound(spinResult());
    const [board] = plan.boards;
    expect(board?.cells[0]).toEqual({ kind: 'coin', coeff: 3 });
    expect(board?.cells[1]).toEqual({ kind: 'base', rank: 1 });
    expect(board?.cells[6]).toEqual({ kind: 'trigger' });
    expect(board?.cells).toHaveLength(12);
  });

  it('turns a coin collection into a flight to the trigger cell', () => {
    const plan = planSlotCoinRound(spinResult());
    expect(plan.boards[0]?.collection).toEqual({
      triggerIndex: 6,
      coins: [
        { index: 0, coeff: 3 },
        { index: 11, coeff: 2 },
      ],
    });
  });

  it('keeps a board without actions as a plain spin', () => {
    const plan = planSlotCoinRound(spinResult({ actions: [], isWin: false, coeff: '0', winAmount: '0.00' }));
    expect(plan.boards[0]?.collection).toBeNull();
    expect(plan.isWin).toBe(false);
  });

  it('skips actions it does not draw', () => {
    const plan = planSlotCoinRound(spinResult({ actions: [[{ action: 'BONUS_RUN' }]] }));
    expect(plan.boards[0]?.collection).toBeNull();
  });

  it('plays every board of a bonus round in order', () => {
    const plan = planSlotCoinRound(spinResult({ boards: ['123456789123', BOARD], actions: [[]], rounds: 2 }));
    expect(plan.boards.map((board) => board.collection === null)).toEqual([true, true]);
    expect(plan.boards[1]?.cells[0]).toEqual({ kind: 'coin', coeff: 3 });
  });

  it('reads money and coefficients the server sends as strings or numbers', () => {
    const plan = planSlotCoinRound(spinResult({ coeff: 5 as unknown as string, winAmount: '5' }));
    expect(plan.coeff).toBe(5);
    expect(plan.winText).toBe('5.00 USD');
  });

  it('reads coin fields that arrive as strings', () => {
    const coins = [{ index: '0', coeff: '3' }];
    const plan = planSlotCoinRound(spinResult({ actions: [[{ action: 'STRIKE_COINS_COLLECTION', triggerIndex: '6', coins }]] }));
    expect(plan.boards[0]?.collection).toEqual({ triggerIndex: 6, coins: [{ index: 0, coeff: 3 }] });
  });

  it('takes the coefficient off the board when a coin comes without one', () => {
    const coins = [{ index: 0 }];
    const plan = planSlotCoinRound(spinResult({ actions: [[{ action: 'STRIKE_COINS_COLLECTION', triggerIndex: 6, coins }]] }));
    expect(plan.boards[0]?.collection?.coins).toEqual([{ index: 0, coeff: 3 }]);
  });

  it('rejects a board of the wrong size', () => {
    expect(() => planSlotCoinRound(spinResult({ boards: ['1234'] }))).toThrow(SlotCoinRoundError);
  });

  it('rejects a symbol outside the alphabet', () => {
    expect(() => planSlotCoinRound(spinResult({ boards: ['12345678912z'] }))).toThrow(SlotCoinRoundError);
  });

  it('rejects a coefficient that is not a number', () => {
    expect(() => planSlotCoinRound(spinResult({ coeff: 'abc' }))).toThrow(SlotCoinRoundError);
  });

  it('rejects a collection that points outside the board', () => {
    const actions = [[{ action: 'STRIKE_COINS_COLLECTION', triggerIndex: 40, coins: [] }]];
    expect(() => planSlotCoinRound(spinResult({ actions }))).toThrow(SlotCoinRoundError);
  });

  it('rejects a round without boards', () => {
    expect(() => planSlotCoinRound(spinResult({ boards: [] }))).toThrow(SlotCoinRoundError);
  });
});
