/**
 * The base board of the dragon-pots mock and its 243 ways, after the stage backend: `matrix[row][reel]`;
 * a symbol pays when it stands on reel 1 and on every next reel up to `matches` (3..5), wilds standing in;
 * `ways` is the product of its cells per reel, and every way pays the symbol's `coeff`. A pot coin's cell
 * (`M`) never pays. The recorded pays (Dragon ×3 0.4, J ×3 0.25, 10 ×5 0.5) hold; the rest of the table and
 * the weights are illustrative.
 */
import type { DragonPotsCell, DragonPotsSymbol, DragonPotsWin, DragonPotsWinHighlight } from '@omega/webbridge-protocol';
import { drawWeighted, shuffled, type RandomSource } from './dragonPotsMockDraw';

export const REEL_COUNT = 5;
export const REEL_ROWS = 3;
const WILD = 'Wi';
const COIN = 'M';
const MIN_MATCHES = 3;

type PayingSymbol = Exclude<DragonPotsSymbol, 'Wi' | 'M'>;

/** What one way pays for 3, 4 and 5 reels, in bets; also the order the wins are listed in. */
const PAYTABLE: readonly (readonly [PayingSymbol, readonly [number, number, number]])[] = [
  ['9', [0.2, 0.3, 0.5]],
  ['10', [0.2, 0.3, 0.5]],
  ['J', [0.25, 0.4, 0.6]],
  ['Q', [0.25, 0.4, 0.6]],
  ['K', [0.3, 0.5, 0.8]],
  ['A', [0.3, 0.5, 0.8]],
  ['Dr', [0.4, 1, 2]],
  ['Fl', [0.5, 1.2, 2.5]],
  ['Ln', [0.6, 1.5, 3]],
  ['3C', [0.8, 2, 4]],
  ['Fi', [1, 2.5, 5]],
];

const SYMBOL_WEIGHTS: readonly (readonly [PayingSymbol, number])[] = [
  ['9', 12],
  ['10', 12],
  ['J', 11],
  ['Q', 11],
  ['K', 10],
  ['A', 10],
  ['Dr', 7],
  ['Fl', 6],
  ['Ln', 5],
  ['3C', 4],
  ['Fi', 3],
];
const WILD_CHANCE = 0.05;
/** Reels (0-based) a wild lands on; the recorded ones were all on the middle reels. */
const WILD_REELS: ReadonlySet<number> = new Set([1, 2, 3]);

/** A board cell, `{reel, row}`. */
export interface BoardSpot {
  readonly reel: number;
  readonly row: number;
}

export type Matrix = DragonPotsSymbol[][];

const dealSymbol = (reel: number, random: RandomSource): DragonPotsSymbol =>
  WILD_REELS.has(reel) && random() < WILD_CHANCE ? WILD : drawWeighted(SYMBOL_WEIGHTS, random);

export const dealMatrix = (random: RandomSource): Matrix =>
  Array.from({ length: REEL_ROWS }, () => Array.from({ length: REEL_COUNT }, (_, reel) => dealSymbol(reel, random)));

/** `count` distinct cells, for the coins that land. */
export const drawSpots = (count: number, random: RandomSource): BoardSpot[] => {
  const spots = Array.from({ length: REEL_COUNT * REEL_ROWS }, (_, index) => ({ reel: index % REEL_COUNT, row: Math.floor(index / REEL_COUNT) }));
  return shuffled(spots, random).slice(0, count);
};

export const withCoins = (matrix: Matrix, spots: readonly BoardSpot[]): Matrix =>
  matrix.map((cells, row) => cells.map((symbol, reel) => (spots.some((spot) => spot.reel === reel && spot.row === row) ? COIN : symbol)));

/** No way can pay: reel 2 holds neither a wild nor a symbol of reel 1 — the bought rounds' base board. */
export const withoutWays = (matrix: Matrix): Matrix => {
  const lead = new Set(matrix.map((cells) => cells[0]));
  const spare = SYMBOL_WEIGHTS.map(([symbol]) => symbol).filter((symbol) => !lead.has(symbol));
  return matrix.map((cells, row) =>
    cells.map((symbol, reel) => (reel === 1 && (symbol === WILD || lead.has(symbol)) ? spare[row % spare.length]! : symbol)),
  );
};

const cellsOn = (matrix: Matrix, reel: number, symbol: PayingSymbol): DragonPotsCell[] =>
  matrix.flatMap((cells, row) => {
    const cell = cells[reel]!;
    return cell === symbol || cell === WILD ? [{ reelIndex: reel, rowIndex: row, symbol: cell }] : [];
  });

/** Every way: one cell per reel, reel 1 outermost — the order the server lists them in. */
const pathsOf = (columns: readonly (readonly DragonPotsCell[])[]): DragonPotsCell[][] =>
  columns.reduce<DragonPotsCell[][]>((paths, column) => paths.flatMap((path) => column.map((cell) => [...path, cell])), [[]]);

const winOf = (matrix: Matrix, symbol: PayingSymbol, pays: readonly [number, number, number]): DragonPotsWin | null => {
  const columns: DragonPotsCell[][] = [];
  for (let reel = 0; reel < REEL_COUNT; reel += 1) {
    const cells = cellsOn(matrix, reel, symbol);
    if (cells.length === 0) break;
    columns.push(cells);
  }
  if (columns.length < MIN_MATCHES) return null;
  const ways = columns.reduce((product, cells) => product * cells.length, 1);
  const coeff = pays[columns.length - MIN_MATCHES]!;
  return { symbol, matches: columns.length, ways, coeff, payout: Number((coeff * ways).toFixed(10)), paths: pathsOf(columns) };
};

export const evaluateWays = (matrix: Matrix): DragonPotsWin[] =>
  PAYTABLE.flatMap(([symbol, pays]) => {
    const win = winOf(matrix, symbol, pays);
    return win === null ? [] : [win];
  });

/** The union of a win's cells in the order its paths first reach them. */
export const highlightOf = ({ paths, ...win }: DragonPotsWin): DragonPotsWinHighlight => {
  const seen = new Set<string>();
  const path = paths.flat().filter((cell) => {
    const key = `${cell.reelIndex}:${cell.rowIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...win, path };
};
