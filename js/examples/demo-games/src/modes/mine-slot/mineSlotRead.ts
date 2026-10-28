/** Readers of the server's play reply as the host forwards it: decimal strings as often as numbers. */
export class MineSlotRoundError extends Error {
  public override readonly name = 'MineSlotRoundError';
}

export const readNumber = (value: unknown, field: string): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new MineSlotRoundError(`${field} is not a number: ${JSON.stringify(value)}`);
  }
  return number;
};

/** `null` only for a field the protocol leaves out on purpose (`coeff` / `payout` of a hit that did not break). */
export const readOptionalNumber = (value: unknown, field: string): number | null =>
  value === undefined || value === null ? null : readNumber(value, field);

/** A whole number in `[0, size)`: a cell of the board or the field, a round, a column. */
export const readIndex = (value: unknown, field: string, size: number): number => {
  const index = readNumber(value, field);
  if (!Number.isInteger(index) || index < 0 || index >= size) {
    throw new MineSlotRoundError(`${field} ${index} is outside 0..${size - 1}`);
  }
  return index;
};

export const readList = (value: unknown, field: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new MineSlotRoundError(`${field} is not a list: ${JSON.stringify(value)}`);
  return value;
};

/** A record of the reply; its fields are read one by one, each with its own reader. */
export const readRecord = (value: unknown, field: string): Readonly<Record<string, unknown>> => {
  if (typeof value !== 'object' || value === null) {
    throw new MineSlotRoundError(`${field} is not an object: ${JSON.stringify(value)}`);
  }
  // A non-null object read field by field through `unknown`: nothing is trusted before its reader runs.
  return value as Readonly<Record<string, unknown>>;
};

/** A fixed-length code string decoded symbol by symbol through `decode`. */
export const readCodes = <T>(value: unknown, field: string, length: number, decode: (code: string) => T | null): T[] => {
  if (typeof value !== 'string' || value.length !== length) {
    throw new MineSlotRoundError(`${field} is not ${length} symbols: ${JSON.stringify(value)}`);
  }
  return [...value].map((code) => {
    const decoded = decode(code);
    if (decoded === null) throw new MineSlotRoundError(`${field} holds unknown symbol "${code}"`);
    return decoded;
  });
};
