/**
 * The wheel round as the engine sees it. The round runs on the server's schedule and the host forwards
 * every change of it as `ApplyRound` — duplicates included — so the state is a merge: a duplicate changes
 * nothing, and a later snapshot of the same round may drop the cell it already named (RoadFrontent
 * `src/modes/wheel/engineMessage.ts`). `serial` tells rounds apart even when the host names none.
 */
import { CELL_COUNT, firstCellOf, isWheelColor, type WheelColor } from './wheelCells';

export const WHEEL_STATUSES = ['WAIT_GAME', 'IN_GAME', 'FINISH_GAME', 'STOPPED'] as const;

export type WheelStatus = (typeof WHEEL_STATUSES)[number];

export interface WheelSnapshot {
  readonly status: WheelStatus;
  readonly roundId: string | null;
  readonly msToNextPhase: number | null;
  readonly winnerColor: WheelColor | null;
  readonly cellIndex: number | null;
  readonly inCellOffset: number | null;
}

export interface WheelRoundState extends Omit<WheelSnapshot, 'msToNextPhase'> {
  /** The engine's own count of rounds: one per new round id or new betting phase. */
  readonly serial: number;
  /** When the phase changes, on the clock the state was built with; null — the host named no time. */
  readonly deadlineAt: number | null;
}

export class WheelSnapshotError extends Error {
  public constructor(field: string, value: unknown) {
    super(`[demo wheel] ApplyRound has an invalid ${field}: ${JSON.stringify(value) ?? String(value)}`);
    this.name = 'WheelSnapshotError';
  }
}

type Fields = Readonly<Record<string, unknown>>;

const isStatus = (value: unknown): value is WheelStatus => WHEEL_STATUSES.some((status) => status === value);

/** A number the host may forward as the server's decimal string; absent is null, anything else throws. */
const optionalNumber = (fields: Fields, field: string): number | null => {
  const raw = fields[field];
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new WheelSnapshotError(field, raw);
  return value;
};

const optionalCell = (fields: Fields): number | null => {
  const cellIndex = optionalNumber(fields, 'cellIndex');
  if (cellIndex === null) return null;
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= CELL_COUNT) {
    throw new WheelSnapshotError('cellIndex', fields.cellIndex);
  }
  return cellIndex;
};

const optionalOffset = (fields: Fields): number | null => {
  const offset = optionalNumber(fields, 'inCellOffset');
  if (offset === null) return null;
  if (offset < 0 || offset > 1) throw new WheelSnapshotError('inCellOffset', fields.inCellOffset);
  return Math.min(offset, 0.999);
};

const optionalColor = (fields: Fields): WheelColor | null => {
  const color = fields.winnerColor;
  if (color === null || color === undefined) return null;
  if (!isWheelColor(color)) throw new WheelSnapshotError('winnerColor', color);
  return color;
};

const optionalRoundId = (fields: Fields): string | null => {
  const roundId = fields.roundId;
  if (roundId === null || roundId === undefined) return null;
  if (typeof roundId !== 'string' && typeof roundId !== 'number') throw new WheelSnapshotError('roundId', roundId);
  return String(roundId);
};

/** The `ApplyRound` payload as the bridge parsed it; throws `WheelSnapshotError` on a field it cannot read. */
export const readWheelSnapshot = (raw: unknown): WheelSnapshot => {
  if (typeof raw !== 'object' || raw === null) throw new WheelSnapshotError('payload', raw);
  const fields = raw as Fields;
  if (!isStatus(fields.status)) throw new WheelSnapshotError('status', fields.status);
  return {
    status: fields.status,
    roundId: optionalRoundId(fields),
    msToNextPhase: optionalNumber(fields, 'msToNextPhase'),
    winnerColor: optionalColor(fields),
    cellIndex: optionalCell(fields),
    inCellOffset: optionalOffset(fields),
  };
};

const isNewRound = (state: WheelRoundState, snapshot: WheelSnapshot): boolean =>
  snapshot.roundId !== state.roundId || (snapshot.status === 'WAIT_GAME' && state.status !== 'WAIT_GAME');

const deadlineOf = (snapshot: WheelSnapshot, now: number): number | null =>
  snapshot.msToNextPhase === null ? null : now + snapshot.msToNextPhase;

const freshRound = (snapshot: WheelSnapshot, serial: number, now: number): WheelRoundState => {
  const { msToNextPhase: _remainder, ...fields } = snapshot;
  return { ...fields, serial, deadlineAt: deadlineOf(snapshot, now) };
};

/**
 * Merges a snapshot into the round. A duplicate keeps the first deadline: the host recounts the remainder
 * on every send, and a countdown that jumps back by the delivery delay looks broken.
 */
export const applyWheelSnapshot = (state: WheelRoundState | null, snapshot: WheelSnapshot, now: number): WheelRoundState => {
  if (state === null) return freshRound(snapshot, 1, now);
  if (isNewRound(state, snapshot)) return freshRound(snapshot, state.serial + 1, now);
  const isDuplicate = snapshot.status === state.status && state.deadlineAt !== null;
  return {
    ...state,
    status: snapshot.status,
    deadlineAt: isDuplicate ? state.deadlineAt : deadlineOf(snapshot, now),
    winnerColor: snapshot.winnerColor ?? state.winnerColor,
    cellIndex: snapshot.cellIndex ?? state.cellIndex,
    inCellOffset: snapshot.inCellOffset ?? state.inCellOffset,
  };
};

/**
 * The cell the wheel stops on: the named one, or — for a page opened mid-result whose snapshot names only
 * the colour — the first cell of that colour.
 */
export const targetCellOf = (state: WheelRoundState): number | null => {
  if (state.cellIndex !== null) return state.cellIndex;
  return state.winnerColor === null ? null : firstCellOf(state.winnerColor);
};
