/**
 * The twist sector table. The backend has no game config for it: the shell and the live game keep the same
 * values (RoadFrontent `modes/twist/twistCoefficients.ts`). Each sector has one more cell than coefficients:
 * the last cell is the bonus, and a sector filled to it is worth its last coefficient.
 */
export type TwistSector = 'fire' | 'earth' | 'water';

export type TwistProgress = Readonly<Record<TwistSector, number>>;

export const TWIST_SECTORS: readonly TwistSector[] = ['fire', 'earth', 'water'];

export const SECTOR_COEFFICIENTS: Readonly<Record<TwistSector, readonly number[]>> = {
  fire: [3.9, 12.5, 28, 52, 85, 133, 200],
  earth: [2.5, 7.7, 16, 27.5, 44],
  water: [1.55, 4.85, 10],
};

export const EMPTY_PROGRESS: TwistProgress = Object.freeze({ fire: 0, earth: 0, water: 0 });

export const sectorCellCount = (sector: TwistSector): number => SECTOR_COEFFICIENTS[sector].length + 1;

const sectorCoefficient = (sector: TwistSector, filled: number): number => {
  const row = SECTOR_COEFFICIENTS[sector];
  if (filled <= 0) return 0;
  return row[Math.min(filled, row.length) - 1] ?? 0;
};

/** What the whole board pays on a full cash out: the sum over the sectors. */
export const progressCoefficient = (progress: TwistProgress): number =>
  TWIST_SECTORS.reduce((sum, sector) => sum + sectorCoefficient(sector, progress[sector]), 0);
