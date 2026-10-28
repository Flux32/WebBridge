/** The slot row at the foot of the board: a chip per slot, coloured by how much it pays. */
export type SlotTone = 'faint' | 'accent' | 'hot' | 'spin';

export interface Slot {
  readonly coefficient: number;
  readonly label: string;
  readonly tone: SlotTone;
}

const SPIN_LABEL = 'SPIN';
/** Rank among the line's distinct payouts, 0 the lowest, 1 the highest. */
const ACCENT_FROM_RANK = 0.4;
const HOT_FROM_RANK = 0.8;

/** `1000` → `1K`, `5.6` → `5.6`: the chips are a pitch wide. */
export const formatCoefficient = (coefficient: number): string =>
  coefficient >= 1000 ? `${Number((coefficient / 1000).toFixed(1))}K` : String(Number(coefficient.toFixed(2)));

const toneOfRank = (rank: number): SlotTone => {
  if (rank >= HOT_FROM_RANK) return 'hot';
  return rank >= ACCENT_FROM_RANK ? 'accent' : 'faint';
};

/** `isSpin` picks the slots that start the mode's wheel instead of paying (plinko-aztec's zero slot). */
export const slotLineOf = (
  coefficients: readonly number[],
  isSpin: (coefficient: number) => boolean = () => false,
): readonly Slot[] => {
  const paying = [...new Set(coefficients.filter((coefficient) => !isSpin(coefficient)))].sort((a, b) => a - b);
  const lastRank = paying.length - 1;
  return coefficients.map((coefficient) => {
    if (isSpin(coefficient)) return { coefficient, label: SPIN_LABEL, tone: 'spin' };
    const rank = lastRank === 0 ? 0.5 : paying.indexOf(coefficient) / lastRank;
    return { coefficient, label: formatCoefficient(coefficient), tone: toneOfRank(rank) };
  });
};
