/**
 * The bonus run of the joker-slot mock, as the stage backend plays it: the jokers stick to the middle reel,
 * each spin's coins land on the outer reels and every joker collects them, a Super Joker that lands adds coins
 * of its own first. The counter goes back to 3 whenever something new lands and the run ends at 0.
 */
import type { JokerSlotAction, JokerSlotCell } from '@omega/webbridge-protocol';
import {
  CELLS,
  EMPTY,
  JOKER,
  MIDDLE_CELLS,
  OUTER_CELLS,
  SUPER_JOKER,
  coinsOn,
  drawCoin,
  drawInt,
  freeCells,
  paidCoins,
  partMoney,
  type RandomSource,
} from './jokerSlotMockBoards';

const SPINS = 3;
const COIN_CHANCE = 0.32;
const JOKER_CHANCE = 0.1;
const SUPER_JOKER_SHARE = 0.25;
/** A run long past any recorded one (39 boards) stops dealing anything new, so it always ends. */
const QUIET_AFTER = 40;

export interface BonusStart {
  /** The base board's coins and the start's own: they open the run on its first board. */
  readonly coins: readonly JokerSlotCell[];
  readonly strikes: readonly JokerSlotCell[];
}

export interface BonusPlay {
  /** The steps that follow the bonus start on the base board: the run board and its collections. */
  readonly openingActions: JokerSlotAction[];
  readonly boards: string[];
  readonly actions: JokerSlotAction[][];
  /** Everything the run paid, in bets. */
  readonly coeff: number;
}

/** A Super Joker's coins: onto free outer cells, not shown by the board string. */
export const superJokerCoins = (trigger: number, taken: ReadonlySet<number>, random: RandomSource): JokerSlotAction & { coins: JokerSlotCell[] } => {
  const cells = freeCells(OUTER_CELLS, taken, drawInt(1, 3, random), random);
  return { action: 'SUPER_STRIKE_COINS_ADDED', triggerIndex: trigger, coins: cells.map((index) => ({ symbol: drawCoin(random), index })) };
};

/** Every joker collects the coins; what they pay, per joker, in bets. */
export const collectionsOf = (strikes: readonly JokerSlotCell[], coins: readonly JokerSlotCell[], unit: number): { actions: JokerSlotAction[]; coeff: number } => {
  if (coins.length === 0) return { actions: [], coeff: 0 };
  const paid = paidCoins([...coins].sort((left, right) => left.index - right.index), unit);
  const total = paid.reduce((sum, coin) => sum + Number(coin.coeff), 0);
  const actions = [...strikes]
    .sort((left, right) => left.index - right.index)
    .map((strike): JokerSlotAction => ({
      action: 'STRIKE_COINS_COLLECTION',
      triggerIndex: strike.index,
      coins: paid,
      totalCoeff: total.toFixed(2),
      totalPayout: partMoney(total, unit),
    }));
  return { actions, coeff: total * actions.length };
};

const boardOf = (cells: readonly JokerSlotCell[]): string[] => {
  const board = Array.from({ length: CELLS }, () => EMPTY);
  for (const { index, symbol } of cells) board[index] = symbol;
  return board;
};

interface SpinDeal {
  readonly board: string[];
  readonly actions: JokerSlotAction[];
  readonly coeff: number;
  readonly hasNews: boolean;
}

const dealSpin = (strikes: JokerSlotCell[], spinsLeft: number, isQuiet: boolean, unit: number, random: RandomSource): SpinDeal => {
  const taken = new Set(strikes.map((strike) => strike.index));
  const landed = !isQuiet && random() < JOKER_CHANCE ? freeCells(MIDDLE_CELLS, taken, 1, random) : [];
  const newStrikes = landed.map((index) => ({ symbol: random() < SUPER_JOKER_SHARE ? SUPER_JOKER : JOKER, index }));
  const coinCells = !isQuiet && random() < COIN_CHANCE ? freeCells(OUTER_CELLS, taken, drawInt(1, 2, random), random) : [];
  const coins = coinCells.map((index) => ({ symbol: drawCoin(random), index }));
  strikes.push(...newStrikes);
  const board = boardOf([...strikes, ...coins]);
  const hasNews = coins.length > 0 || newStrikes.length > 0;
  const actions: JokerSlotAction[] = [{ action: 'BONUS_SPINS_COUNT', count: hasNews ? SPINS : spinsLeft - 1 }];
  const added = newStrikes
    .filter((strike) => strike.symbol === SUPER_JOKER)
    .map((strike) => superJokerCoins(strike.index, new Set([...taken, ...coinCells]), random));
  actions.push(...added);
  const collections = collectionsOf(strikes, [...coins, ...added.flatMap((action) => action.coins)], unit);
  actions.push(...collections.actions);
  return { board, actions, coeff: collections.coeff, hasNews };
};

/** Plays the run from its start to the last spin; `unit` is the base bet every coin pays against. */
export const playBonus = (start: BonusStart, unit: number, random: RandomSource): BonusPlay => {
  const strikes = [...start.strikes];
  const runBoard = boardOf([...start.coins, ...strikes]);
  const opening = collectionsOf(strikes, coinsOn(runBoard), unit);
  const openingActions: JokerSlotAction[] = [
    { action: 'BONUS_RUN', board: runBoard.map((code) => [code]) },
    ...opening.actions,
  ];
  const boards: string[] = [];
  const actions: JokerSlotAction[][] = [];
  let coeff = opening.coeff;
  for (let spinsLeft = SPINS; spinsLeft > 0; ) {
    const spin = dealSpin(strikes, spinsLeft, boards.length >= QUIET_AFTER, unit, random);
    boards.push(spin.board.join(''));
    actions.push(spin.actions);
    coeff += spin.coeff;
    spinsLeft = spin.hasNews ? SPINS : spinsLeft - 1;
  }
  return { openingActions, boards, actions, coeff };
};
