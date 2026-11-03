/**
 * The rules every Dragon Pots reply keeps, as the recorded stage replies show them. The tests hold both the
 * recorded replies and the mock's to them, so the mock deals what the backend deals.
 */
import type { DragonPotsHoldAndWinResult, DragonPotsJackpotResult, DragonPotsSpinResult } from '@omega/webbridge-protocol';
import { expect } from 'vitest';
import { topWinAmount } from '../src/dragon-pots/dragonPotsMockDraw';

const TIER_COEFFS: Readonly<Record<number, number>> = { 1: 20, 2: 50, 3: 250, 4: 2000 };
const BOARD_CELLS: Readonly<Record<string, number>> = { '3x5': 15, '4x5': 20, '5x5': 25 };

/** The coins on the reels stand on exactly the `M` cells of the matrix. */
export const expectCoinsOnTheirCells = (reply: DragonPotsSpinResult): void => {
  const { matrix } = reply.roundResult.mainGameResult;
  const coinCells = matrix.flatMap((cells, row) => cells.flatMap((symbol, reel) => (symbol === 'M' ? [`${reel}:${row}`] : [])));
  const coins = reply.roundResult.coins.map((coin) => `${coin.reelIndex}:${coin.rowIndex}`);
  expect([...coins].sort()).toEqual([...coinCells].sort());
};

/** The pick ends on the third tile of the won tier, and no tier reached three before. */
export const expectJackpotPick = ({ scenario, coeff }: DragonPotsJackpotResult): void => {
  const counts = new Map<number, number>();
  scenario.forEach((tile, index) => {
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
    const isLast = index === scenario.length - 1;
    expect(counts.get(tile) === 3).toBe(isLast);
  });
  expect(coeff).toBe(TIER_COEFFS[scenario.at(-1)!]);
};

/** Every landing coin collects the board before it; the last spin is three empty tries or fills the board. */
export const expectHoldAndWin = (holdAndWin: DragonPotsHoldAndWinResult, priceInBets: number): void => {
  let boardSum = holdAndWin.initial.coins.reduce((sum, coin) => sum + coin.coinCoeff, 0);
  let total = 0;
  let count = holdAndWin.initial.coins.length;
  holdAndWin.initial.coins.forEach((coin) => expect(coin.currentCoeff).toBe(0));
  for (const spin of holdAndWin.spins) {
    spin.tries.forEach((attempt, index) => {
      expect(attempt.tryIndex).toBe(index);
      if (attempt.openedCoins.length > 0) expect(index).toBe(spin.tries.length - 1);
    });
    for (const coin of spin.tries.flatMap((attempt) => attempt.openedCoins)) {
      total += boardSum;
      boardSum += coin.coinCoeff;
      count += 1;
      expect(coin.currentCoeff).toBeCloseTo(total, 9);
    }
    expect(spin.currentCoeff).toBeCloseTo(total, 9);
  }
  const last = holdAndWin.spins.at(-1)!;
  const isBoardFull = count === BOARD_CELLS[holdAndWin.boardSize];
  if (!isBoardFull) expect(last.tries.map((attempt) => attempt.openedCoins.length)).toEqual([0, 0, 0]);
  expect(holdAndWin.finalCoinsCount).toBe(count);
  expect(holdAndWin.coeff).toBeCloseTo(total / priceInBets, 9);
};

/**
 * The parts add up to the total, and the top-level win is the total rounded down to cents — by the rule that
 * reproduces every recorded reply (`topWinAmount`; a bought round may show a cent less than its parts).
 */
export const expectTotals = (reply: DragonPotsSpinResult): void => {
  const { roundResult } = reply;
  const parts = roundResult.mainGameResult.coeff + (roundResult.jackpotResult?.coeff ?? 0) + (roundResult.holdAndWinResult?.coeff ?? 0);
  expect(roundResult.totalCoeff).toBeCloseTo(parts, 9);
  expect(Number(reply.coeff)).toBeCloseTo(roundResult.totalCoeff, 9);
  expect(reply.winAmount).toBe(topWinAmount(roundResult.totalCoeff, Number(reply.betAmount)));
  expect(reply.isFinished).toBe(true);
  expect(reply.status).toBe(roundResult.totalCoeff > 0 ? 'win' : 'lose');
  expect(roundResult.isJackpot).toBe(roundResult.jackpotResult !== undefined);
};
