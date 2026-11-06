/**
 * One play of the joker-slot mock, dealt whole as the stage backend deals it: the base board with its win
 * lines and joker collection, and after landed jokers (`PILE_OF_GOLD`) or a bought bonus (`BONUS_BUY`) the
 * bonus run. Coins pay against the base bet (`unit`); the round's coefficient is against what the play
 * charged, so a bought bonus shows it divided by the price.
 */
import type { JokerSlotAction, JokerSlotBonusBuy, JokerSlotCell, JokerSlotSpinResult } from '@omega/webbridge-protocol';
import {
  JOKER,
  MIDDLE_CELLS,
  OUTER_CELLS,
  SUPER_JOKER,
  coinsOn,
  dealBaseBoard,
  drawCoin,
  drawInt,
  evaluateLines,
  freeCells,
  pickOf,
  type RandomSource,
} from './jokerSlotMockBoards';
import { collectionsOf, playBonus, superJokerCoins } from './jokerSlotMockBonus';

/** A base-game feature a dev key forces instead of waiting for the draw. */
export type JokerSlotMockOutcome = 'lines' | 'collect' | 'superJoker' | 'bonus';

/** The buys' prices in bets, as `JOKER_SLOT_BONUS_BUYS` of the protocol. */
const BONUS_BUY_PRICES: Readonly<Record<JokerSlotBonusBuy, number>> = { x75: 75, x200: 200 };

const COIN_CHANCE = 0.14;
const JOKER_CHANCE = 0.05;
const SUPER_JOKER_CHANCE = 0.015;
const BONUS_CHANCE = 0.004;

export interface JokerSlotDeal {
  readonly bet: number;
  readonly currency: string;
  readonly random: RandomSource;
  readonly bonusBuy?: JokerSlotBonusBuy;
  readonly outcome?: JokerSlotMockOutcome;
}

interface PlayedRound {
  readonly boards: string[];
  readonly actions: JokerSlotAction[][];
  /** Everything the round paid, in base bets. */
  readonly coeff: number;
}

interface BaseRound {
  readonly board: string[];
  readonly actions: JokerSlotAction[];
  readonly coeff: number;
}

const forceLine = (board: string[], random: RandomSource): void => {
  const symbol = pickOf(['3', '7', '9'], random);
  for (const index of pickOf([[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11]], random)) board[index] = symbol;
};

const jokerOf = (outcome: JokerSlotMockOutcome | undefined, random: RandomSource): string | null => {
  if (outcome === 'collect') return JOKER;
  if (outcome === 'superJoker') return SUPER_JOKER;
  if (outcome !== undefined) return null;
  const draw = random();
  if (draw < SUPER_JOKER_CHANCE) return SUPER_JOKER;
  return draw < SUPER_JOKER_CHANCE + JOKER_CHANCE ? JOKER : null;
};

/** The base board, its lines and its joker: a Super Joker adds coins first, then the joker collects. */
const playBase = (outcome: JokerSlotMockOutcome | undefined, unit: number, random: RandomSource): BaseRound => {
  const board = dealBaseBoard(COIN_CHANCE, random);
  if (outcome === 'lines') forceLine(board, random);
  const lines = evaluateLines(board, unit);
  const actions: JokerSlotAction[] = lines === null ? [] : [lines];
  let coeff = lines === null ? 0 : Number(lines.totalCoeff);
  const joker = jokerOf(outcome, random);
  if (joker === null) return { board, actions, coeff };
  const trigger = pickOf(MIDDLE_CELLS, random);
  board[trigger] = joker;
  // A forced collection must have something to collect.
  if (outcome === 'collect' && coinsOn(board).length === 0) {
    for (const coin of newCoins(board, random)) board[coin.index] = coin.symbol;
  }
  const coins = coinsOn(board);
  if (joker === SUPER_JOKER) {
    const added = superJokerCoins(trigger, new Set(coins.map((coin) => coin.index)), random);
    actions.push(added);
    coins.push(...added.coins);
  }
  const collection = collectionsOf([{ symbol: joker, index: trigger }], coins, unit);
  actions.push(...collection.actions);
  coeff += collection.coeff;
  return { board, actions, coeff };
};

const playPlain = (outcome: JokerSlotMockOutcome | undefined, unit: number, random: RandomSource): PlayedRound => {
  const base = playBase(outcome, unit, random);
  return { boards: [base.board.join('')], actions: [base.actions], coeff: base.coeff };
};

