/**
 * The block field as the round wears it down: what each block is and how much damage it has taken. One field
 * lives through every round of a reply — free spins hit the blocks the base spin cracked.
 */
import { MINE_SLOT_FIELD } from '@omega/webbridge-protocol';
import type { Block } from './mineSlotSymbols';

export const FIELD_COLUMNS = MINE_SLOT_FIELD.columns;
export const FIELD_DEPTH = MINE_SLOT_FIELD.depth;
export const FIELD_CELLS = FIELD_COLUMNS * FIELD_DEPTH;

/** Field cell of a column's level, column-major as the `field` string. */
export const fieldCell = (column: number, level: number): number => column * FIELD_DEPTH + level;

export class MineField {
  private readonly damage: number[];

  public constructor(private readonly blocks: readonly Block[]) {
    this.damage = blocks.map(() => 0);
  }

  public blockAt(cell: number): Block | undefined {
    return this.blocks[cell];
  }

  /** How worn a block is, 0 (whole) to 1 (broken). */
  public wearOf(cell: number): number {
    const block = this.blocks[cell];
    if (block === undefined) return 1;
    return Math.min(1, (this.damage[cell] ?? 0) / block.durability);
  }

  public isBroken(cell: number): boolean {
    return this.wearOf(cell) >= 1;
  }

  /** Deals the damage; returns whether this hit broke the block. */
  public hit(cell: number, damage: number): boolean {
    if (this.isBroken(cell)) return false;
    this.damage[cell] = (this.damage[cell] ?? 0) + damage;
    return this.isBroken(cell);
  }

  /** Every block of the column is gone: its chest is reached. */
  public isBrokenThrough(column: number): boolean {
    for (let level = 0; level < FIELD_DEPTH; level += 1) {
      if (!this.isBroken(fieldCell(column, level))) return false;
    }
    return true;
  }

  /** The column's top block still standing; `null` once it is broken through. */
  public topOf(column: number): number | null {
    for (let level = 0; level < FIELD_DEPTH; level += 1) {
      const cell = fieldCell(column, level);
      if (!this.isBroken(cell)) return cell;
    }
    return null;
  }
}
