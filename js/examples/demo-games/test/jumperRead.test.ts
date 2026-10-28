import { describe, expect, it } from 'vitest';
import { JumperReadError, readJumperBonus, readJumperLadders, readJumperMove, readJumperRound } from '../src/modes/jumper/jumperRead';

const STATE = {
  status: 'in-game',
  difficulty: 'EASY',
  coeff: '1.25',
  winAmount: '1.25',
  slots: [{ step: 6, state: 'TRAMPOLINE' }, { step: 9, state: 'HIDDEN' }],
  lineNumber: 6,
  landingStep: 8,
  visitedSteps: [{ step: 6, accelerator: 'TRAMPOLINE' }],
};

describe('readJumperRound', () => {
  it('reads the round as the protocol types it', () => {
    expect(readJumperRound(STATE)).toEqual({
      status: 'in-game',
      difficulty: 'EASY',
      coefficient: 1.25,
      winAmount: '1.25',
      slots: [{ step: 6, state: 'TRAMPOLINE' }, { step: 9, state: 'HIDDEN' }],
      lineNumber: 6,
      landingStep: 8,
      visitedSteps: [{ step: 6, accelerator: 'TRAMPOLINE' }],
      collisionStep: null,
    });
  });

  it('reads steps and coefficients that arrive as strings or numbers', () => {
    const round = readJumperRound({
      ...STATE,
      coeff: 1.5,
      lineNumber: '6',
      landingStep: '8',
      slots: [{ step: '6', state: 'NONE' }],
      visitedSteps: [{ step: '6', accelerator: 'TRAMPOLINE' }],
      collisionPosition: '8',
    });
    expect(round).toMatchObject({ coefficient: 1.5, lineNumber: 6, landingStep: 8, collisionStep: 8 });
    expect(round.slots).toEqual([{ step: 6, state: 'NONE' }]);
    expect(round.visitedSteps).toEqual([{ step: 6, accelerator: 'TRAMPOLINE' }]);
  });

  it('rejects a step that is no number', () => {
    expect(() => readJumperRound({ ...STATE, landingStep: 'eight' })).toThrow(JumperReadError);
  });

  it('rejects an unknown status', () => {
    expect(() => readJumperRound({ ...STATE, status: 'flying' })).toThrow(/status/);
  });
});

describe('readJumperMove', () => {
  it('reads the request the move answers', () => {
    expect(readJumperMove({ ...STATE, move: 'step' }).move).toBe('step');
  });

  it('rejects an unknown request', () => {
    expect(() => readJumperMove({ ...STATE, move: 'bet' })).toThrow(/move/);
  });
});

describe('readJumperLadders', () => {
  it('reads every ladder, coefficients as numbers', () => {
    const ladders = readJumperLadders({
      ladders: [{ difficulty: 'EASY', coefficients: ['1.03', 1.1], accelerators: [], bonusBuyMultiplier: 100 }],
    });
    expect(ladders.get('EASY')).toEqual([1.03, 1.1]);
  });

  it('rejects a coefficient that is no number', () => {
    const config = { ladders: [{ difficulty: 'EASY', coefficients: ['x'], accelerators: [], bonusBuyMultiplier: 1 }] };
    expect(() => readJumperLadders(config)).toThrow(/coefficients/);
  });
});

describe('readJumperBonus', () => {
  it('reads the free games with their routes', () => {
    const bonus = readJumperBonus({
      difficulty: 'MEDIUM',
      betAmount: '1',
      currency: 'USD',
      games: [{ finalStep: '3', coefficient: '1.4', route: [{ step: '0', action: 'TRAMPOLINE' }, { step: 2, action: 'STEP' }] }],
      totalCoefficient: '1.4',
      totalWin: '1.4',
    });
    expect(bonus).toEqual({
      difficulty: 'MEDIUM',
      totalCoefficient: 1.4,
      totalWin: '1.4',
      currency: 'USD',
      games: [{ finalStep: 3, coefficient: 1.4, route: [{ step: 0, action: 'TRAMPOLINE' }, { step: 2, action: 'STEP' }] }],
    });
  });
});
