import { describe, expect, it } from 'vitest';
import { DragonPotsRoundError } from '../src/modes/dragon-pots/dragonPotsRead';
import { planDragonPotsRound } from '../src/modes/dragon-pots/dragonPotsRound';
import { recorded, recordedWith } from './dragonPotsFixtures';

/** The bought Mega with its first initial coin put down twice. */
const twoCoinsOnOneCell = (): Record<string, unknown> => {
  // The recorded reply's shape, read back from its JSON.
  const holdAndWin = (recorded('play-buy-mega').roundResult as { holdAndWinResult: { initial: { coins: unknown[] } } }).holdAndWinResult;
  const [first] = holdAndWin.initial.coins;
  return recordedWith('play-buy-mega', { holdAndWinResult: { ...holdAndWin, initial: { currentCoeff: 0, coins: [first, first] } } });
};

describe('planDragonPotsRound', () => {
  it('turns the server matrix [row][reel] into a reel-major board', () => {
    const plan = planDragonPotsRound(recorded('play-win'));

    // Row 0 of the recorded matrix is Q Fl 10 10 K: reel 1 row 0 is cell 3.
    expect([plan.board[0], plan.board[3], plan.board[6], plan.board[12]]).toEqual(['q', 'flower', 'ten', 'k']);
  });

  it('lights the cells of every way the server highlights', () => {
    const plan = planDragonPotsRound(recorded('play-win'));

    expect(plan.ways).toEqual([{ cells: [2, 5, 6, 9, 13], payout: 0.5 }]);
    expect(plan.baseWin).toBe(0.05);
  });

  it('flies the coins to their pots and bursts the pots the outcome names', () => {
    const plan = planDragonPotsRound(recorded('play-mighty'));

    expect(plan.coins).toEqual([
      { cell: 11, color: 'Blue', isGold: false },
      { cell: 14, color: 'Red', isGold: true },
    ]);
    expect([plan.triggered, plan.featureName]).toEqual([['Blue'], 'Mighty']);
  });

  it('bursts no pot when the coins lost', () => {
    const plan = planDragonPotsRound(recorded('play-lose-coins'));

    expect([plan.coins.length, plan.triggered, plan.featureName]).toEqual([1, [], '']);
  });

  it('plays the jackpot pick in scenario order and pays what the reply says', () => {
    const plan = planDragonPotsRound(recorded('play-jackpot'));

    expect(plan.jackpot).toEqual({ tiles: [1, 1, 2, 5, 2, 1], won: 1, coeff: 20, winAmount: 2, isDouble: false });
    expect(plan.holdAndWin).toBeNull();
  });

  it('reads both features of an Ultimate: the pick, then a 5 x 5 Hold & Win', () => {
    const plan = planDragonPotsRound(recorded('play-ultimate'));

    expect(plan.jackpot?.won).toBe(1);
    expect(plan.holdAndWin).toMatchObject({ boardSize: '5x5', rows: 5, columns: 5, winAmount: 5.025 });
    expect(plan.holdAndWin?.initial).toHaveLength(10);
    expect(plan.holdAndWin?.initial[0]).toEqual({ cell: 8, coeff: 0.25, total: 0 });
    expect(plan.holdAndWin?.spins.at(-1)).toEqual([[], [], []]);
    expect(plan.totalWin).toBe(7.02);
  });

  it('names a bought bonus by its board and shows the top-level win, a cent below its Hold & Win', () => {
    const plan = planDragonPotsRound(recorded('play-buy-mighty'));

    expect([plan.triggered, plan.featureName]).toEqual([['Blue'], 'Bought Mighty']);
    expect(plan.holdAndWin?.winAmount).toBe(2.91);
    expect(plan.totalWin).toBe(2.9);
  });

  it.each([
    ['a coin off its coin cell', recordedWith('play-mighty', { coins: [{ reelIndex: 0, rowIndex: 0, color: 'Blue', isGold: false }] }), 'coin cells'],
    ['a pot bursting without its coin', recordedWith('play-mighty', { bonusTypeName: 'Mega', bonusTypeIndex: 1 }), 'Green pot'],
    ['a jackpot flag without the pick', recordedWith('play-jackpot', { jackpotResult: undefined }), 'jackpotResult is missing'],
    ['a pick that stops short', recordedWith('play-jackpot', { jackpotResult: { scenario: [1, 1, 2], coeff: 20, winAmount: '2', isDouble: false } }), 'third tile'],
    ['an unknown bonus type', recordedWith('play-jackpot', { bonusTypeName: 'Mythic' }), 'bonusTypeName'],
    ['two coins on one Hold & Win cell', twoCoinsOnOneCell(), 'two Hold & Win coins'],
  ])('rejects %s', (_, reply, message) => {
    expect(() => planDragonPotsRound(reply)).toThrow(DragonPotsRoundError);
    expect(() => planDragonPotsRound(reply)).toThrow(message);
  });

  it('rejects a matrix symbol outside the alphabet', () => {
    const reply = recordedWith('play-lose', { mainGameResult: { matrix: [['X', 'J', 'J', 'J', 'J'], ['J', 'J', 'J', 'J', 'J'], ['J', 'J', 'J', 'J', 'J']], wins: [], winsHighlight: [], coeff: 0, winAmount: '0' } });

    expect(() => planDragonPotsRound(reply)).toThrow('unknown symbol "X"');
  });
});
