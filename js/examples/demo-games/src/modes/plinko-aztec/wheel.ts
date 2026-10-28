/**
 * The fortune wheel a spin ball starts. The server sends only where it stops (`freeSpinResult.position`:
 * `"bonus"` or the multiplier), not the wheel itself, so the demo draws a wheel of its own and makes sure
 * the sector it stops on is there.
 */
import { formatCoefficient } from '../plinko/slotLine';
import { PlinkoPayloadError } from '../plinko/payload';

export interface WheelSpin {
  readonly sectors: readonly string[];
  readonly target: number;
  readonly isBonus: boolean;
}

const BONUS_POSITION = 'bonus';
const BONUS_SECTOR = 'BONUS';
const SECTORS: readonly string[] = ['x2', 'x3', BONUS_SECTOR, 'x1.5', 'x5', 'x2', 'x10', BONUS_SECTOR];
const FULL_TURN = Math.PI * 2;

const multiplierLabelOf = (position: string): string => {
  const multiplier = Number(position);
  if (position.trim() === '' || !Number.isFinite(multiplier)) {
    throw new PlinkoPayloadError(`freeSpinResult.position "${position}" is neither bonus nor a multiplier`);
  }
  return `x${formatCoefficient(multiplier)}`;
};

export const wheelSpinOf = (position: string): WheelSpin => {
  const label = position === BONUS_POSITION ? BONUS_SECTOR : multiplierLabelOf(position);
  const target = SECTORS.indexOf(label);
  if (target >= 0) return { sectors: SECTORS, target, isBonus: label === BONUS_SECTOR };
  return { sectors: [label, ...SECTORS.slice(1)], target: 0, isBonus: false };
};

/**
 * The wheel's final rotation: `turns` whole turns, then the target sector's middle under the pointer.
 * Sector `i` spans `[i, i + 1)` sector widths clockwise from the pointer at rotation zero.
 */
export const wheelAngleOf = (target: number, sectorCount: number, turns: number): number => {
  const sector = FULL_TURN / sectorCount;
  return turns * FULL_TURN - (target + 0.5) * sector;
};
