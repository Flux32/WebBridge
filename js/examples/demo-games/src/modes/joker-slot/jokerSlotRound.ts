/**
 * A Joker Slot round as the scene plays it. One `ApplySpinResult` carries the whole round: `boards[i]` is a
 * board string in slot-coin's alphabet and layout, `actions[i]` its steps in order. The scene draws the
 * paylines, the coins a bonus start or a Super Joker puts on the board, the bonus board appearing, every
 * joker's collection and a Super Joker's multiplier; the action list is open, so other actions are passed
 * over, not rejected. The spins counter of a bonus board is its caption, not a step.
 */
import { JOKER_SLOT_WIN_LINES, type JokerSlotAction, type JokerSlotSpinResult } from '@omega/webbridge-protocol';
import { SLOT_COIN_REELS, SLOT_COIN_ROWS, type SlotCoinBoardCoin, type SlotCoinCollection } from '../slot-coin/slotCoinRound';
import { symbolCoeff, symbolOf, type SlotCoinSymbol } from '../slot-coin/slotCoinSymbols';

const CELL_COUNT = SLOT_COIN_REELS * SLOT_COIN_ROWS;

export class JokerSlotRoundError extends Error {
  public override readonly name = 'JokerSlotRoundError';
}

export interface PlacedSymbol {
  readonly index: number;
  readonly symbol: SlotCoinSymbol;
}

export type JokerSlotStep =
  | { readonly kind: 'lines'; readonly cells: readonly number[]; readonly coeff: number }
  | { readonly kind: 'place'; readonly symbols: readonly PlacedSymbol[] }
  | { readonly kind: 'bonusBoard'; readonly cells: readonly SlotCoinSymbol[] }
  | { readonly kind: 'collect'; readonly collection: SlotCoinCollection }
  | { readonly kind: 'multiplier'; readonly triggerIndex: number; readonly multiplier: number };

export interface JokerSlotBoardPlan {
  readonly cells: readonly SlotCoinSymbol[];
  readonly steps: readonly JokerSlotStep[];
  /** Bonus spins left after this board; `null` on the base board. */
  readonly spinsLeft: number | null;
}

export interface JokerSlotRoundPlan {
  readonly boards: readonly JokerSlotBoardPlan[];
  readonly isWin: boolean;
  readonly winText: string;
}

/** The host forwards server numbers as it got them: decimal strings as often as numbers. */
const readNumber = (value: unknown, field: string): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new JokerSlotRoundError(`${field} is not a number: ${JSON.stringify(value)}`);
  }
  return number;
};

const readIndex = (value: unknown, field: string): number => {
  const index = readNumber(value, field);
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    throw new JokerSlotRoundError(`${field} ${index} is off the ${SLOT_COIN_REELS}x${SLOT_COIN_ROWS} board`);
  }
  return index;
};

const readSymbol = (code: unknown, where: string): SlotCoinSymbol => {
  const symbol = typeof code === 'string' ? symbolOf(code) : null;
  if (symbol === null) throw new JokerSlotRoundError(`${where} holds unknown symbol ${JSON.stringify(code)}`);
  return symbol;
};

const readCells = (codes: readonly unknown[], where: string): SlotCoinSymbol[] => {
  if (codes.length !== CELL_COUNT) throw new JokerSlotRoundError(`${where} has ${codes.length} cells, not ${CELL_COUNT}`);
  return codes.map((code) => readSymbol(code, where));
};

const listOf = (value: unknown, field: string): unknown[] => {
  if (!Array.isArray(value)) throw new JokerSlotRoundError(`${field} is not a list`);
  return value;
};

const fieldsOf = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});

const readPlaced = (value: unknown, field: string): PlacedSymbol[] =>
  listOf(value, field).map((raw) => {
    const cell = fieldsOf(raw);
    return { index: readIndex(cell.index, `${field} index`), symbol: readSymbol(cell.symbol, field) };
  });

