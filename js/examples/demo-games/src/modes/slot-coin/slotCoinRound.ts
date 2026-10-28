/**
 * A slot-coin round as the scene plays it. One `ApplySpinResult` carries the whole round: `boards[i]` is a board
 * string, column-major (`reel * rows + row`), and `actions[i]` what happens on it. Only the coin collection is
 * drawn; the action list is open (`SLOT_COIN_ACTIONS`), so other actions are passed over, not rejected.
 */
import { SLOT_COIN_ACTIONS, type SlotCoinAction, type SlotCoinSpinResult } from '@omega/webbridge-protocol';
import { symbolCoeff, symbolOf, type SlotCoinSymbol } from './slotCoinSymbols';

/** The live cabinet's shape (MegaSlot): three reels, four symbols tall. The payload does not carry it. */
export const SLOT_COIN_REELS = 3;
export const SLOT_COIN_ROWS = 4;
const CELL_COUNT = SLOT_COIN_REELS * SLOT_COIN_ROWS;

export class SlotCoinRoundError extends Error {
  public override readonly name = 'SlotCoinRoundError';
}

export interface SlotCoinBoardCoin {
  readonly index: number;
  readonly coeff: number;
}

export interface SlotCoinCollection {
  readonly triggerIndex: number;
  readonly coins: readonly SlotCoinBoardCoin[];
}

export interface SlotCoinBoardPlan {
  readonly cells: readonly SlotCoinSymbol[];
  readonly collection: SlotCoinCollection | null;
}

export interface SlotCoinRoundPlan {
  readonly boards: readonly SlotCoinBoardPlan[];
  readonly coeff: number;
  readonly isWin: boolean;
  readonly winText: string;
}

/** The host forwards server numbers as it got them: decimal strings as often as numbers. */
const readNumber = (value: unknown, field: string): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new SlotCoinRoundError(`${field} is not a number: ${JSON.stringify(value)}`);
  }
  return number;
};

const readIndex = (value: unknown, field: string): number => {
  const index = readNumber(value, field);
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    throw new SlotCoinRoundError(`${field} ${index} is off the ${SLOT_COIN_REELS}x${SLOT_COIN_ROWS} board`);
  }
  return index;
};

const readCells = (board: string, boardNumber: number): readonly SlotCoinSymbol[] => {
  if (board.length !== CELL_COUNT) {
    throw new SlotCoinRoundError(`board ${boardNumber} has ${board.length} cells, not ${CELL_COUNT}: "${board}"`);
  }
  return [...board].map((code) => {
    const symbol = symbolOf(code);
    if (symbol === null) throw new SlotCoinRoundError(`board ${boardNumber} holds unknown symbol "${code}"`);
    return symbol;
  });
};

const readCoin = (raw: unknown, cells: readonly SlotCoinSymbol[]): SlotCoinBoardCoin => {
  const coin = (raw ?? {}) as { index?: unknown; coeff?: unknown };
  const index = readIndex(coin.index, 'coin index');
  if (coin.coeff !== undefined) return { index, coeff: readNumber(coin.coeff, 'coin coeff') };
  // The coefficient is optional in the protocol (`SlotCoinBoardCoin.coeff?`); the board symbol then tells it.
  const coeff = symbolCoeff(cells[index] ?? { kind: 'empty' });
  if (coeff === null) throw new SlotCoinRoundError(`coin ${index} has no coeff and no coin on the board`);
  return { index, coeff };
};

const readCollection = (actions: readonly SlotCoinAction[], cells: readonly SlotCoinSymbol[]): SlotCoinCollection | null => {
  const action = actions.find((candidate) => candidate.action === SLOT_COIN_ACTIONS.strikeCoinsCollection);
  if (action === undefined) return null;
  if (!Array.isArray(action.coins)) throw new SlotCoinRoundError('coin collection without a coins list');
  return {
    triggerIndex: readIndex(action.triggerIndex, 'trigger index'),
    coins: action.coins.map((coin: unknown) => readCoin(coin, cells)),
  };
};

/** Throws `SlotCoinRoundError` on a round the scene cannot show truthfully. */
export const planSlotCoinRound = (result: SlotCoinSpinResult): SlotCoinRoundPlan => {
  if (!Array.isArray(result.boards) || result.boards.length === 0) throw new SlotCoinRoundError('round without boards');
  const boards = result.boards.map((board, index): SlotCoinBoardPlan => {
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
