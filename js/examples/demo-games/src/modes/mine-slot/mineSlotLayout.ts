/**
 * Where everything sits: the 5 × 3 reel window on top, the 5 × 6 block field under it in the same columns,
 * the chest row under the field. A reel and the field column under it share their x, so a pickaxe falls
 * straight down.
 */
import type { Rect } from '../../kit/paint';
import { FIELD_COLUMNS, FIELD_DEPTH } from './mineSlotField';
import { REEL_ROWS } from './mineSlotRound';

const GAP = 6;
/** A block is as wide as a reel cell and this much of it tall: the field reads as layers of rock. */
const BLOCK_RATIO = 0.56;
const CHEST_RATIO = 0.66;
const MAX_CELL = 104;
/** Heights in cell units, and in gaps, of reels + field + chest row stacked. */
const CELL_UNITS = REEL_ROWS + FIELD_DEPTH * BLOCK_RATIO + CHEST_RATIO;
const REELS_TO_FIELD_GAPS = 2;
const GAP_UNITS = REEL_ROWS + 1 + REELS_TO_FIELD_GAPS + FIELD_DEPTH + 1 + 1;

export interface MineLayout {
  readonly cell: number;
  readonly gap: number;
  readonly blockHeight: number;
  readonly reels: Rect;
  readonly field: Rect;
  readonly chests: Rect;
}

export const layoutOf = (area: Rect): MineLayout => {
  const byWidth = (area.width - GAP * (FIELD_COLUMNS + 1)) / FIELD_COLUMNS;
  const byHeight = (area.height - GAP * GAP_UNITS) / CELL_UNITS;
  const cell = Math.max(24, Math.min(MAX_CELL, byWidth, byHeight));
  const blockHeight = cell * BLOCK_RATIO;
  const width = cell * FIELD_COLUMNS + GAP * (FIELD_COLUMNS + 1);
  const height = cell * CELL_UNITS + GAP * GAP_UNITS;
  const x = area.x + (area.width - width) / 2;
  const top = area.y + Math.max(0, (area.height - height) / 2);
  const reels = { x, y: top, width, height: cell * REEL_ROWS + GAP * (REEL_ROWS + 1) };
  const field = { x, y: reels.y + reels.height + GAP * REELS_TO_FIELD_GAPS, width, height: blockHeight * FIELD_DEPTH + GAP * (FIELD_DEPTH + 1) };
  const chests = { x, y: field.y + field.height + GAP, width, height: cell * CHEST_RATIO };
  return { cell, gap: GAP, blockHeight, reels, field, chests };
};

/** The x of a reel and of the field column under it. */
export const columnCenterX = (layout: MineLayout, column: number): number =>
  layout.reels.x + layout.gap + column * (layout.cell + layout.gap) + layout.cell / 2;

/** The centre of a board cell (`reel * rows + row`). */
export const boardCellCenter = (layout: MineLayout, index: number): { x: number; y: number } => {
  const row = index % REEL_ROWS;
  return {
    x: columnCenterX(layout, Math.floor(index / REEL_ROWS)),
    y: layout.reels.y + layout.gap + row * (layout.cell + layout.gap) + layout.cell / 2,
  };
};

/** A field block (`column * depth + level`). */
export const blockRect = (layout: MineLayout, cell: number): Rect => {
  const column = Math.floor(cell / FIELD_DEPTH);
  const level = cell % FIELD_DEPTH;
  return {
    x: columnCenterX(layout, column) - layout.cell / 2,
    y: layout.field.y + layout.gap + level * (layout.blockHeight + layout.gap),
    width: layout.cell,
    height: layout.blockHeight,
  };
};

export const chestRect = (layout: MineLayout, column: number): Rect => {
  const width = layout.cell * 0.86;
  return { x: columnCenterX(layout, column) - width / 2, y: layout.chests.y, width, height: layout.chests.height };
};
