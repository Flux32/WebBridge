/**
 * The rules every Joker Slot reply keeps, as the recorded stage replies show them. The tests hold both the
 * recorded replies and the mock's to them, so the mock deals what the backend deals.
 */
import type { JokerSlotAction, JokerSlotCell, JokerSlotSpinResult } from '@omega/webbridge-protocol';
import { expect } from 'vitest';
import { topWinAmount } from '../src/joker-slot/jokerSlotMockRound';

const ALPHABET = /^[0-9a-m]{12}$/;
const OUTER = [0, 1, 2, 3, 8, 9, 10, 11];
const isJoker = (code: string | undefined): boolean => code === 'l' || code === 'm';
const PAYING = new Set(['WIN_LINES', 'STRIKE_COINS_COLLECTION', 'ENHANCED_SUPER_STRIKE']);

const cellsOf = (action: JokerSlotAction, field: 'coins' | 'strikes'): JokerSlotCell[] => (action[field] ?? []) as JokerSlotCell[];

/** Boards of 12 known codes, one action list per board, one reply per round. */
export const expectBoards = (reply: JokerSlotSpinResult): void => {
  reply.boards.forEach((board) => expect(board).toMatch(ALPHABET));
  expect(reply.rounds).toBe(reply.boards.length);
  expect(reply.actions).toHaveLength(reply.boards.length);
  expect(reply.isFinished).toBe(true);
};

/**
 * Every collection is made by a joker standing in its cell and takes coins standing on theirs — on the board,
 * on the bonus run board after `BONUS_RUN`, or put there by a Super Joker before.
 */
export const expectCollectionsOnTheirCells = (reply: JokerSlotSpinResult): void => {
  reply.boards.forEach((board, boardIndex) => {
    let cells = [...board];
    for (const action of reply.actions[boardIndex]!) {
      if (action.action === 'PILE_OF_GOLD' || action.action === 'BONUS_BUY') {
        for (const cell of [...cellsOf(action, 'coins'), ...cellsOf(action, 'strikes')]) cells[cell.index] = cell.symbol;
      }
      if (action.action === 'BONUS_RUN') cells = (action.board as string[][]).map(([code]) => code!);
      if (action.action === 'SUPER_STRIKE_COINS_ADDED') {
        expect(isJoker(cells[action.triggerIndex as number])).toBe(true);
        for (const coin of cellsOf(action, 'coins')) cells[coin.index] = coin.symbol;
      }
      if (action.action !== 'STRIKE_COINS_COLLECTION') continue;
      expect(isJoker(cells[action.triggerIndex as number])).toBe(true);
      for (const coin of cellsOf(action, 'coins')) expect(cells[coin.index]).toBe(coin.symbol);
    }
  });
};

/** The parts in base bets make the round: its coefficient is them over the price, its win cut to cents. */
export const expectTotals = (reply: JokerSlotSpinResult, priceInBets: number): void => {
  const parts = reply.actions.flat().filter((action) => PAYING.has(action.action)).reduce((sum, action) => sum + Number(action.totalCoeff), 0);
  expect(Number(reply.coeff)).toBeCloseTo(parts / priceInBets, 9);
  expect(reply.winAmount).toBe(topWinAmount(Number(reply.coeff), Number(reply.betAmount)));
  expect(reply.isWin).toBe(parts > 0);
  expect(reply.status).toBe(parts > 0 ? 'win' : 'lose');
};

const jokersOf = (cells: readonly string[]): number[] => cells.flatMap((code, index) => (isJoker(code) ? [index] : []));

/**
 * A bonus starts on the base board and runs its own boards: the jokers stick, the counter is back at 3 when
 * coins or a joker landed, one less otherwise, and the last board ends it at 0.
 */
export const expectBonusRun = (reply: JokerSlotSpinResult): void => {
  const opening = reply.actions[0]!;
  const run = opening.find((action) => action.action === 'BONUS_RUN');
  const start = opening.find((action) => action.action === 'PILE_OF_GOLD' || action.action === 'BONUS_BUY');
  expect(start).toBeDefined();
  expect(run).toBeDefined();
  let jokers = jokersOf((run!.board as string[][]).map(([code]) => code!));
  let spinsLeft = 3;
  reply.boards.slice(1).forEach((board, index) => {
    const cells = [...board];
    const now = jokersOf(cells);
    expect(now).toEqual(expect.arrayContaining(jokers));
    const hasNews = now.length > jokers.length || OUTER.some((cell) => cells[cell] !== '0');
    const counter = reply.actions[index + 1]![0]!;
    expect(counter.action).toBe('BONUS_SPINS_COUNT');
    spinsLeft = hasNews ? 3 : spinsLeft - 1;
    expect(counter.count).toBe(spinsLeft);
    jokers = now;
  });
  expect(spinsLeft).toBe(0);
};

/** Every rule of a reply; `priceInBets` is 1 unless the round was bought. */
export const expectRules = (reply: JokerSlotSpinResult, priceInBets = 1): void => {
  expectBoards(reply);
  expectCollectionsOnTheirCells(reply);
  expectTotals(reply, priceInBets);
  if (reply.rounds > 1) expectBonusRun(reply);
};
