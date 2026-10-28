/**
 * Jumper payloads read at the bridge edge. The protocol types steps as numbers and coefficients as decimal
 * strings, but the shell forwards the server's values as they come, and a backend sends either form for
 * either field — so both are read here, and anything else throws `JumperReadError` before it reaches a frame.
 */
import {
  JUMPER_ACCELERATORS,
  JUMPER_DIFFICULTIES,
  type JumperAccelerator,
  type JumperDifficulty,
  type JumperMove,
  type JumperRoundStatus,
  type JumperSlotState,
} from '@omega/webbridge-protocol';
import type { JumperBonus, JumperFreeGame, JumperRound, JumperSlotView } from './jumperModel';

export class JumperReadError extends Error {
  public constructor(field: string, value: unknown) {
    super(`[demo jumper] invalid ${field}: ${JSON.stringify(value) ?? String(value)}`);
    this.name = 'JumperReadError';
  }
}

type Fields = Readonly<Record<string, unknown>>;

const fieldsOf = (value: unknown, field: string): Fields => {
  if (typeof value !== 'object' || value === null) throw new JumperReadError(field, value);
  return value as Fields;
};

const listOf = (value: unknown, field: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new JumperReadError(field, value);
  return value;
};

const numberOf = (value: unknown, field: string): number => {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) throw new JumperReadError(field, value);
  return parsed;
};

const oneOf = <T extends string>(options: readonly T[], value: unknown, field: string): T => {
  const match = options.find((option) => option === value);
  if (match === undefined) throw new JumperReadError(field, value);
  return match;
};

const textOf = (value: unknown, field: string): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new JumperReadError(field, value);
};

const STATUSES: readonly JumperRoundStatus[] = ['none', 'in-game', 'win', 'lose'];
const SLOT_STATES: readonly JumperSlotState[] = ['HIDDEN', 'NONE', ...JUMPER_ACCELERATORS];
const MOVES: readonly JumperMove[] = ['play', 'step', 'payout'];
const ROUTE_ACTIONS: readonly ('STEP' | JumperAccelerator)[] = ['STEP', ...JUMPER_ACCELERATORS];

export const readDifficulty = (value: unknown): JumperDifficulty => oneOf(JUMPER_DIFFICULTIES, value, 'difficulty');

const readSlot = (value: unknown): JumperSlotView => {
  const slot = fieldsOf(value, 'slot');
  return { step: numberOf(slot.step, 'slots.step'), state: oneOf(SLOT_STATES, slot.state, 'slots.state') };
};

const readVisited = (value: unknown): JumperRound['visitedSteps'][number] => {
  const visited = fieldsOf(value, 'visitedSteps');
  const accelerator = oneOf(JUMPER_ACCELERATORS, visited.accelerator, 'visitedSteps.accelerator');
  return { step: numberOf(visited.step, 'visitedSteps.step'), accelerator };
};

/** `ApplyGameState` and `ApplyJumperMove` alike: the round as the server last described it. */
export const readJumperRound = (value: unknown): JumperRound => {
  const state = fieldsOf(value, 'round');
  const collision = state.collisionPosition;
  return {
    status: oneOf(STATUSES, state.status, 'status'),
    difficulty: readDifficulty(state.difficulty),
    coefficient: numberOf(state.coeff, 'coeff'),
    winAmount: textOf(state.winAmount, 'winAmount'),
    slots: listOf(state.slots, 'slots').map(readSlot),
    lineNumber: numberOf(state.lineNumber, 'lineNumber'),
    landingStep: numberOf(state.landingStep, 'landingStep'),
    visitedSteps: listOf(state.visitedSteps, 'visitedSteps').map(readVisited),
    collisionStep: collision === undefined || collision === null ? null : numberOf(collision, 'collisionPosition'),
  };
};

/** `ApplyJumperMove`: the round and the request it answers. */
export const readJumperMove = (value: unknown): { readonly move: JumperMove; readonly round: JumperRound } => ({
  move: oneOf(MOVES, fieldsOf(value, 'move').move, 'move'),
  round: readJumperRound(value),
});

/** The ladder of every difficulty: coefficients by step index. */
export const readJumperLadders = (value: unknown): ReadonlyMap<JumperDifficulty, readonly number[]> => {
  const ladders = listOf(fieldsOf(value, 'config').ladders, 'ladders').map((entry) => {
    const ladder = fieldsOf(entry, 'ladder');
    const coefficients = listOf(ladder.coefficients, 'coefficients').map((coefficient) => numberOf(coefficient, 'coefficients'));
    return [readDifficulty(ladder.difficulty), coefficients] as const;
  });
  return new Map(ladders);
};

const readFreeGame = (value: unknown): JumperFreeGame => {
  const game = fieldsOf(value, 'games');
  const route = listOf(game.route, 'route').map((entry) => {
    const point = fieldsOf(entry, 'route');
    return { step: numberOf(point.step, 'route.step'), action: oneOf(ROUTE_ACTIONS, point.action, 'route.action') };
  });
  return { finalStep: numberOf(game.finalStep, 'finalStep'), coefficient: numberOf(game.coefficient, 'coefficient'), route };
};

export const readJumperBonus = (value: unknown): JumperBonus => {
  const bonus = fieldsOf(value, 'bonus');
  return {
    difficulty: readDifficulty(bonus.difficulty),
    totalCoefficient: numberOf(bonus.totalCoefficient, 'totalCoefficient'),
    totalWin: textOf(bonus.totalWin, 'totalWin'),
    currency: textOf(bonus.currency, 'currency'),
    games: listOf(bonus.games, 'games').map(readFreeGame),
  };
};
