/** Where the reels sit: a 5 × 3 window under the readout, the free-spin counter in a strip above it. */
import type { Rect } from '../../kit/paint';
import { REEL_COUNT, REEL_ROWS } from './fruitLoveFeverRound';

const GAP = 6;
const MAX_CELL = 112;
const MIN_CELL = 28;
export const COUNTER_HEIGHT = 34;
const COUNTER_GAP = 10;

export interface FruitLayout {
  readonly cell: number;
  readonly gap: number;
  readonly counter: Rect;
  readonly reels: Rect;
}

export const layoutOf = (area: Rect): FruitLayout => {
  const byWidth = (area.width - GAP * (REEL_COUNT + 1)) / REEL_COUNT;
  const byHeight = (area.height - COUNTER_HEIGHT - COUNTER_GAP - GAP * (REEL_ROWS + 1)) / REEL_ROWS;
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, byWidth, byHeight));
  const width = cell * REEL_COUNT + GAP * (REEL_COUNT + 1);
  const height = cell * REEL_ROWS + GAP * (REEL_ROWS + 1);
  const x = area.x + (area.width - width) / 2;
  const top = area.y + Math.max(0, (area.height - height - COUNTER_HEIGHT - COUNTER_GAP) / 2);
  return {
    cell,
    gap: GAP,
    counter: { x, y: top, width, height: COUNTER_HEIGHT },
    reels: { x, y: top + COUNTER_HEIGHT + COUNTER_GAP, width, height },
  };
};

/** The centre of a board cell (`reel * rows + row`). */
export const cellCenter = (layout: FruitLayout, index: number): { x: number; y: number } => {
  const pitch = layout.cell + layout.gap;
  return {
    x: layout.reels.x + layout.gap + Math.floor(index / REEL_ROWS) * pitch + layout.cell / 2,
    y: layout.reels.y + layout.gap + (index % REEL_ROWS) * pitch + layout.cell / 2,
  };
};

export const cellRect = (layout: FruitLayout, index: number): Rect => {
  const { x, y } = cellCenter(layout, index);
  return { x: x - layout.cell / 2, y: y - layout.cell / 2, width: layout.cell, height: layout.cell };
};
