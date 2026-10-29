import { describe, expect, it } from 'vitest';
import { FruitLoveFeverRoundError } from '../src/modes/fruit-love-fever/fruitLoveFeverRead';
import { assertStickyWilds, planFruitSpin, wildCellsOf } from '../src/modes/fruit-love-fever/fruitLoveFeverRound';
import { recorded, recordedWith } from './fruitLoveFeverFixtures';

/** `reelsCells` of a recorded reply with one cell of one reel changed. */
const withCell = (name: string, reel: string, row: number, cell: Record<string, unknown>) => {
  const reply = recorded(name);
  const slot = reply.slot as { reelsCells: Record<string, Record<string, unknown>[]> };
  const cells = slot.reelsCells[reel]!.map((original, index) => (index === row ? { ...original, ...cell } : original));
  return { ...reply, slot: { ...slot, reelsCells: { ...slot.reelsCells, [reel]: cells } } };
};

const withLines = (name: string, winLines: unknown[]) => {
  const reply = recorded(name);
  return { ...reply, slot: { ...(reply.slot as object), winLines } };
};

describe('planFruitSpin', () => {
  it('reads the board reel by reel by outcomeNumber, never by the leftover outcome names', () => {
    const plan = planFruitSpin(recorded('play-win'));

    expect(plan.board).toHaveLength(15);
    // Reel 1: hydrant(5) / a(7) / police(2) on the stage server — mojito, A, banana by code.
    expect(plan.board.slice(0, 3).map((symbol) => symbol.name)).toEqual(['Mojito', 'A', 'Banana']);
    expect(plan.board[5]).toEqual({ kind: 'k', name: 'K', multiplier: null });
  });

  it('keeps the multiplier a wild carries', () => {
    const plan = planFruitSpin(recorded('play-win'));

    expect(plan.board[8]).toEqual({ kind: 'wild', name: 'Wild', multiplier: 2 });
    expect(wildCellsOf(plan)).toEqual([8]);
  });

  it('places a reel by each cell index, whatever order the cells come in', () => {
    const reply = recorded('play-win');
    const slot = reply.slot as { reelsCells: Record<string, unknown[]> };
    const shuffled = { ...reply, slot: { ...slot, reelsCells: { ...slot.reelsCells, '1': [...slot.reelsCells['1']!].reverse() } } };

    expect(planFruitSpin(shuffled).board.slice(0, 3).map((symbol) => symbol.name)).toEqual(['Mojito', 'A', 'Banana']);
  });

  it('turns each win line into the board cells of its combination', () => {
    const plan = planFruitSpin(recorded('play-win'));

    expect(plan.lines).toEqual([
      { line: 4, coeff: 1, cells: [0, 4, 8] },
      { line: 11, coeff: 0.25, cells: [1, 3, 7] },
    ]);
    expect(plan).toMatchObject({ totalWin: 1.25, spinWin: 1.25, isFinished: true, bonus: null, currency: 'USD' });
  });

  it('reads a line number sent as a string', () => {
    const plan = planFruitSpin(withLines('play-win', [{ line: '4', coeff: 1, inclusionIndexes: [0, 1, 2, 1] }]));

    expect(plan.lines).toEqual([{ line: 4, coeff: 1, cells: [0, 4, 8, 10] }]);
  });

  it('opens a bonus with no free spin played yet', () => {
    const plan = planFruitSpin(recorded('play-scatter'));

    expect(plan).toMatchObject({ isFinished: false, bonus: { played: 0, total: 10 }, totalWin: 5, spinWin: 5 });
  });

  it('reads a free spin: its own win apart from the running total', () => {
    const plan = planFruitSpin(recorded('step-1'));

    expect(plan).toMatchObject({ isFinished: false, bonus: { played: 1, total: 10 }, totalWin: 6.8, spinWin: 1.8 });
  });

  it('reads an unfinished game state as a bonus in progress', () => {
    const plan = planFruitSpin(recorded('state-mid-bonus'));

    expect(plan.bonus).toEqual({ played: 3, total: 10 });
    expect(wildCellsOf(plan)).toEqual([3, 6]);
  });

  it('rejects an unknown symbol code', () => {
    expect(() => planFruitSpin(withCell('play-win', '2', 0, { outcomeNumber: 13 }))).toThrow(FruitLoveFeverRoundError);
  });

  it('rejects a reel that misses a row', () => {
    expect(() => planFruitSpin(withCell('play-win', '3', 0, { index: 1 }))).toThrow(/reel 3 misses row 0/);
  });

  it('rejects a win line shorter than three reels or off the board', () => {
    expect(() => planFruitSpin(withLines('play-win', [{ line: 1, coeff: '1', inclusionIndexes: [1, 1] }]))).toThrow(FruitLoveFeverRoundError);
    expect(() => planFruitSpin(withLines('play-win', [{ line: 1, coeff: '1', inclusionIndexes: [1, 3, 1] }]))).toThrow(FruitLoveFeverRoundError);
  });

  it('rejects an unfinished reply without a bonus game', () => {
    expect(() => planFruitSpin(recordedWith('play-win', { isFinished: false }))).toThrow(/without bonusGame/);
  });

  it('rejects a free spin past the bonus total', () => {
    const bonusGame = { currentGameNumber: 11, totalFreeSpinsAmount: 10, coeff: '0', winAmount: '0' };
    expect(() => planFruitSpin(recordedWith('step-1', { bonusGame }))).toThrow(FruitLoveFeverRoundError);
  });
});

describe('assertStickyWilds', () => {
  it('passes a free spin that keeps every sticky wild', () => {
    expect(() => assertStickyWilds(new Set([7]), planFruitSpin(recorded('step-2')))).not.toThrow();
  });

  it('rejects a free spin that lost a sticky wild', () => {
    expect(() => assertStickyWilds(new Set([0]), planFruitSpin(recorded('step-2')))).toThrow(/sticky wild on reel 1 row 0/);
  });
});
