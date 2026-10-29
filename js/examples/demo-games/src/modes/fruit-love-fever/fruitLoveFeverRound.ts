/**
 * A Fruit Love Fever reply as the scene plays it: the play reply, a free spin's step reply and an unfinished
 * game state share one shape — a 5 × 3 board, its paying lines, the round's running total and, inside a
 * bonus, the free spin it played. Board cells are reel-major, `reel * rows + row`, top row first.
 */
import { FRUIT_LOVE_FEVER_REELS, FRUIT_LOVE_FEVER_SYMBOLS } from '@omega/webbridge-protocol';
import {
  FruitLoveFeverRoundError,
  readBoolean,
  readList,
  readNumber,
  readRecord,
  readText,
  readWhole,
} from './fruitLoveFeverRead';
import { isWild, symbolOf, type ReelSymbol } from './fruitLoveFeverSymbols';

export const REEL_COUNT = FRUIT_LOVE_FEVER_REELS.count;
export const REEL_ROWS = FRUIT_LOVE_FEVER_REELS.rows;
export const BOARD_CELLS = REEL_COUNT * REEL_ROWS;
const LINE_COUNT = 20;
const MIN_COMBINATION = 3;
const LAST_CODE = FRUIT_LOVE_FEVER_SYMBOLS.scatter;

export interface WinLinePlan {
  readonly line: number;
  /** What the line pays, in bets of the base game. */
  readonly coeff: number;
  /** The board cells of the combination, reel 1 first. */
  readonly cells: readonly number[];
}

export interface BonusProgress {
  /** Free spins played so far: 0 before the first one (`currentGameNumber: null`). */
  readonly played: number;
  readonly total: number;
}

interface FruitSpinBoard {
  readonly board: readonly ReelSymbol[];
  readonly lines: readonly WinLinePlan[];
  /** The round's total win so far (`winAmount`). */
  readonly totalWin: number;
  /** What this spin added: a free spin's own win, or the base spin's. */
  readonly spinWin: number;
  readonly currency: string;
}

/** A finished reply may close a bonus (its last free spin) or have had none; an unfinished one is always in a bonus. */
export type FruitSpinPlan = FruitSpinBoard &
  (
    | { readonly isFinished: true; readonly bonus: BonusProgress | null }
    | { readonly isFinished: false; readonly bonus: BonusProgress }
  );

const readCell = (raw: unknown, reel: number): { row: number; symbol: ReelSymbol } => {
  const cell = readRecord(raw, `reel ${reel} cell`);
  const code = readWhole(cell.outcomeNumber, `reel ${reel} outcomeNumber`, 0, LAST_CODE);
  const multiplier = code === FRUIT_LOVE_FEVER_SYMBOLS.wild && cell.coeff !== undefined ? readNumber(cell.coeff, 'wild coeff') : null;
  const symbol = symbolOf(code, multiplier);
  if (symbol === null) throw new FruitLoveFeverRoundError(`reel ${reel} holds unknown symbol ${code}`);
  return { row: readWhole(cell.index, `reel ${reel} cell index`, 0, REEL_ROWS - 1), symbol };
};

/** `reelsCells` keyed "1".."5", each reel exactly its three rows in any order. */
const readBoard = (raw: unknown): ReelSymbol[] => {
  const reels = readRecord(raw, 'reelsCells');
  const board: (ReelSymbol | undefined)[] = Array.from({ length: BOARD_CELLS }, () => undefined);
  for (let reel = 0; reel < REEL_COUNT; reel += 1) {
    const cells = readList(reels[String(reel + 1)], `reelsCells.${reel + 1}`);
    if (cells.length !== REEL_ROWS) throw new FruitLoveFeverRoundError(`reel ${reel + 1} has ${cells.length} cells, not ${REEL_ROWS}`);
    for (const { row, symbol } of cells.map((cell) => readCell(cell, reel + 1))) board[reel * REEL_ROWS + row] = symbol;
  }
  return board.map((symbol, cell) => {
    if (symbol === undefined) throw new FruitLoveFeverRoundError(`reel ${Math.floor(cell / REEL_ROWS) + 1} misses row ${cell % REEL_ROWS}`);
    return symbol;
  });
};

const readLine = (raw: unknown): WinLinePlan => {
  const line = readRecord(raw, 'win line');
  const rows = readList(line.inclusionIndexes, 'inclusionIndexes');
  if (rows.length < MIN_COMBINATION || rows.length > REEL_COUNT) {
    throw new FruitLoveFeverRoundError(`win line covers ${rows.length} reels, not ${MIN_COMBINATION}..${REEL_COUNT}`);
  }
  return {
    line: readWhole(line.line, 'win line number', 1, LINE_COUNT),
    coeff: readNumber(line.coeff, 'win line coeff'),
    cells: rows.map((row, reel) => reel * REEL_ROWS + readWhole(row, 'inclusionIndexes row', 0, REEL_ROWS - 1)),
  };
};

const readBonus = (raw: unknown): { progress: BonusProgress; spinWin: number | null } | null => {
  if (raw === undefined) return null;
  const bonus = readRecord(raw, 'bonusGame');
  const total = readWhole(bonus.totalFreeSpinsAmount, 'totalFreeSpinsAmount', 1, Number.MAX_SAFE_INTEGER);
  const played = bonus.currentGameNumber === null ? 0 : readWhole(bonus.currentGameNumber, 'currentGameNumber', 1, total);
  return { progress: { played, total }, spinWin: played === 0 ? null : readNumber(bonus.winAmount, 'bonusGame winAmount') };
};

/** Throws `FruitLoveFeverRoundError` on a reply the scene cannot show truthfully. */
export const planFruitSpin = (reply: unknown): FruitSpinPlan => {
  const round = readRecord(reply, 'reply');
  const slot = readRecord(round.slot, 'slot');
  const bonus = readBonus(round.bonusGame);
  const totalWin = readNumber(round.winAmount, 'winAmount');
  const spin: FruitSpinBoard = {
    board: readBoard(slot.reelsCells),
    lines: readList(slot.winLines, 'winLines').map(readLine),
    totalWin,
    spinWin: bonus?.spinWin ?? totalWin,
    currency: readText(round.currency, 'currency'),
  };
  if (readBoolean(round.isFinished, 'isFinished')) return { ...spin, isFinished: true, bonus: bonus?.progress ?? null };
  if (bonus === null) throw new FruitLoveFeverRoundError('unfinished round without bonusGame');
  return { ...spin, isFinished: false, bonus: bonus.progress };
};

export const wildCellsOf = (plan: FruitSpinPlan): number[] =>
  plan.board.flatMap((symbol, cell) => (isWild(symbol) ? [cell] : []));

/** A sticky wild stays in its cell until the bonus ends: a free spin without one there cannot be shown truthfully. */
export const assertStickyWilds = (sticky: ReadonlySet<number>, plan: FruitSpinPlan): void => {
  const lost = [...sticky].find((cell) => !isWild(plan.board[cell]!));
  if (lost !== undefined) {
    throw new FruitLoveFeverRoundError(`sticky wild on reel ${Math.floor(lost / REEL_ROWS) + 1} row ${lost % REEL_ROWS} is gone`);
  }
};
