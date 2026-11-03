/**
 * The two features of a Dragon Pots reply as the scene plays them. The jackpot pick reveals `scenario` tile
 * by tile and pays what `jackpotResult` says; the Hold & Win puts its initial coins down, then plays every
 * try of every spin, a landing coin raising the running total to its `currentWinAmount`.
 */
import {
  DRAGON_POTS_BOARD_SIZES,
  DRAGON_POTS_JACKPOT_MATCH,
  DRAGON_POTS_JACKPOT_TIERS,
  type DragonPotsBoardSize,
  type DragonPotsJackpotTile,
} from '@omega/webbridge-protocol';
import { DragonPotsRoundError, readBoolean, readKey, readList, readNumber, readRecord, readWhole } from './dragonPotsRead';

export interface JackpotPlan {
  readonly tiles: readonly DragonPotsJackpotTile[];
  /** The tier the pick ends on; UPGRADE never wins one. */
  readonly won: Exclude<DragonPotsJackpotTile, 5>;
  readonly coeff: number;
  readonly winAmount: number;
  readonly isDouble: boolean;
}

export interface HoldAndWinCoin {
  /** Board cell, `row * columns + column`. */
  readonly cell: number;
  /** The coin's value in base bets. */
  readonly coeff: number;
  /** The Hold & Win total once this coin landed (0 on the initial coins). */
  readonly total: number;
}

/** One try of a respin: empty, or the coins that landed and ended the spin. */
export type HoldAndWinTry = readonly HoldAndWinCoin[];

export interface HoldAndWinPlan {
  readonly boardSize: DragonPotsBoardSize;
  readonly rows: number;
  readonly columns: number;
  readonly initial: readonly HoldAndWinCoin[];
  readonly spins: readonly (readonly HoldAndWinTry[])[];
  readonly winAmount: number;
}

const TILES = Object.keys(DRAGON_POTS_JACKPOT_TIERS).map(Number) as DragonPotsJackpotTile[];
const BOARD_SIZES = Object.keys(DRAGON_POTS_BOARD_SIZES) as DragonPotsBoardSize[];
const UPGRADE = 5;
/** Tiles on the scene's pick board; the longest pick the rules allow is 11 (two of every other tile + three). */
export const JACKPOT_BOARD_TILES = 12;

/** The pick must end on the third tile of a tier, and no tier may reach three before it. */
const wonTierOf = (tiles: readonly DragonPotsJackpotTile[]): Exclude<DragonPotsJackpotTile, 5> => {
  const counts = new Map<number, number>();
  tiles.forEach((tile, index) => {
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
    const isMatch = counts.get(tile) === DRAGON_POTS_JACKPOT_MATCH && tile !== UPGRADE;
    if (isMatch !== (index === tiles.length - 1)) throw new DragonPotsRoundError(`jackpot scenario ${JSON.stringify(tiles)} does not end on a tier's third tile`);
  });
  const last = tiles.at(-1);
  if (last === undefined || last === UPGRADE) throw new DragonPotsRoundError('jackpot scenario is empty');
  return last;
};

export const planJackpot = (raw: unknown): JackpotPlan => {
  const jackpot = readRecord(raw, 'jackpotResult');
  const tiles = readList(jackpot.scenario, 'jackpot scenario').map((tile) => readKey(tile, 'jackpot tile', TILES));
  if (tiles.length > JACKPOT_BOARD_TILES) throw new DragonPotsRoundError(`jackpot scenario has ${tiles.length} tiles, the pick board ${JACKPOT_BOARD_TILES}`);
  return {
    tiles,
    won: wonTierOf(tiles),
    coeff: readNumber(jackpot.coeff, 'jackpot coeff'),
    winAmount: readNumber(jackpot.winAmount, 'jackpot winAmount'),
    isDouble: readBoolean(jackpot.isDouble, 'jackpot isDouble'),
  };
};

const readCoin = (raw: unknown, rows: number, columns: number, taken: Set<number>): HoldAndWinCoin => {
  const coin = readRecord(raw, 'Hold & Win coin');
  const cell = readWhole(coin.rowIndex, 'coin rowIndex', 0, rows - 1) * columns + readWhole(coin.colIndex, 'coin colIndex', 0, columns - 1);
  if (taken.has(cell)) throw new DragonPotsRoundError(`two Hold & Win coins land on cell ${cell}`);
  taken.add(cell);
  return { cell, coeff: readNumber(coin.coinCoeff, 'coinCoeff'), total: readNumber(coin.currentWinAmount, 'currentWinAmount') };
};

export const planHoldAndWin = (raw: unknown): HoldAndWinPlan => {
  const holdAndWin = readRecord(raw, 'holdAndWinResult');
  const boardSize = readKey(holdAndWin.boardSize, 'boardSize', BOARD_SIZES);
  const { rows, columns } = DRAGON_POTS_BOARD_SIZES[boardSize];
  const taken = new Set<number>();
  const initial = readRecord(holdAndWin.initial, 'Hold & Win initial');
  return {
    boardSize,
    rows,
    columns,
    initial: readList(initial.coins, 'initial coins').map((coin) => readCoin(coin, rows, columns, taken)),
    spins: readList(holdAndWin.spins, 'Hold & Win spins').map((spin) =>
      readList(readRecord(spin, 'Hold & Win spin').tries, 'spin tries').map((attempt) =>
        readList(readRecord(attempt, 'try').openedCoins, 'openedCoins').map((coin) => readCoin(coin, rows, columns, taken)),
      ),
    ),
    winAmount: readNumber(holdAndWin.winAmount, 'Hold & Win winAmount'),
  };
};