/** A paid cell; without `coeff` the board symbol tells what a coin is worth. */
const readPaid = (raw: unknown, cells: readonly SlotCoinSymbol[]): SlotCoinBoardCoin => {
  const cell = fieldsOf(raw);
  const index = readIndex(cell.index, 'coin index');
  if (cell.coeff !== undefined) return { index, coeff: readNumber(cell.coeff, 'coin coeff') };
  const coeff = symbolCoeff(cells[index] ?? { kind: 'empty' });
  if (coeff === null) throw new JokerSlotRoundError(`coin ${index} has no coeff and no coin on the board`);
  return { index, coeff };
};

const readLines = (winLines: unknown): JokerSlotStep[] =>
  listOf(winLines, 'winLines').map((raw) => {
    const line = fieldsOf(raw);
    const cells = JOKER_SLOT_WIN_LINES[readNumber(line.winLineNumber, 'winLineNumber')];
    if (cells === undefined) throw new JokerSlotRoundError(`no payline ${JSON.stringify(line.winLineNumber)}`);
    return { kind: 'lines', cells, coeff: readNumber(line.coeff, 'line coeff') };
  });

/** The steps of one action against the board as it stands; `cells` follows what the steps put on it. */
const readStep = (action: JokerSlotAction, cells: SlotCoinSymbol[]): JokerSlotStep[] => {
  switch (action.action) {
    case 'WIN_LINES':
      return readLines(action.winLines);
    case 'PILE_OF_GOLD':
    case 'BONUS_BUY':
      return [{ kind: 'place', symbols: [...readPlaced(action.coins, 'coins'), ...readPlaced(action.strikes, 'strikes')] }];
    case 'SUPER_STRIKE_COINS_ADDED':
      return [{ kind: 'place', symbols: readPlaced(action.coins, 'coins') }];
    case 'BONUS_RUN':
      return [{ kind: 'bonusBoard', cells: readCells(listOf(action.board, 'bonus board').map((cell) => (Array.isArray(cell) ? cell[0] : cell)), 'bonus board') }];
    case 'STRIKE_COINS_COLLECTION':
      return [{ kind: 'collect', collection: { triggerIndex: readIndex(action.triggerIndex, 'trigger index'), coins: listOf(action.coins, 'coins').map((coin) => readPaid(coin, cells)) } }];
    case 'ENHANCED_SUPER_STRIKE':
      return [{ kind: 'collect', collection: { triggerIndex: readIndex(action.triggerIndex, 'trigger index'), coins: listOf(action.strikes, 'strikes').map((strike) => readPaid(strike, cells)) } }];
    case 'SUPER_STRIKE_MULTIPLIER_ADDED':
      return [{ kind: 'multiplier', triggerIndex: readIndex(action.triggerIndex, 'trigger index'), multiplier: readNumber(action.multiplier, 'multiplier') }];
    default:
      return [];
  }
};

const applyStep = (step: JokerSlotStep, cells: SlotCoinSymbol[]): void => {
  if (step.kind === 'place') for (const { index, symbol } of step.symbols) cells[index] = symbol;
  if (step.kind === 'bonusBoard') cells.splice(0, CELL_COUNT, ...step.cells);
};

const readBoard = (board: unknown, actions: unknown, boardNumber: number): JokerSlotBoardPlan => {
  const cells = readCells([...String(board)], `board ${boardNumber}`);
  const current = [...cells];
  const steps: JokerSlotStep[] = [];
  let spinsLeft: number | null = null;
  for (const raw of Array.isArray(actions) ? (actions as JokerSlotAction[]) : []) {
    if (raw.action === 'BONUS_SPINS_COUNT') spinsLeft = readNumber(raw.count, 'bonus spins count');
    for (const step of readStep(raw, current)) {
      steps.push(step);
      applyStep(step, current);
    }
  }
  return { cells, steps, spinsLeft };
};

/** Throws `JokerSlotRoundError` on a round the scene cannot show truthfully. */
export const planJokerSlotRound = (result: JokerSlotSpinResult): JokerSlotRoundPlan => {
  if (!Array.isArray(result.boards) || result.boards.length === 0) throw new JokerSlotRoundError('round without boards');
  const boards = result.boards.map((board, index) => readBoard(board, result.actions?.[index], index + 1));
  const winAmount = readNumber(result.winAmount, 'winAmount');
  return { boards, isWin: winAmount > 0, winText: `${winAmount.toFixed(2)} ${result.currency}` };
};
