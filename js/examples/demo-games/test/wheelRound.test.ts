import { describe, expect, it } from 'vitest';
import {
  applyWheelSnapshot,
  readWheelSnapshot,
  targetCellOf,
  WheelSnapshotError,
  type WheelSnapshot,
} from '../src/modes/wheel/wheelRound';

const snapshot = (patch: Partial<WheelSnapshot>): WheelSnapshot => ({
  status: 'WAIT_GAME',
  roundId: 'r1',
  msToNextPhase: null,
  winnerColor: null,
  cellIndex: null,
  inCellOffset: null,
  ...patch,
});

describe('readWheelSnapshot', () => {
  it('reads the round message the shell sends', () => {
    const raw = { status: 'IN_GAME', roundId: '7', msToNextPhase: 4000, winnerColor: null, cellIndex: 17, inCellOffset: 0.42 };
    expect(readWheelSnapshot(raw)).toEqual({ ...raw, winnerColor: null });
  });

  it('reads numbers that arrive as decimal strings', () => {
    const raw = { status: 'IN_GAME', roundId: 7, msToNextPhase: '4000', cellIndex: '17', inCellOffset: '0.42' };
    expect(readWheelSnapshot(raw)).toMatchObject({ roundId: '7', msToNextPhase: 4000, cellIndex: 17, inCellOffset: 0.42 });
  });

  it('reads absent fields as unknown', () => {
    expect(readWheelSnapshot({ status: 'WAIT_GAME' })).toEqual(snapshot({ roundId: null }));
  });

  it('rejects an unknown status', () => {
    expect(() => readWheelSnapshot({ status: 'SPINNING' })).toThrow(WheelSnapshotError);
  });

  it('rejects a cell that is no number', () => {
    expect(() => readWheelSnapshot({ status: 'IN_GAME', cellIndex: 'seventeen' })).toThrow(/cellIndex/);
  });

  it('rejects a cell outside the wheel', () => {
    expect(() => readWheelSnapshot({ status: 'IN_GAME', cellIndex: 54 })).toThrow(/cellIndex/);
  });

  it('rejects an unknown winner colour', () => {
    expect(() => readWheelSnapshot({ status: 'FINISH_GAME', winnerColor: 'PINK' })).toThrow(/winnerColor/);
  });
});

describe('applyWheelSnapshot', () => {
  it('counts the phase deadline from now', () => {
    const state = applyWheelSnapshot(null, snapshot({ msToNextPhase: 5000 }), 1000);
    expect(state.deadlineAt).toBe(6000);
  });

  it('keeps the round on a duplicate snapshot', () => {
    const first = applyWheelSnapshot(null, snapshot({ msToNextPhase: 5000 }), 0);
    const duplicate = applyWheelSnapshot(first, snapshot({ msToNextPhase: 4000 }), 1000);
    expect(duplicate.serial).toBe(first.serial);
    expect(duplicate.deadlineAt).toBe(5000);
  });

  it('keeps the winning cell when a later snapshot of the round drops it', () => {
    const spinning = applyWheelSnapshot(null, snapshot({ status: 'IN_GAME', cellIndex: 3, inCellOffset: 0.5 }), 0);
    const finished = applyWheelSnapshot(spinning, snapshot({ status: 'FINISH_GAME', winnerColor: 'BLACK' }), 10);
    expect(finished).toMatchObject({ status: 'FINISH_GAME', cellIndex: 3, inCellOffset: 0.5, winnerColor: 'BLACK' });
    expect(finished.serial).toBe(spinning.serial);
  });

  it('starts a new round on a new round id and forgets the old cell', () => {
    const finished = applyWheelSnapshot(null, snapshot({ status: 'FINISH_GAME', cellIndex: 3 }), 0);
    const next = applyWheelSnapshot(finished, snapshot({ roundId: 'r2', msToNextPhase: 5000 }), 10);
    expect(next.serial).toBe(finished.serial + 1);
    expect(next.cellIndex).toBeNull();
  });

  it('starts a new round on a new betting phase even without round ids', () => {
    const finished = applyWheelSnapshot(null, snapshot({ roundId: null, status: 'FINISH_GAME', cellIndex: 3 }), 0);
    const next = applyWheelSnapshot(finished, snapshot({ roundId: null }), 10);
    expect(next.serial).toBe(finished.serial + 1);
  });

  it('forgets the deadline of a phase that changed without one', () => {
    const waiting = applyWheelSnapshot(null, snapshot({ msToNextPhase: 5000 }), 0);
    expect(applyWheelSnapshot(waiting, snapshot({ status: 'IN_GAME' }), 10).deadlineAt).toBeNull();
  });
});

describe('targetCellOf', () => {
  it('is the winning cell', () => {
    expect(targetCellOf(applyWheelSnapshot(null, snapshot({ status: 'IN_GAME', cellIndex: 9 }), 0))).toBe(9);
  });

  it('is a cell of the winning colour when the cell is unknown', () => {
    expect(targetCellOf(applyWheelSnapshot(null, snapshot({ status: 'FINISH_GAME', winnerColor: 'GREEN' }), 0))).toBe(0);
  });

  it('is unknown before the spin', () => {
    expect(targetCellOf(applyWheelSnapshot(null, snapshot({}), 0))).toBeNull();
  });
});
