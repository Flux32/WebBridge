import { describe, expect, it } from 'vitest';
import { PlinkoPayloadError } from '../src/modes/plinko/payload';
import { outcomeOf, PlinkoRound } from '../src/modes/plinko/plinkoRound';
import { plinkoReadout } from '../src/modes/plinko/plinkoReadout';

const CONFIG = {
  currency: 'USD',
  coefficients: {
    LOW: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    MEDIUM: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    HIGH: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
};

const DROP = { status: 'win', coeff: 4, resultPosition: 7, risk: 'HIGH', winAmount: '4.00', currency: 'USD' };

const configured = (): PlinkoRound => {
  const round = new PlinkoRound();
  round.setConfig(CONFIG);
  return round;
};

describe('PlinkoRound', () => {
  it('has no board before the config', () => {
    expect(new PlinkoRound().slots).toEqual([]);
  });

  it('shows the LOW line until a drop names its risk', () => {
    expect(configured().slots.map((slot) => slot.coefficient)).toEqual(CONFIG.coefficients.LOW);
  });

  it('reads the slot, coefficient and win of a drop and switches to its risk line', () => {
    const round = configured();
    expect(round.readDrop(DROP)).toEqual({ slot: 7, coefficient: 4, risk: 'HIGH', winAmount: '4.00', currency: 'USD' });
    expect(round.slots.map((slot) => slot.coefficient)).toEqual(CONFIG.coefficients.HIGH);
  });

  it('refuses a drop into a slot the line does not have', () => {
    expect(() => configured().readDrop({ ...DROP, resultPosition: 9 })).toThrow(PlinkoPayloadError);
  });

  it('refuses a drop without a result position', () => {
    expect(() => configured().readDrop({ ...DROP, resultPosition: undefined })).toThrow(PlinkoPayloadError);
  });

  it('reads server numbers that arrive as decimal strings', () => {
    const round = new PlinkoRound();
    round.setConfig({ coefficients: { LOW: ['5.6', '1', '5.6'], MEDIUM: ['3', '1', '3'], HIGH: ['9', '0.2', '9'] } });
    expect(round.readDrop({ ...DROP, coeff: '0.2', resultPosition: '1' })).toMatchObject({ slot: 1, coefficient: 0.2 });
    expect(round.slots.map((slot) => slot.coefficient)).toEqual([9, 0.2, 9]);
  });

  it('refuses a number that is not one', () => {
    expect(() => configured().readDrop({ ...DROP, coeff: 'abc' })).toThrow(PlinkoPayloadError);
    expect(() => new PlinkoRound().setConfig({ coefficients: { LOW: ['1', 'NaN'], MEDIUM: [], HIGH: [] } })).toThrow(
      PlinkoPayloadError,
    );
  });

  it('refuses a config without the risk lines', () => {
    expect(() => new PlinkoRound().setConfig({ currency: 'USD' })).toThrow(PlinkoPayloadError);
  });
});

describe('outcomeOf', () => {
  it('reads a coefficient above one as a win and below one as a loss', () => {
    expect([5.6, 1, 0.3].map(outcomeOf)).toEqual(['win', 'even', 'loss']);
  });
});

describe('plinkoReadout', () => {
  it('invites a drop before the first one', () => {
    expect(plinkoReadout({ phase: 'idle', lastDrop: null, error: null })).toEqual({
      label: 'MULTIPLIER', value: 'x0.00', caption: 'Tap to drop',
    });
  });

  it('shows the landed multiplier and the win once the ball has landed', () => {
    const lastDrop = { slot: 7, coefficient: 4, risk: 'HIGH' as const, winAmount: '4.00', currency: 'USD' };
    expect(plinkoReadout({ phase: 'idle', lastDrop, error: null })).toEqual({
      label: 'MULTIPLIER', value: 'x4.00', caption: 'Won 4.00 USD · HIGH risk · tap to drop',
    });
  });

  it('keeps the multiplier hidden while the ball falls', () => {
    expect(plinkoReadout({ phase: 'dropping', lastDrop: null, error: null }).caption).toBe('Dropping…');
  });

  it('shows a broken payload instead of the result', () => {
    expect(plinkoReadout({ phase: 'idle', lastDrop: null, error: 'resultPosition missing' }).caption).toBe(
      'Broken drop: resultPosition missing',
    );
  });
});
