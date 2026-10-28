/**
 * A slot round as the scene plays it. One `ApplySpinResult` carries the whole round: `boards[i]` is a board
 * string, column-major (`reel * rows + row`), and `actions[i]` what happens on it. Only the coin collection is
 * drawn; the action list is open (`SLOT_ACTIONS`), so other actions are passed over, not rejected.
 */
import { SLOT_ACTIONS, type SlotAction, type SlotSpinResult } from '@omega/webbridge-protocol';
import { symbolCoeff, symbolOf, type SlotSymbol } from './slotSymbols';

/** The live cabinet's shape (MegaSlot): three reels, four symbols tall. The payload does not carry it. */
export const SLOT_REELS = 3;
export const SLOT_ROWS = 4;
const CELL_COUNT = SLOT_REELS * SLOT_ROWS;

export class SlotRoundError extends Error {
  public override readonly name = 'SlotRoundError';
}

export interface SlotCoin {
  readonly index: number;
  readonly coeff: number;
}

export interface SlotCollection {
  readonly triggerIndex: number;
  readonly coins: readonly SlotCoin[];
}

export interface SlotBoardPlan {
  readonly cells: readonly SlotSymbol[];
  readonly collection: SlotCollection | null;
}

export interface SlotRoundPlan {
  readonly boards: readonly SlotBoardPlan[];
  readonly coeff: number;
  readonly isWin: boolean;
  readonly winText: string;
}

/** The host forwards server numbers as it got them: decimal strings as often as numbers. */
const readNumber = (value: unknown, field: string): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new SlotRoundError(`${field} is not a number: ${JSON.stringify(value)}`);
  }
  return number;
};

const readIndex = (value: unknown, field: string): number => {
  const index = readNumber(value, field);
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    throw new SlotRoundError(`${field} ${index} is off the ${SLOT_REELS}x${SLOT_ROWS} board`);
  }
  return index;
};

const readCells = (board: string, boardNumber: number): readonly SlotSymbol[] => {
  if (board.length !== CELL_COUNT) {
    throw new SlotRoundError(`board ${boardNumber} has ${board.length} cells, not ${CELL_COUNT}: "${board}"`);
  }
  return [...board].map((code) => {
    const symbol = symbolOf(code);
    if (symbol === null) throw new SlotRoundError(`board ${boardNumber} holds unknown symbol "${code}"`);
    return symbol;
  });
};

const readCoin = (raw: unknown, cells: readonly SlotSymbol[]): SlotCoin => {
  const coin = (raw ?? {}) as { index?: unknown; coeff?: unknown };
  const index = readIndex(coin.index, 'coin index');
  if (coin.coeff !== undefined) return { index, coeff: readNumber(coin.coeff, 'coin coeff') };
  // The coefficient is optional in the protocol (`SlotCoin.coeff?`); the board symbol then tells it.
  const coeff = symbolCoeff(cells[index] ?? { kind: 'empty' });
  if (coeff === null) throw new SlotRoundError(`coin ${index} has no coeff and no coin on the board`);
  return { index, coeff };
};

const readCollection = (actions: readonly SlotAction[], cells: readonly SlotSymbol[]): SlotCollection | null => {
  const action = actions.find((candidate) => candidate.action === SLOT_ACTIONS.strikeCoinsCollection);
  if (action === undefined) return null;
  if (!Array.isArray(action.coins)) throw new SlotRoundError('coin collection without a coins list');
  return {
    triggerIndex: readIndex(action.triggerIndex, 'trigger index'),
    coins: action.coins.map((coin: unknown) => readCoin(coin, cells)),
  };
};

/** Throws `SlotRoundError` on a round the scene cannot show truthfully. */
export const planSlotRound = (result: SlotSpinResult): SlotRoundPlan => {
  if (!Array.isArray(result.boards) || result.boards.length === 0) throw new SlotRoundError('round without boards');
  const boards = result.boards.map((board, index): SlotBoardPlan => {
    const cells = readCells(String(board), index + 1);
    // `actions` is optional per board in the shell's schema: a board without them is a plain spin.
    const actions = result.actions?.[index];
    return { cells, collection: readCollection(Array.isArray(actions) ? actions : [], cells) };
  });
  const winAmount = readNumber(result.winAmount, 'winAmount');
  return {
    boards,
    coeff: readNumber(result.coeff, 'coeff'),
    isWin: winAmount > 0,
    winText: `${winAmount.toFixed(2)} ${result.currency}`,
  };
};
