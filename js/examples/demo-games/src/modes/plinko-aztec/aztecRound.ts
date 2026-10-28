/**
 * The plinko-aztec round as the engine sees it. The config's `positions` are the slot line, a zero
 * coefficient being the wheel slot. A drop or a bonus step is a GameState: `ballsResult` names each ball's
 * slot by its coefficient (`"1000"`, `"0.2"`) or `"spin"` — not by index, so twin slots on both sides are the
 * board's choice; `freeSpinResult` is the wheel, `bonusGameState.result` the running bonus game.
 */
import { readNumber, readRecord, readText, PlinkoPayloadError, toNumber } from '../plinko/payload';
import { slotLineOf, type Slot } from '../plinko/slotLine';

export interface AztecBonus {
  readonly level: number;
  readonly dropsLeft: number;
  readonly ballsPerDrop: number;
  readonly winAmount: string;
}

export interface AztecDrop {
  /** The slot index of every ball, in drop order. */
  readonly slots: readonly number[];
  readonly winAmount: string;
  /** The wheel's `position` (`"bonus"` or a multiplier) when the drop spun the wheel. */
  readonly freeSpin: string | null;
  /** The bonus game still running after this drop or step. */
  readonly bonus: AztecBonus | null;
}

const SPIN_POSITION = 'spin';
const isSpinCoefficient = (coefficient: number): boolean => coefficient === 0;

export const aztecLineOf = (config: unknown): readonly Slot[] => {
  const positions = readRecord(config, 'config').positions;
  if (!Array.isArray(positions)) throw new PlinkoPayloadError('config.positions is not a list');
  const coefficients = positions.map((position, index) =>
    toNumber(readRecord(position, `positions[${index}]`).coefficient, `positions[${index}].coefficient`),
  );
  return slotLineOf(coefficients, isSpinCoefficient);
};

/** Twin slots take turns by ball, so a drop spreads over both sides of the board. */
export const slotIndexOf = (line: readonly Slot[], position: string, ballIndex: number): number => {
  const coefficient = position === SPIN_POSITION ? 0 : toNumber(position, 'ball position');
  const candidates: number[] = [];
  line.forEach((slot, index) => {
    if (Math.abs(slot.coefficient - coefficient) < 1e-9) candidates.push(index);
  });
  const slot = candidates[ballIndex % Math.max(1, candidates.length)];
  if (slot === undefined) throw new PlinkoPayloadError(`ball position "${position}" is not on the ${line.length}-slot line`);
  return slot;
};

export const readBonus = (state: unknown): AztecBonus | null => {
  const bonusState = readRecord(state, 'game state').bonusGameState;
  if (bonusState === undefined) return null;
  const result = readRecord(bonusState, 'bonusGameState').result;
  if (result === undefined) return null;
  const bonus = readRecord(result, 'bonusGameState.result');
  return {
    level: readNumber(bonus, 'level'),
    dropsLeft: readNumber(bonus, 'ballsAmount'),
    ballsPerDrop: readNumber(bonus, 'ballPerDrop'),
    winAmount: readText(bonus, 'winAmount'),
  };
};

const readFreeSpin = (state: Readonly<Record<string, unknown>>): string | null => {
  if (state.freeSpinResult === undefined) return null;
  return readText(readRecord(state.freeSpinResult, 'freeSpinResult'), 'position');
};

/** Throws `PlinkoPayloadError` on a state the board cannot play. */
export const readAztecDrop = (state: unknown, line: readonly Slot[]): AztecDrop => {
  const record = readRecord(state, 'drop result');
  if (!Array.isArray(record.ballsResult)) throw new PlinkoPayloadError('ballsResult is not a list');
  const slots = record.ballsResult.map((ball, index) =>
    slotIndexOf(line, readText(readRecord(ball, `ballsResult[${index}]`), 'position'), index),
  );
  return {
    slots,
    winAmount: readText(record, 'winAmount'),
    freeSpin: readFreeSpin(record),
    bonus: readBonus(record),
  };
};
