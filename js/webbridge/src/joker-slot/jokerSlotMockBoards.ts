/**
 * Boards and money of the joker-slot mock, in the stage backend's alphabet and shapes. Only protocol types
 * are imported: the codes are repeated here so the package runs on a protocol release without the constants.
 */
import type { JokerSlotCell, JokerSlotPaidCell, JokerSlotWinLinesAction } from '@omega/webbridge-protocol';

export type RandomSource = () => number;

export const REELS = 3;
export const ROWS = 4;
export const CELLS = REELS * ROWS;
export const EMPTY = '0';
export const JOKER = 'l';
export const SUPER_JOKER = 'm';

/** Coins and medallions land on the outer reels, jokers on the middle one. */
export const OUTER_CELLS = [0, 1, 2, 3, 8, 9, 10, 11] as const;
export const MIDDLE_CELLS = [4, 5, 6, 7] as const;

const BASE_CODES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const COIN_COEFFS: Readonly<Record<string, number>> = { a: 1, b: 2, c: 3, d: 5, e: 7, f: 10, g: 15, h: 25, i: 50, j: 150, k: 1000 };
/** The draw of a landing coin: small ones often, medallions rarely. */
const COIN_WEIGHTS: readonly (readonly [string, number])[] = [
  ['a', 30], ['b', 24], ['c', 16], ['d', 10], ['e', 6], ['f', 4], ['g', 3], ['h', 2], ['i', 1], ['j', 0.5], ['k', 0.1],
];
const WIN_LINES = [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11], [0, 5, 10], [1, 6, 11], [2, 5, 8], [3, 6, 9]] as const;
/**
 * Line pays in bets by symbol. Only cherry (`3`, 1 bet) was seen on stage; the rest are illustrative — the
 * mock is not a second source of the paytable.
 */
const LINE_COEFFS: Readonly<Record<string, number>> = { 1: 2, 2: 3, 3: 1, 4: 1, 5: 1, 6: 1, 7: 5, 8: 1, 9: 2 };

export const drawInt = (min: number, max: number, random: RandomSource): number => min + Math.floor(random() * (max - min + 1));

export const pickOf = <T>(items: readonly T[], random: RandomSource): T => items[Math.floor(random() * items.length)]!;

const drawWeighted = (entries: readonly (readonly [string, number])[], random: RandomSource): string => {
  let remaining = random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of entries) {
    remaining -= weight;
    if (remaining < 0) return value;
  }
  return entries[entries.length - 1]![0];
};

export const drawCoin = (random: RandomSource): string => drawWeighted(COIN_WEIGHTS, random);

export const isCoin = (code: string): boolean => COIN_COEFFS[code] !== undefined;

export const isJoker = (code: string): boolean => code === JOKER || code === SUPER_JOKER;

/** A base board: plain symbols with coins sprinkled on the outer reels; jokers are placed by the round. */
export const dealBaseBoard = (coinChance: number, random: RandomSource): string[] =>
  Array.from({ length: CELLS }, (_, index) => {
    const isOuter = (OUTER_CELLS as readonly number[]).includes(index);
    return isOuter && random() < coinChance ? drawCoin(random) : pickOf(BASE_CODES, random);
  });

/** `count` cells of `among` that hold none of `taken`, in random order (Fisher–Yates). */
export const freeCells = (among: readonly number[], taken: ReadonlySet<number>, count: number, random: RandomSource): number[] => {
  const free = among.filter((index) => !taken.has(index));
  for (let index = free.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [free[index], free[swap]] = [free[swap]!, free[index]!];
  }
  return free.slice(0, count);
};

/** Money as the server writes a part: twelve decimals. */
export const partMoney = (coeff: number, unit: number): string => (coeff * unit).toFixed(12);

/** What `coins` pay to the joker that collects them, `unit` being the base bet. */
export const paidCoins = (coins: readonly JokerSlotCell[], unit: number): JokerSlotPaidCell[] =>
  coins.map(({ index, symbol }) => {
    const coeff = COIN_COEFFS[symbol]!;
    return { symbol, index, coeff: coeff.toFixed(2), payout: partMoney(coeff, unit) };
  });

/** The coins on a board, by its codes. */
export const coinsOn = (board: readonly string[]): JokerSlotCell[] =>
  board.flatMap((symbol, index) => (isCoin(symbol) ? [{ symbol, index }] : []));

/** Three equal plain symbols on a payline; `null` when no line pays. */
export const evaluateLines = (board: readonly string[], unit: number): JokerSlotWinLinesAction | null => {
  const winLines = WIN_LINES.flatMap((cells, winLineNumber) => {
    const [first, ...rest] = cells.map((index) => board[index]!);
    const coeff = LINE_COEFFS[first!];
    if (coeff === undefined || rest.some((code) => code !== first)) return [];
    return [{ winLineNumber, payout: partMoney(coeff, unit), coeff: coeff.toFixed(2) }];
  });
  if (winLines.length === 0) return null;
  const total = winLines.reduce((sum, line) => sum + Number(line.coeff), 0);
  return { action: 'WIN_LINES', winLines, totalPayout: partMoney(total, unit), totalCoeff: total.toFixed(2) };
};
