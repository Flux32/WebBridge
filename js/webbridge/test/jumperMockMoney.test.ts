import { describe, expect, it } from 'vitest';
import { multiplyAmount, sumDecimals } from '../src/jumper/jumperMockMoney';

describe('jumper mock money', () => {
  it('multiplies without float noise and rounds half up', () => {
    expect(multiplyAmount('3', '1.01', 2)).toBe('3.03');
    expect(multiplyAmount('0.10', '1.15', 2)).toBe('0.12');
    expect(multiplyAmount('100.00', '192271.88', 2)).toBe('19227188.00');
  });

  it('pads amounts below one', () => {
    expect(multiplyAmount('0.01', '1.04', 2)).toBe('0.01');
    expect(multiplyAmount('0.05', '1', 4)).toBe('0.0500');
  });

  it('adds coefficients exactly', () => {
    expect(sumDecimals(['0.1', '0.2'])).toBe('0.3');
    expect(sumDecimals(['1.04', '2.7', '10'])).toBe('13.74');
  });

  it('refuses what is not a plain decimal', () => {
    expect(() => multiplyAmount('1e3', '1.01', 2)).toThrow(RangeError);
    expect(() => sumDecimals(['-1'])).toThrow(RangeError);
  });
});
