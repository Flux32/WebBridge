import { describe, expect, it } from 'vitest';
import { ballPath } from '../src/modes/plinko/ballPath';
import { formatCoefficient, slotLineOf } from '../src/modes/plinko/slotLine';

const stepsOf = (path: readonly number[]): number[] => path.slice(1).map((rights, row) => rights - (path[row] ?? 0));

describe('ballPath', () => {
  it('starts at the top peg and ends in the slot it was given', () => {
    const path = ballPath(8, 6, 42);
    expect(path).toHaveLength(9);
    expect(path[0]).toBe(0);
    expect(path[8]).toBe(6);
  });

  it('moves one peg left or right on every row', () => {
    const steps = stepsOf(ballPath(14, 3, 7));
    expect(steps.every((step) => step === 0 || step === 1)).toBe(true);
    expect(steps.filter((step) => step === 1)).toHaveLength(3);
  });

  it('takes the same zig-zag for the same seed and another for another seed', () => {
    expect(ballPath(12, 5, 11)).toEqual(ballPath(12, 5, 11));
    const others = [12, 13, 14, 15].map((seed) => ballPath(12, 5, seed).join());
    expect(others.some((path) => path !== ballPath(12, 5, 11).join())).toBe(true);
  });

  it('reaches both edge slots', () => {
    expect(ballPath(8, 0, 1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(ballPath(8, 8, 1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('refuses a slot the board does not have', () => {
    expect(() => ballPath(8, 9, 1)).toThrow(RangeError);
    expect(() => ballPath(8, -1, 1)).toThrow(RangeError);
  });
});

describe('slotLineOf', () => {
  it('colours the slots from faint to accent to hot by value', () => {
    const line = slotLineOf([5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6]);
    expect(line.map((slot) => slot.tone)).toEqual([
      'hot', 'accent', 'accent', 'faint', 'faint', 'faint', 'accent', 'accent', 'hot',
    ]);
  });

  it('marks the slots the mode reads as the wheel slot', () => {
    const line = slotLineOf([2, 0, 2], (coefficient) => coefficient === 0);
    expect(line[1]).toEqual({ coefficient: 0, label: 'SPIN', tone: 'spin' });
  });

  it('gives a flat line one tone', () => {
    expect(slotLineOf([2, 2]).map((slot) => slot.tone)).toEqual(['accent', 'accent']);
  });
});

describe('formatCoefficient', () => {
  it('keeps chips short', () => {
    expect([1000, 130, 5.6, 0.2, 13, 1.125].map(formatCoefficient)).toEqual(['1K', '130', '5.6', '0.2', '13', '1.13']);
  });
});
