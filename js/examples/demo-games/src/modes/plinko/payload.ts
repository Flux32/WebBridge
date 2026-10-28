/**
 * Reading the backend's raw JSON the bridge hands over as `unknown`. The host forwards server numbers as
 * they came, and they often arrive as decimal strings (`"1.03"`) where the protocol says number, so every
 * number is read from either form; anything else is refused here, before it reaches a frame.
 */
export class PlinkoPayloadError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'PlinkoPayloadError';
  }
}

export type PayloadRecord = Readonly<Record<string, unknown>>;

export const readRecord = (value: unknown, what: string): PayloadRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PlinkoPayloadError(`${what} is not an object`);
  }
  return value as PayloadRecord;
};

export const toNumber = (value: unknown, what: string): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new PlinkoPayloadError(`${what} is not a number: ${JSON.stringify(value)}`);
  }
  return number;
};

export const readNumber = (record: PayloadRecord, key: string): number => toNumber(record[key], key);

export const readNumbers = (value: unknown, what: string): readonly number[] => {
  if (!Array.isArray(value)) throw new PlinkoPayloadError(`${what} is not a list`);
  return value.map((item, index) => toNumber(item, `${what}[${index}]`));
};

/** Money stays the backend's string: the demo shows it, it never adds it up. */
export const readText = (record: PayloadRecord, key: string): string => {
  const value = record[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new PlinkoPayloadError(`${key} is not text: ${JSON.stringify(value)}`);
};
