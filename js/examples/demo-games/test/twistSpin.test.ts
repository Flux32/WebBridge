import { describe, expect, it } from 'vitest';
import { boardAfter, readSeriesTotal, readTwistBonusRound, readTwistSpin, readTwistState, totemsOf, TwistStateError } from '../src/modes/twist/twistSpin';
import { EMPTY_PROGRESS, progressCoefficient, sectorCellCount } from '../src/modes/twist/twistTable';

const SPIN = {
  outcome: 'fire',
  progress: { fire: 2, earth: 1, water: 0 },
  sessionIsFinished: false,
  coeff: '15',
  bonus: { hasBonus: false },
};

describe('twist table', () => {
  it('gives every sector one bonus cell past its coefficients', () => {
    expect([sectorCellCount('fire'), sectorCellCount('earth'), sectorCellCount('water')]).toEqual([8, 6, 4]);
  });

  it('sums the coefficient each sector has reached', () => {
    expect(progressCoefficient({ fire: 2, earth: 1, water: 0 })).toBe(15);
  });

  it('values a sector filled to its bonus cell by its last coefficient', () => {
    expect(progressCoefficient({ fire: 8, earth: 0, water: 4 })).toBe(210);
  });

  it('is zero on an empty board', () => {
    expect(progressCoefficient(EMPTY_PROGRESS)).toBe(0);
  });
});

describe('totemsOf', () => {
  it('lands a triple of the sector the spin hit', () => {
    expect(totemsOf('earth')).toEqual(['earth', 'earth', 'earth']);
  });

  it('lands three skulls on death', () => {
    expect(totemsOf('death')).toEqual(['death', 'death', 'death']);
  });

  it('never lands a triple or a skull on air', () => {
    for (const roll of [0, 0.2, 0.5, 0.8, 0.99]) {
      const totems = totemsOf('air', () => roll);
      expect(new Set(totems).size).toBeGreaterThan(1);
      expect(totems).not.toContain('death');
    }
  });
});

describe('readTwistSpin', () => {
  it('reads the raw play reply', () => {
    expect(readTwistSpin(SPIN)).toEqual({
      outcome: 'fire',
      progress: { fire: 2, earth: 1, water: 0 },
      isSessionFinished: false,
      hasBonus: false,
    });
  });

  it('reads progress the server sends as strings', () => {
    const spin = readTwistSpin({ ...SPIN, progress: { fire: '2', earth: '1', water: '0' } });
    expect(spin.progress).toEqual({ fire: 2, earth: 1, water: 0 });
  });

  it('flags a filled sector bonus', () => {
    expect(readTwistSpin({ ...SPIN, bonus: { hasBonus: true, coeff: '200' } }).hasBonus).toBe(true);
  });

  it('rejects an outcome it does not know', () => {
    expect(() => readTwistSpin({ ...SPIN, outcome: 'lava' })).toThrow(TwistStateError);
  });

  it('rejects progress that is not a number', () => {
    expect(() => readTwistSpin({ ...SPIN, progress: { fire: 'x', earth: 0, water: 0 } })).toThrow(TwistStateError);
  });

  it('rejects progress past the end of a sector', () => {
    expect(() => readTwistSpin({ ...SPIN, progress: { fire: 0, earth: 0, water: 5 } })).toThrow(TwistStateError);
  });

  it('rejects a reply that is not an object', () => {
    expect(() => readTwistSpin('fire')).toThrow(TwistStateError);
  });
});

describe('boardAfter', () => {
  it('keeps the progress of a live session', () => {
    expect(boardAfter(readTwistSpin(SPIN))).toEqual({ fire: 2, earth: 1, water: 0 });
  });

  it('empties the board once the session is over', () => {
    expect(boardAfter(readTwistSpin({ ...SPIN, outcome: 'death', sessionIsFinished: true }))).toEqual(EMPTY_PROGRESS);
  });
});

describe('readTwistBonusRound', () => {
  it('reads a free spin of a bought series', () => {
    const round = readTwistBonusRound({ outcome: 'water', progress: { fire: 0, earth: 0, water: 1 }, autoWinCoeff: '0' });
    expect(round.outcome).toBe('water');
    expect(round.progress.water).toBe(1);
  });

  it('rejects a death inside a bought series', () => {
    expect(() => readTwistBonusRound({ outcome: 'death', progress: EMPTY_PROGRESS })).toThrow(TwistStateError);
  });
});

describe('readTwistState', () => {
  it('restores the board of a live session', () => {
    expect(readTwistState({ status: 'in-game', sessionIsFinished: false, progress: { fire: 1, earth: 0, water: 2 } }))
      .toEqual({ fire: 1, earth: 0, water: 2 });
  });

  it('reads an idle player without a session as an empty board', () => {
    expect(readTwistState({ status: 'none' })).toEqual(EMPTY_PROGRESS);
  });

  it('empties the board of a closed session', () => {
    expect(readTwistState({ sessionIsFinished: true, progress: { fire: 3, earth: 0, water: 0 } })).toEqual(EMPTY_PROGRESS);
  });
});

describe('readSeriesTotal', () => {
  it('reads a free spins count sent as a string', () => {
    expect(readSeriesTotal('12', 10)).toBe(12);
  });

  it('never counts fewer free spins than were sent', () => {
    expect(readSeriesTotal(3, 5)).toBe(5);
  });

  it('rejects a count that is not a number', () => {
    expect(() => readSeriesTotal('many', 5)).toThrow(TwistStateError);
  });
});
