/** Random draws and money strings of the dragon-pots mock: every draw comes from the injected source. */

export type RandomSource = () => number;

/** An integer within `min..max`, both ends included. */
export const drawInt = (min: number, max: number, random: RandomSource): number => min + Math.floor(random() * (max - min + 1));

export const drawWeighted = <T>(entries: readonly (readonly [T, number])[], random: RandomSource): T => {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let remaining = random() * total;
  for (const [value, weight] of entries) {
    remaining -= weight;
    if (remaining < 0) return value;
  }
  // `random()` below 1 always lands inside; this is the last entry for a rounding edge.
  return entries[entries.length - 1]![0];
};

/** A new array in random order (Fisher–Yates). */
export const shuffled = <T>(items: readonly T[], random: RandomSource): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
};

/** An unrounded amount as the server writes it ("4.765", "0.025", "2"): float noise cut, no padding. */
export const decimal = (value: number): string => String(Number(value.toFixed(10)));

/**
 * The top-level `winAmount` from the round's coefficient and the play's amount, rounded down to cents. The
 * server's own rule is not known; this one — the coefficient cut to four decimals first — reproduces every
 * recorded reply, the bought ones that show a cent less than their Hold & Win included (2.90 of 2.91).
 */
export const topWinAmount = (coeff: number, amount: number): string => {
  const cutCoeff = Math.trunc(coeff * 10_000) / 10_000;
  return (Math.floor(cutCoeff * amount * 100) / 100).toFixed(2);
};
