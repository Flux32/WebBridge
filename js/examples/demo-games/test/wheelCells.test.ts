import { describe, expect, it } from 'vitest';
import {
  CELL_ANGLE,
  CELL_COUNT,
  cellAtPointer,
  firstCellOf,
  landingRotation,
  spinTarget,
  WHEEL_CELLS,
  WHEEL_MULTIPLIERS,
} from '../src/modes/wheel/wheelCells';

const TURN = Math.PI * 2;
const countOf = (color: string): number => WHEEL_CELLS.filter((cell) => cell === color).length;

describe('wheel cells', () => {
  it('has 54 cells starting GREEN, BLUE, RED, BLACK', () => {
    expect(CELL_COUNT).toBe(54);
    expect(WHEEL_CELLS.slice(0, 4)).toEqual(['GREEN', 'BLUE', 'RED', 'BLACK']);
  });

  it('holds one GREEN, 10 BLUE, 17 RED and 26 BLACK cells', () => {
    expect([countOf('GREEN'), countOf('BLUE'), countOf('RED'), countOf('BLACK')]).toEqual([1, 10, 17, 26]);
  });

  it('pays BLACK x2, RED x3, BLUE x5, GREEN x50', () => {
    expect(WHEEL_MULTIPLIERS).toEqual({ BLACK: 2, RED: 3, BLUE: 5, GREEN: 50 });
  });

  it('puts the winning cell under the pointer for any offset inside it', () => {
    for (const cellIndex of [0, 1, 17, 53]) {
      for (const offset of [0, 0.42, 0.99]) expect(cellAtPointer(landingRotation(cellIndex, offset))).toBe(cellIndex);
    }
  });

  it('moves the stop point by the in-cell offset', () => {
    const difference = landingRotation(10, 0.25) - landingRotation(10, 0.75);
    expect(difference).toBeCloseTo(CELL_ANGLE / 2);
  });

  it('spins forward by at least the asked turns and lands on the cell', () => {
    const from = 1.2;
    const landing = landingRotation(17, 0.5);
    const target = spinTarget(from, landing, 3);
    expect(target).toBeGreaterThanOrEqual(from + 3 * TURN);
    expect(target).toBeLessThan(from + 4 * TURN);
    expect(cellAtPointer(target)).toBe(17);
  });

  it('finds a cell of a colour', () => {
    expect(WHEEL_CELLS[firstCellOf('BLUE')]).toBe('BLUE');
    expect(firstCellOf('GREEN')).toBe(0);
  });
});
