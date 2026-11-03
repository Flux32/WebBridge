/**
 * A Dragon Pots reply as the scene plays it — the whole round in one: the 5 × 3 board and its ways, the
 * coins and the pots they burst, then the jackpot pick and the Hold & Win when the reply has them, and the
 * round's win. Board cells are reel-major, `reel * rows + row`, top row first (the server's matrix is
 * `[row][reel]`). Features are read by presence; the pots that burst come from `bonusTypeName`, or — for a
 * bought bonus, whose name is empty — from the buy of that board size.
 */
import {
  DRAGON_POTS_BONUS_BUYS,
  DRAGON_POTS_BONUS_TYPES,
  DRAGON_POTS_POT_COLORS,
  DRAGON_POTS_REELS,
  type DragonPotsBonusBuy,
  type DragonPotsPotColor,
} from '@omega/webbridge-protocol';
import { planHoldAndWin, planJackpot, type HoldAndWinPlan, type JackpotPlan } from './dragonPotsFeatures';
import { DragonPotsRoundError, readBoolean, readKey, readList, readNumber, readRecord, readString, readWhole } from './dragonPotsRead';
import { symbolKindOf, type SymbolKind } from './dragonPotsSymbols';

export const REEL_COUNT = DRAGON_POTS_REELS.count;
export const REEL_ROWS = DRAGON_POTS_REELS.rows;
export const BOARD_CELLS = REEL_COUNT * REEL_ROWS;

export interface WayPlan {
  /** Every cell of the win, reel-major. */
  readonly cells: readonly number[];
  readonly payout: number;
}

export interface CoinDrop {
  readonly cell: number;
  readonly color: DragonPotsPotColor;
  readonly isGold: boolean;
}

export interface DragonPotsPlan {
  readonly board: readonly SymbolKind[];
  readonly ways: readonly WayPlan[];
  readonly baseWin: number;
  readonly coins: readonly CoinDrop[];
  /** The pots that burst, and what the reply calls the outcome ("Mighty", "Bought Mega"). */
  readonly triggered: readonly DragonPotsPotColor[];
  readonly featureName: string;
  readonly jackpot: JackpotPlan | null;
  readonly holdAndWin: HoldAndWinPlan | null;
  /** The top-level `winAmount`: the round's authoritative win. */
  readonly totalWin: number;
  readonly currency: string;
}

const BONUS_NAMES = ['', ...Object.keys(DRAGON_POTS_BONUS_TYPES)] as ('' | keyof typeof DRAGON_POTS_BONUS_TYPES)[];
const BUYS = Object.keys(DRAGON_POTS_BONUS_BUYS) as DragonPotsBonusBuy[];
const cellOf = (reel: number, row: number): number => reel * REEL_ROWS + row;

const readBoard = (raw: unknown): SymbolKind[] => {
  const rows = readList(raw, 'matrix');
  if (rows.length !== REEL_ROWS) throw new DragonPotsRoundError(`matrix has ${rows.length} rows, not ${REEL_ROWS}`);
  const board: SymbolKind[] = [];
  rows.forEach((rawRow, row) => {
    const cells = readList(rawRow, `matrix row ${row}`);
    if (cells.length !== REEL_COUNT) throw new DragonPotsRoundError(`matrix row ${row} has ${cells.length} cells, not ${REEL_COUNT}`);
    cells.forEach((code, reel) => {
      const kind = symbolKindOf(readString(code, `matrix ${row}:${reel}`));
      if (kind === null) throw new DragonPotsRoundError(`matrix holds unknown symbol ${JSON.stringify(code)}`);
      board[cellOf(reel, row)] = kind;
    });
  });
  return board;
};

const readCell = (raw: unknown, field: string): number => {
  const cell = readRecord(raw, field);
  return cellOf(readWhole(cell.reelIndex, `${field} reelIndex`, 0, REEL_COUNT - 1), readWhole(cell.rowIndex, `${field} rowIndex`, 0, REEL_ROWS - 1));
};

const readWay = (raw: unknown): WayPlan => {
  const way = readRecord(raw, 'winsHighlight entry');
  return { cells: readList(way.path, 'win path').map((cell) => readCell(cell, 'win cell')), payout: readNumber(way.payout, 'win payout') };
};

/** Every coin stands on an `M` cell and every `M` cell holds a coin. */
const readCoins = (raw: unknown, board: readonly SymbolKind[]): CoinDrop[] => {
  const coins = readList(raw, 'coins').map((entry) => {
    const coin = readRecord(entry, 'coin');
    return { cell: readCell(coin, 'coin'), color: readKey(coin.color, 'coin color', DRAGON_POTS_POT_COLORS), isGold: readBoolean(coin.isGold, 'coin isGold') };
  });
  const coinCells = board.flatMap((kind, cell) => (kind === 'coin' ? [cell] : []));
  const isMatched = coins.length === coinCells.length && coins.every((coin) => board[coin.cell] === 'coin');
  if (!isMatched) throw new DragonPotsRoundError(`coins ${JSON.stringify(coins.map((coin) => coin.cell))} do not stand on the coin cells ${JSON.stringify(coinCells)}`);
  return coins;
};

const triggeredOf = (name: (typeof BONUS_NAMES)[number], holdAndWin: HoldAndWinPlan | null): { pots: readonly DragonPotsPotColor[]; name: string } => {
  if (name !== '') return { pots: DRAGON_POTS_BONUS_TYPES[name].pots, name: name === 'Lose' ? '' : name };
  if (holdAndWin === null) return { pots: [], name: '' };
  // Three buys on three board sizes: the size names the buy.
  const bought = BUYS.find((buy) => DRAGON_POTS_BONUS_BUYS[buy].boardSize === holdAndWin.boardSize)!;
  return { pots: DRAGON_POTS_BONUS_BUYS[bought].pots, name: `Bought ${bought}` };
};

/** Throws `DragonPotsRoundError` on a reply the scene cannot show truthfully. */
export const planDragonPotsRound = (reply: unknown): DragonPotsPlan => {
  const round = readRecord(reply, 'reply');
  const result = readRecord(round.roundResult, 'roundResult');
  const main = readRecord(result.mainGameResult, 'mainGameResult');
  const board = readBoard(main.matrix);
  const isJackpot = readBoolean(result.isJackpot, 'isJackpot');
  if (isJackpot !== (result.jackpotResult !== undefined)) throw new DragonPotsRoundError(`isJackpot is ${isJackpot}, but jackpotResult is ${result.jackpotResult === undefined ? 'missing' : 'there'}`);
  const holdAndWin = result.holdAndWinResult === undefined ? null : planHoldAndWin(result.holdAndWinResult);
  const triggered = triggeredOf(readKey(result.bonusTypeName, 'bonusTypeName', BONUS_NAMES), holdAndWin);
  const coins = readCoins(result.coins, board);
  const empty = triggered.pots.find((pot) => !coins.some((coin) => coin.color === pot));
  if (empty !== undefined) throw new DragonPotsRoundError(`the ${empty} pot bursts without a ${empty} coin landing`);
  return {
    board,
    ways: readList(main.winsHighlight, 'winsHighlight').map(readWay),
    baseWin: readNumber(main.winAmount, 'mainGameResult winAmount'),
    coins,
    triggered: triggered.pots,
    featureName: triggered.name,
    jackpot: isJackpot ? planJackpot(result.jackpotResult) : null,
    holdAndWin,
    totalWin: readNumber(round.winAmount, 'winAmount'),
    currency: readString(round.currency, 'currency'),
  };
};
