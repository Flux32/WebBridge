/**
 * The zig-zag a ball takes down the peg board to the slot the server chose. The board only decides the look:
 * a slot `k` of a board with `rows` peg rows is reached by exactly `k` bounces to the right, in an order
 * shuffled by the seed, so every ball of a round takes its own path and a test gets the same one twice.
 */

/** A small deterministic generator (mulberry32): the same seed, the same path. */
const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffled = (bounces: number[], random: () => number): number[] => {
  for (let index = bounces.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [bounces[index], bounces[other]] = [bounces[other] ?? 0, bounces[index] ?? 0];
  }
  return bounces;
};

/**
 * How many pegs to the right of the top peg the ball is after each row: `rows + 1` entries, from `0` at the
 * top peg to `slot` in the slot row. Throws `RangeError` for a slot the board does not have.
 */
export const ballPath = (rows: number, slot: number, seed: number): readonly number[] => {
  if (!Number.isInteger(slot) || slot < 0 || slot > rows) {
    throw new RangeError(`[plinko] slot ${slot} is not on a board of ${rows} rows`);
  }
  const bounces = shuffled(
    Array.from({ length: rows }, (_, row) => (row < slot ? 1 : 0)),
    seededRandom(seed),
  );
  const path = [0];
  bounces.forEach((bounce, row) => path.push((path[row] ?? 0) + bounce));
  return path;
};
