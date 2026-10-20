/**
 * Decimal-string arithmetic for the jumper mock. Amounts and coefficients are
 * held as integers of their smallest unit, so `1.01 × 3` is `3.03`, not
 * `3.0300000000000002`.
 */

/** The server's money format: digits with an optional fraction — no sign, exponent or separators. */
const PLAIN_DECIMAL = /^(\d+)(?:\.(\d+))?$/;

interface ScaledDecimal {
  readonly units: number;
  /** How many of `units`' last digits are the fraction. */
  readonly scale: number;
}

const assertSafe = (units: number, context: string): number => {
  if (!Number.isSafeInteger(units)) throw new RangeError(`Jumper mock: ${context} exceeds the safe integer range`);
  return units;
};

const toScaled = (value: string): ScaledDecimal => {
  const match = PLAIN_DECIMAL.exec(value);
  if (match === null) throw new RangeError(`Jumper mock: "${value}" is not a plain decimal`);

  const [, integerDigits = '', fractionDigits = ''] = match;
  return { units: assertSafe(Number(integerDigits + fractionDigits), value), scale: fractionDigits.length };
};

const formatUnits = (units: number, scale: number): string => {
  const digits = String(units).padStart(scale + 1, '0');
  if (scale === 0) return digits;

  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
};

/** `amount × coefficient`, rounded half up to `decimalPlaces`. */
export const multiplyAmount = (amount: string, coefficient: string, decimalPlaces: number): string => {
  const left = toScaled(amount);
  const right = toScaled(coefficient);
  const product = assertSafe(left.units * right.units, `${amount} × ${coefficient}`);
  const excessDigits = left.scale + right.scale - decimalPlaces;
  const units = excessDigits >= 0 ? Math.round(product / 10 ** excessDigits) : product * 10 ** -excessDigits;
  return formatUnits(units, decimalPlaces);
};

/** The exact sum, at the finest scale among the values. */
export const sumDecimals = (values: readonly string[]): string => {
  const scaled = values.map(toScaled);
  const scale = Math.max(0, ...scaled.map((value) => value.scale));
  const units = scaled.reduce((total, value) => total + value.units * 10 ** (scale - value.scale), 0);
  return formatUnits(assertSafe(units, `the sum of ${values.join(' + ')}`), scale);
};
