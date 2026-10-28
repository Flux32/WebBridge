import { describe, expect, it } from 'vitest';
import { aztecLineOf, readAztecDrop, readBonus, slotIndexOf } from '../src/modes/plinko-aztec/aztecRound';
import { aztecReadout, type AztecViewModel } from '../src/modes/plinko-aztec/aztecReadout';
import { wheelAngleOf, wheelSpinOf } from '../src/modes/plinko-aztec/wheel';
import { PlinkoPayloadError } from '../src/modes/plinko/payload';

const COEFFICIENTS = [1000, 130, 26, 9, 4, 2, 0.2, 0, 0.2, 2, 4, 9, 26, 130, 1000];
const CONFIG = { positions: COEFFICIENTS.map((coefficient) => ({ coefficient, probability: 1 / 15 })) };
const LINE = aztecLineOf(CONFIG);
const BONUS = { gameNumber: 1, level: 2, progress: 0, ballPerDrop: 3, ballsAmount: 4, freeSpinProgress: 0, winAmount: '6.00' };

const stateOf = (extra: object = {}) => ({
  currency: 'USD',
  winAmount: '9.40',
  ballsResult: [
    { position: '4', coeff: '4', bonusBumpAmount: 0 },
    { position: 'spin', coeff: '0', bonusBumpAmount: 1 },
    { position: '1000', coeff: '1000', bonusBumpAmount: 0 },
    { position: '1000', coeff: '1000', bonusBumpAmount: 0 },
  ],
  bonusGameState: { progress: {} },
  ...extra,
});

describe('aztecLineOf', () => {
  it('reads the slot line from the config positions, the zero slot as the wheel slot', () => {
    expect(LINE).toHaveLength(15);
    expect(LINE[7]).toMatchObject({ coefficient: 0, label: 'SPIN', tone: 'spin' });
    expect(LINE[0]).toMatchObject({ label: '1K', tone: 'hot' });
  });

  it('reads coefficients that arrive as decimal strings', () => {
    expect(aztecLineOf({ positions: [{ coefficient: '2.5' }, { coefficient: '0' }] }).map((slot) => slot.label)).toEqual([
      '2.5', 'SPIN',
    ]);
  });

  it('refuses a config without positions', () => {
    expect(() => aztecLineOf({ betConfig: {} })).toThrow(PlinkoPayloadError);
  });
});

describe('slotIndexOf', () => {
  it('finds the slot of a ball by its coefficient and spreads twin slots over both sides', () => {
    expect(slotIndexOf(LINE, '4', 0)).toBe(4);
    expect(slotIndexOf(LINE, '1000', 0)).toBe(0);
    expect(slotIndexOf(LINE, '1000', 1)).toBe(14);
    expect(slotIndexOf(LINE, '0.20', 0)).toBe(6);
  });

  it('puts a spin ball into the wheel slot', () => {
    expect(slotIndexOf(LINE, 'spin', 3)).toBe(7);
  });

  it('refuses a position the line does not have', () => {
    expect(() => slotIndexOf(LINE, '77', 0)).toThrow(PlinkoPayloadError);
  });
});

describe('readAztecDrop', () => {
  it('reads every ball, the win and no wheel or bonus for a plain drop', () => {
    expect(readAztecDrop(stateOf(), LINE)).toEqual({
      slots: [4, 7, 0, 14], winAmount: '9.40', freeSpin: null, bonus: null,
    });
  });

  it('reads the wheel spin and the bonus game the drop started', () => {
    const drop = readAztecDrop(
      stateOf({ freeSpinResult: { position: 'bonus', coeff: '0', winAmount: '0' }, bonusGameState: { progress: {}, result: BONUS } }),
      LINE,
    );
    expect(drop.freeSpin).toBe('bonus');
    expect(drop.bonus).toEqual({ level: 2, dropsLeft: 4, ballsPerDrop: 3, winAmount: '6.00' });
  });

  it('reads bonus counters that arrive as strings', () => {
    expect(readBonus({ bonusGameState: { result: { ...BONUS, level: '3', ballsAmount: '2', ballPerDrop: '4' } } })).toEqual({
      level: 3, dropsLeft: 2, ballsPerDrop: 4, winAmount: '6.00',
    });
  });

  it('reads no bonus from a state without one', () => {
    expect(readBonus({ status: 'none' })).toBeNull();
  });

  it('refuses a drop without balls', () => {
    expect(() => readAztecDrop({ winAmount: '0', currency: 'USD' }, LINE)).toThrow(PlinkoPayloadError);
  });
});

describe('wheelSpinOf', () => {
  it('stops on a bonus sector for the bonus game', () => {
    const spin = wheelSpinOf('bonus');
    expect(spin.sectors[spin.target]).toBe('BONUS');
    expect(spin.isBonus).toBe(true);
  });

  it('stops on the multiplier the server chose, adding it when the wheel lacks it', () => {
    const two = wheelSpinOf('2');
    expect(two.sectors[two.target]).toBe('x2');
    const seven = wheelSpinOf('7.0');
    expect(seven.sectors[seven.target]).toBe('x7');
    expect(seven.isBonus).toBe(false);
  });

  it('refuses a position that is neither bonus nor a number', () => {
    expect(() => wheelSpinOf('jackpot')).toThrow(PlinkoPayloadError);
  });

  it('turns the target sector under the pointer after whole turns', () => {
    const angle = wheelAngleOf(3, 8, 4);
    const sector = (Math.PI * 2) / 8;
    const underPointer = (((angle + 3.5 * sector) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    expect(Math.min(underPointer, Math.PI * 2 - underPointer)).toBeCloseTo(0);
    expect(angle).toBeGreaterThan(Math.PI * 2 * 3);
  });
});

const VIEW: AztecViewModel = {
  phase: 'idle',
  selection: { ballsAmount: 10, betPerBall: '1' },
  currency: 'USD',
  lastDrop: null,
  bonus: null,
  ballsInPlay: 0,
  error: null,
};

describe('aztecReadout', () => {
  it('shows the bet bar selection before the first drop', () => {
    expect(aztecReadout(VIEW)).toEqual({ label: 'BALLS × BET PER BALL', value: '10 × 1 USD', caption: 'Tap to drop' });
  });

  it('waits for the bet bar until it reports its selection', () => {
    expect(aztecReadout({ ...VIEW, selection: { ballsAmount: 0, betPerBall: null } })).toMatchObject({
      value: '—', caption: 'Waiting for the bet bar',
    });
  });

  it('shows the total win of the landed drop with the selection under it', () => {
    const lastDrop = { slots: [1], winAmount: '9.40', freeSpin: null, bonus: null };
    expect(aztecReadout({ ...VIEW, lastDrop })).toEqual({
      label: 'TOTAL WIN', value: '9.40 USD', caption: '10 balls × 1 USD · tap to drop',
    });
  });

  it('counts the balls in play while they fall', () => {
    expect(aztecReadout({ ...VIEW, phase: 'dropping', ballsInPlay: 20 })).toEqual({
      label: 'BALLS IN PLAY', value: '20', caption: 'Dropping…',
    });
  });

  it('invites the next bonus drop with its level and drops left', () => {
    const bonus = { level: 2, dropsLeft: 4, ballsPerDrop: 3, winAmount: '6.00' };
    expect(aztecReadout({ ...VIEW, phase: 'bonus', bonus })).toEqual({
      label: 'BONUS GAME · LEVEL 2', value: '6.00 USD', caption: '4 drops left · tap to drop 3 balls',
    });
  });
});
