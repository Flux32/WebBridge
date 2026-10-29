/** Readers of the server's replies as the host forwards them: decimal strings as often as numbers. */
export class FruitLoveFeverRoundError extends Error {
  public override readonly name = 'FruitLoveFeverRoundError';
}

export const readNumber = (value: unknown, field: string): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new FruitLoveFeverRoundError(`${field} is not a number: ${JSON.stringify(value)}`);
  }
  return number;
};

/** A whole number in `[min, max]`: a row, a reel, a line, a free spin. */
export const readWhole = (value: unknown, field: string, min: number, max: number): number => {
  const whole = readNumber(value, field);
  if (!Number.isInteger(whole) || whole < min || whole > max) {
    throw new FruitLoveFeverRoundError(`${field} ${whole} is outside ${min}..${max}`);
  }
  return whole;
};

export const readList = (value: unknown, field: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new FruitLoveFeverRoundError(`${field} is not a list: ${JSON.stringify(value)}`);
  return value;
};

export const readBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') throw new FruitLoveFeverRoundError(`${field} is not a boolean: ${JSON.stringify(value)}`);
  return value;
};

export const readText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value === '') throw new FruitLoveFeverRoundError(`${field} is not a string: ${JSON.stringify(value)}`);
  return value;
};

/** A record of the reply; its fields are read one by one, each with its own reader. */
export const readRecord = (value: unknown, field: string): Readonly<Record<string, unknown>> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FruitLoveFeverRoundError(`${field} is not an object: ${JSON.stringify(value)}`);
  }
  // A non-null object read field by field through `unknown`: nothing is trusted before its reader runs.
  return value as Readonly<Record<string, unknown>>;
};
