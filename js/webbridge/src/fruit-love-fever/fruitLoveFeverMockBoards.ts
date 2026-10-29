/**
 * Boards the Fruit Love Fever mock deals and the lines it pays, after the dev backend: 20 fixed lines read
 * left to right, one combination per line, a line's pay is its symbol's pay over 20 lines times the sum of
 * the multipliers of the wilds in it; wilds land on reels 2–4 only. The line table is the one recorded
 * replies show (cells no reply has shown are completed by the symmetry of the rest); weights and the
 * scatter pay are illustrative.
 */
import type { FruitLoveFeverSymbol, FruitLoveFeverWinLine } from '@omega/webbridge-protocol';

export const REEL_COUNT = 5;
export const REEL_ROWS = 3;
const WILD = 0;
const SCATTER = 12;
const LINE_COUNT = 20;
export const BONUS_SCATTERS = 3;
/** What three or more scatters pay, in bets; the backend paid 5 on the recorded scatter spin. */
export const SCATTER_PAY = 5;

/** A dealt cell: a symbol code and, on a wild, its multiplier. */
export interface MockCell {
  readonly symbol: FruitLoveFeverSymbol;
  readonly coeff?: number;
}

/** Reel by reel, each top row first. */
export type MockBoard = readonly (readonly MockCell[])[];

/** The row each line crosses on reels 1..5. */
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 2, 1, 0, 1],
  [1, 0, 1, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2],
  [0, 2, 2, 2, 0],
];

/** Pay for 3, 4 and 5 of a kind, in bets over all lines. Five wilds pay 25; fewer pay as their symbol. */
const PAYTABLE: Readonly<Record<number, readonly [number, number, number]>> = {
  0: [0, 0, 25],
  1: [60, 150, 400],
  2: [40, 100, 300],
  3: [20, 60, 200],
  4: [12, 40, 100],
  5: [10, 30, 80],
  6: [8, 20, 60],
  7: [5, 10, 40],
  8: [5, 10, 40],
  9: [2, 5, 20],
  10: [2, 5, 20],
  11: [2, 5, 20],
};

/** Base weights of the symbols 1..11: the cheap card ranks most often, the pineapple least. */
const SYMBOL_WEIGHTS: readonly (readonly [FruitLoveFeverSymbol, number])[] = [
  [1, 3],
  [2, 4],
  [3, 5],
  [4, 6],
  [5, 7],
  [6, 8],
  [7, 10],
  [8, 10],
  [9, 12],
  [10, 12],
  [11, 12],
];
const WILD_COEFFS = [2, 2, 2, 3] as const;
/** Reels (0-based) a wild can land on: the recorded replies never had one on the first or the last. */
const WILD_REELS: ReadonlySet<number> = new Set([1, 2, 3]);

export interface DealOptions {
  /** Chance of a wild in a cell. */
  readonly wildChance: number;
  /** Chance of a scatter in a cell; free spins deal none. */
  readonly scatterChance: number;
}

const pickWeighted = (random: () => number): FruitLoveFeverSymbol => {
  const total = SYMBOL_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [symbol, weight] of SYMBOL_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return symbol;
  }
  return 11;
};

const dealCell = (random: () => number, reel: number, { wildChance, scatterChance }: DealOptions): MockCell => {
  const roll = random();
  if (roll < wildChance && WILD_REELS.has(reel)) return { symbol: WILD, coeff: WILD_COEFFS[Math.floor(random() * WILD_COEFFS.length)]! };
  if (roll < wildChance + scatterChance) return { symbol: SCATTER };
  return { symbol: pickWeighted(random) };
};

export const dealBoard = (random: () => number, options: DealOptions): MockCell[][] =>
  Array.from({ length: REEL_COUNT }, (_, reel) => Array.from({ length: REEL_ROWS }, () => dealCell(random, reel, options)));

export const countScatters = (board: MockBoard): number =>
  board.reduce((sum, reel) => sum + reel.filter((cell) => cell.symbol === SCATTER).length, 0);

/** Scatters on the top row of the first three reels: a base spin that starts the bonus game. */
export const withBonusScatters = (board: MockBoard): MockCell[][] =>
  board.map((reel, index) => reel.map((cell, row) => (index < BONUS_SCATTERS && row === 0 ? { symbol: SCATTER } : cell)));

const money = (value: number): string => (Math.round(value * 100) / 100).toFixed(2);

/** The combination a line makes from reel 1, or null: wilds stand in for the first other symbol. */
const lineCombination = (cells: readonly MockCell[]): { symbol: number; length: number } | null => {
  const lead = cells.find((cell) => cell.symbol !== WILD);
  const symbol = lead === undefined || lead.symbol === SCATTER ? WILD : lead.symbol;
  let length = 0;
  while (length < cells.length && (cells[length]!.symbol === WILD || cells[length]!.symbol === symbol)) length += 1;
  const pay = PAYTABLE[symbol]?.[length - 3] ?? 0;
  return pay > 0 ? { symbol, length } : null;
};

/** Every paying line of the board, in line order; coefficients in bets as decimal strings, as the server sends. */
export const evaluateLines = (board: MockBoard): FruitLoveFeverWinLine[] =>
  PAYLINES.flatMap((rows, line) => {
    const cells = rows.map((row, reel) => board[reel]![row]!);
    const combination = lineCombination(cells);
    if (combination === null) return [];
    const used = cells.slice(0, combination.length);
    const wildCoeffs = used.reduce((sum, cell) => sum + (cell.symbol === WILD ? (cell.coeff ?? 1) : 0), 0);
    const pay = (PAYTABLE[combination.symbol]![combination.length - 3]! / LINE_COUNT) * Math.max(1, wildCoeffs);
    return [{ line: line + 1, coeff: money(pay), inclusionIndexes: rows.slice(0, combination.length) }];
  });

export const linesCoeff = (lines: readonly FruitLoveFeverWinLine[]): number =>
  lines.reduce((sum, line) => sum + Number(line.coeff), 0);