const newCoins = (board: readonly string[], random: RandomSource): JokerSlotCell[] => {
  const taken = new Set(coinsOn(board).map((coin) => coin.index));
  return freeCells(OUTER_CELLS, taken, drawInt(1, 2, random), random).map((index) => ({ symbol: drawCoin(random), index }));
};

const newStrikes = (bonusBuy: JokerSlotBonusBuy | undefined, random: RandomSource): JokerSlotCell[] => {
  if (bonusBuy === 'x200') return [{ symbol: SUPER_JOKER, index: pickOf(MIDDLE_CELLS, random) }];
  const count = bonusBuy === 'x75' ? drawInt(1, 2, random) : 1;
  return freeCells(MIDDLE_CELLS, new Set(), count, random).map((index) => ({ symbol: JOKER, index }));
};

/** The base board, then the bonus started on it: the start's coins and jokers, a Super Joker's coins, the run. */
const playWithBonus = (deal: JokerSlotDeal, unit: number): PlayedRound => {
  const { random, bonusBuy } = deal;
  const board = dealBaseBoard(COIN_CHANCE, random);
  const lines = bonusBuy === undefined ? evaluateLines(board, unit) : null;
  const coins = newCoins(board, random);
  const strikes = newStrikes(bonusBuy, random);
  const opening: JokerSlotAction[] = lines === null ? [] : [lines];
  opening.push({ action: bonusBuy === undefined ? 'PILE_OF_GOLD' : 'BONUS_BUY', coins, strikes });
  const startCoins = [...coinsOn(board), ...coins];
  for (const strike of strikes.filter((candidate) => candidate.symbol === SUPER_JOKER)) {
    const added = superJokerCoins(strike.index, new Set(startCoins.map((coin) => coin.index)), random);
    opening.push(added);
    startCoins.push(...added.coins);
  }
  const bonus = playBonus({ coins: startCoins, strikes }, unit, random);
  opening.push(...bonus.openingActions);
  const coeff = (lines === null ? 0 : Number(lines.totalCoeff)) + bonus.coeff;
  return { boards: [board.join(''), ...bonus.boards], actions: [opening, ...bonus.actions], coeff };
};

const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/** A plain decimal as digits and a scale: `"30.5"` → 305n, 1. */
const digitsOf = (value: number): { digits: bigint; scale: number } => {
  const match = DECIMAL.exec(String(value));
  if (match === null) throw new RangeError(`[JokerSlotMockHost] ${value} is not a plain decimal`);
  const fraction = match[2] ?? '';
  return { digits: BigInt(match[1]! + fraction), scale: fraction.length };
};

/**
 * The top-level win: the coefficient as the reply writes it times what the play charged, in decimal, cut down
 * to cents. The rule reproduces every recorded reply — a bought 31 bets at x75 has coeff 0.41333333333333333
 * and shows 30.99, a bought 5 bets has 0.06666666666666667 and shows 5.00.
 */
export const topWinAmount = (coeff: number, amount: number): string => {
  const left = digitsOf(coeff);
  const right = digitsOf(amount);
  const scale = left.scale + right.scale;
  const product = left.digits * right.digits;
  const cents = scale >= 2 ? product / 10n ** BigInt(scale - 2) : product * 10n ** BigInt(2 - scale);
  const text = cents.toString().padStart(3, '0');
  return `${text.slice(0, -2)}.${text.slice(-2)}`;
};

/** Deals one play whole: a spin at the bet, or a bonus bought at its full price. */
export const dealJokerSlotRound = (deal: JokerSlotDeal): JokerSlotSpinResult => {
  const { bet, currency, random, bonusBuy, outcome } = deal;
  const price = bonusBuy === undefined ? 1 : BONUS_BUY_PRICES[bonusBuy];
  const hasBonus = bonusBuy !== undefined || outcome === 'bonus' || (outcome === undefined && random() < BONUS_CHANCE);
  const played = hasBonus ? playWithBonus(deal, bet) : playPlain(outcome, bet, random);
  const amount = bet * price;
  const coeff = played.coeff / price;
  const betAmount = amount.toFixed(2);
  return {
    status: played.coeff > 0 ? 'win' : 'lose',
    bet: { amount: betAmount, currency, decimalPlaces: 2 },
    betAmount,
    coeff,
    currency,
    isFinished: true,
    isWin: played.coeff > 0,
    winAmount: topWinAmount(coeff, amount),
    rounds: played.boards.length,
    boards: played.boards,
    actions: played.actions,
  };
};
