/**
 * Where everything sits: the three pots in a row under the readout, the board under them — the 5 × 3 reels,
 * or the Hold & Win board of 3 to 5 rows, which takes the cell size its rows allow.
 */
import { DRAGON_POTS_POT_COLORS, type DragonPotsPotColor } from '@omega/webbridge-protocol';
import type { Rect } from '../../kit/paint';

const GAP = 6;
const MAX_CELL = 96;
const MIN_CELL = 26;
const POTS_HEIGHT = 66;
const POTS_GAP = 12;
const COLUMNS = 5;

export interface DragonLayout {
  readonly cell: number;
  readonly gap: number;
  readonly rows: number;
  readonly pots: Readonly<Record<DragonPotsPotColor, Rect>>;
  readonly board: Rect;
}

export const layoutOf = (area: Rect, rows: number): DragonLayout => {
  const byWidth = (area.width - GAP * (COLUMNS + 1)) / COLUMNS;
  const byHeight = (area.height - POTS_HEIGHT - POTS_GAP - GAP * (rows + 1)) / rows;
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, byWidth, byHeight));
  const width = cell * COLUMNS + GAP * (COLUMNS + 1);
  const x = area.x + (area.width - width) / 2;
  const potWidth = (width - POTS_GAP * 2) / DRAGON_POTS_POT_COLORS.length;
  const pots = Object.fromEntries(
    DRAGON_POTS_POT_COLORS.map((color, index) => [color, { x: x + index * (potWidth + POTS_GAP), y: area.y, width: potWidth, height: POTS_HEIGHT }]),
  ) as Record<DragonPotsPotColor, Rect>; // Built from the full colour list: every colour has its rect.
  const board = { x, y: area.y + POTS_HEIGHT + POTS_GAP, width, height: cell * rows + GAP * (rows + 1) };
  return { cell, gap: GAP, rows, pots, board };
};

/** The centre of a cell; `index` is column-major on the reels (`reel * rows + row`). */
export const reelCellCenter = (layout: DragonLayout, index: number): { x: number; y: number } =>
  gridCenter(layout, Math.floor(index / layout.rows), index % layout.rows);

/** The centre of a Hold & Win cell, `row * columns + column`. */
export const boardCellCenter = (layout: DragonLayout, index: number): { x: number; y: number } =>
  gridCenter(layout, index % COLUMNS, Math.floor(index / COLUMNS));

const gridCenter = (layout: DragonLayout, column: number, row: number): { x: number; y: number } => {
  const pitch = layout.cell + layout.gap;
  return { x: layout.board.x + layout.gap + column * pitch + layout.cell / 2, y: layout.board.y + layout.gap + row * pitch + layout.cell / 2 };
};

export const cellRectAt = (layout: DragonLayout, center: { x: number; y: number }): Rect => ({
  x: center.x - layout.cell / 2,
  y: center.y - layout.cell / 2,
  width: layout.cell,
  height: layout.cell,
});

export const potCenter = (layout: DragonLayout, color: DragonPotsPotColor): { x: number; y: number } => {
  const pot = layout.pots[color];
  return { x: pot.x + pot.width / 2, y: pot.y + pot.height / 2 };
};
