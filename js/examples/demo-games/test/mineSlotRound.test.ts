import type { MineSlotSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { planMineSlotRound } from '../src/modes/mine-slot/mineSlotRound';
import { MineSlotRoundError } from '../src/modes/mine-slot/mineSlotRead';

/** Column-major, 5 reels x 3 rows: a wooden pickaxe tops reel 0, a dynamite sits mid reel 1. */
const BOARD = '1xx' + 'xdx' + 'xxx' + 'xxx' + 'xxx';
const PLAIN = 'xxx'.repeat(5);
/** Column 0 is six blocks of dirt (durability 1); the rest are stone, gold and obsidian. */
const FIELD = 'dddddd' + 'ssssss' + 'gggggg' + 'oooooo' + 'cccccc';

const reply = (overrides: Partial<MineSlotSpinResult> = {}): MineSlotSpinResult => ({
  status: 'win',
  betAmount: '1.000000000000000000',
  currency: 'USD',
  coeff: 0.1,
  isFinished: true,
  isWin: true,
  winAmount: '0.100000000000000000',
  rounds: 1,
  boards: [BOARD],
  field: FIELD,
  pickaxes: [{ round: 0, index: 0, brokenBlocks: [{ index: 0, damage: 1 }] }],
  tnt: [{ round: 0, index: 4, brokenBlocks: [{ index: 6, damage: 2, coeff: 0.1, payout: '0.10' }] }],
  chests: [],
  ...overrides,
});

describe('planMineSlotRound', () => {
  it('reads the board column by column and the field column by column, top first', () => {
    const plan = planMineSlotRound(reply());
    const [round] = plan.rounds;
    expect(round?.board[0]).toEqual({ kind: 'pickaxe', tier: 'wooden' });
    expect(round?.board[4]).toEqual({ kind: 'dynamite' });
    expect(round?.board).toHaveLength(15);
    expect(plan.blocks[0]?.tier).toBe('dirt');
    expect(plan.blocks[6]?.tier).toBe('stone');
    expect(plan.blocks[29]?.tier).toBe('crystal');
  });

  it('strikes with the pickaxes first and the dynamite after them, each from its own column', () => {
    const plan = planMineSlotRound(reply());
    expect(plan.rounds[0]?.strikes.map(({ kind, column }) => `${kind}:${column}`)).toEqual(['pickaxe:0', 'dynamite:1']);
  });

  it('keeps a pickaxe hit without coeff as damage only, and the breaking hit with its payout', () => {
    const plan = planMineSlotRound(reply());
    const [pickaxe, dynamite] = plan.rounds[0]?.strikes ?? [];
    expect(pickaxe?.hits).toEqual([{ cell: 0, damage: 1, coeff: null, payout: null }]);
    expect(dynamite?.hits).toEqual([{ cell: 6, damage: 2, coeff: 0.1, payout: 0.1 }]);
  });

  it('hands every round its own strikes, in the order of the list', () => {
    const pickaxes = [
      { round: 1, index: 0, brokenBlocks: [] },
      { round: 0, index: 0, brokenBlocks: [] },
      { round: 1, index: 3, brokenBlocks: [] },
    ];
    const boards = [BOARD, '1xx' + '2xx' + 'xxx'.repeat(3)];
    const plan = planMineSlotRound(reply({ boards, rounds: 2, pickaxes, tnt: [] }));
    expect(plan.rounds.map((round) => round.strikes.map((strike) => strike.boardIndex))).toEqual([[0], [0, 3]]);
  });

  it('opens a chest in the round that breaks its column through', () => {
    const dig = (round: number, cells: number[]) => ({ round, index: 0, brokenBlocks: cells.map((index) => ({ index, damage: 1 })) });
    const plan = planMineSlotRound(
      reply({ boards: [BOARD, BOARD], rounds: 2, pickaxes: [dig(0, [0, 1, 2]), dig(1, [3, 4, 5])], tnt: [], chests: [{ col: 0, coeff: 4, payout: '0' }] }),
    );
    expect(plan.rounds.map((round) => round.chests)).toEqual([[], [{ column: 0, coeff: 4 }]]);
  });

  it('reads numbers the server sends as decimal strings', () => {
    const tnt = [{ round: '0', index: '4', brokenBlocks: [{ index: '6', damage: '2', coeff: '0.1', payout: '0.10' }] }];
    const plan = planMineSlotRound(reply({ coeff: '0.1' as unknown as number, tnt: tnt as unknown as MineSlotSpinResult['tnt'] }));
    expect(plan.coeff).toBe(0.1);
    expect(plan.rounds[0]?.strikes[1]?.hits[0]?.cell).toBe(6);
    expect(plan.winText).toBe('0.10 USD');
    expect(plan.isWin).toBe(true);
  });

  it('reads a lost spin as no win', () => {
    const plan = planMineSlotRound(reply({ boards: [PLAIN], pickaxes: [], tnt: [], coeff: 0, winAmount: '0', isWin: false }));
    expect(plan.isWin).toBe(false);
    expect(plan.rounds[0]?.strikes).toEqual([]);
  });

  it('rejects a board of the wrong size', () => {
    expect(() => planMineSlotRound(reply({ boards: ['1xx'] }))).toThrow(MineSlotRoundError);
  });

  it('rejects a block outside the field alphabet', () => {
    expect(() => planMineSlotRound(reply({ field: 'z'.repeat(30) }))).toThrow(MineSlotRoundError);
  });

  it('rejects a pickaxe on a cell that holds no pickaxe', () => {
    expect(() => planMineSlotRound(reply({ pickaxes: [{ round: 0, index: 1, brokenBlocks: [] }] }))).toThrow(MineSlotRoundError);
  });

  it('rejects a hit of a round the reply does not have', () => {
    expect(() => planMineSlotRound(reply({ pickaxes: [{ round: 3, index: 0, brokenBlocks: [] }] }))).toThrow(MineSlotRoundError);
  });

  it('rejects a chest whose column is still standing', () => {
    expect(() => planMineSlotRound(reply({ chests: [{ col: 2, coeff: 5, payout: '0' }] }))).toThrow(MineSlotRoundError);
  });

  it('rejects a reply without boards', () => {
    expect(() => planMineSlotRound(reply({ boards: [] }))).toThrow(MineSlotRoundError);
  });
});
