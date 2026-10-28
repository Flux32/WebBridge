/**
 * Twist payloads as the scene reads them. The host forwards the server's raw game state: one `outcome` per
 * spin and the authoritative `progress` (filled cells per sector). Only `sessionIsFinished` tells a closed
 * session — `isFinished` is also true on a part cash out of a live one — and a closed session's leftover
 * progress is never drawn.
 */
import { EMPTY_PROGRESS, sectorCellCount, TWIST_SECTORS, type TwistProgress, type TwistSector } from './twistTable';

export type TwistOutcome = TwistSector | 'death' | 'air';
export type Totem = TwistSector | 'death';
export type TotemTriple = readonly [Totem, Totem, Totem];

export interface TwistSpin {
  readonly outcome: TwistOutcome;
  readonly progress: TwistProgress;
  readonly isSessionFinished: boolean;
  readonly hasBonus: boolean;
}

export class TwistStateError extends Error {
  public override readonly name = 'TwistStateError';
}

const OUTCOMES: readonly TwistOutcome[] = ['fire', 'earth', 'water', 'death', 'air'];

const recordOf = (raw: unknown, what: string): Record<string, unknown> => {
  if (typeof raw !== 'object' || raw === null) throw new TwistStateError(`${what} is not an object: ${JSON.stringify(raw)}`);
  return raw as Record<string, unknown>;
};

/** Server numbers reach the game as decimal strings as often as numbers. */
const readCells = (value: unknown, sector: TwistSector): number => {
  const cells = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof cells !== 'number' || !Number.isInteger(cells) || cells < 0 || cells > sectorCellCount(sector)) {
    throw new TwistStateError(`progress.${sector} is not 0…${sectorCellCount(sector)}: ${JSON.stringify(value)}`);
  }
  return cells;
};

const readProgress = (raw: unknown): TwistProgress => {
  const progress = recordOf(raw, 'progress');
  return {
    fire: readCells(progress.fire, 'fire'),
    earth: readCells(progress.earth, 'earth'),
    water: readCells(progress.water, 'water'),
  };
};

const readOutcome = (value: unknown, allowed: readonly TwistOutcome[]): TwistOutcome => {
  const outcome = allowed.find((candidate) => candidate === value);
  if (outcome === undefined) throw new TwistStateError(`outcome ${JSON.stringify(value)} is not one of ${allowed.join('|')}`);
  return outcome;
};

/** `ApplySpinResult`: the raw play reply. */
export const readTwistSpin = (raw: unknown): TwistSpin => {
  const spin = recordOf(raw, 'spin');
  const bonus = spin.bonus as { hasBonus?: unknown } | undefined;
  return {
    outcome: readOutcome(spin.outcome, OUTCOMES),
    progress: readProgress(spin.progress),
    isSessionFinished: spin.sessionIsFinished === true,
    hasBonus: bonus?.hasBonus === true,
  };
};

/** One free spin of a bought series: no death in it, and the series never closes the session. */
export const readTwistBonusRound = (raw: unknown): TwistSpin => {
  const round = recordOf(raw, 'free spin');
  return {
    outcome: readOutcome(round.outcome, OUTCOMES.filter((outcome) => outcome !== 'death')),
    progress: readProgress(round.progress),
    isSessionFinished: false,
    hasBonus: false,
  };
};

/** The free spins count the server announced; never below the spins actually sent. */
export const readSeriesTotal = (value: unknown, spinCount: number): number => {
  const total = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof total !== 'number' || !Number.isFinite(total)) {
    throw new TwistStateError(`totalRounds is not a number: ${JSON.stringify(value)}`);
  }
  return Math.max(total, spinCount);
};

/** The board a spin leaves: a closed session's progress is a leftover, the board is empty. */
export const boardAfter = (spin: TwistSpin): TwistProgress => (spin.isSessionFinished ? EMPTY_PROGRESS : spin.progress);

/** `ApplyGameState`: a restore at boot or a part cash out. A player with no session has no `progress`. */
export const readTwistState = (raw: unknown): TwistProgress => {
  const state = recordOf(raw, 'game state');
  if (state.sessionIsFinished === true || state.progress === undefined) return EMPTY_PROGRESS;
  return readProgress(state.progress);
};

/** Three totems for the outcome. Air is a miss: two sector colours, never a triple and never a skull. */
export const totemsOf = (outcome: TwistOutcome, random: () => number = Math.random): TotemTriple => {
  if (outcome !== 'air') return [outcome, outcome, outcome];
  const pick = (items: readonly TwistSector[]): TwistSector =>
    items[Math.min(items.length - 1, Math.floor(random() * items.length))] ?? 'fire';
  const first = pick(TWIST_SECTORS);
  const second = pick(TWIST_SECTORS.filter((sector) => sector !== first));
  const odd = Math.min(2, Math.floor(random() * 3));
  return [odd === 0 ? second : first, odd === 1 ? second : first, odd === 2 ? second : first];
};
