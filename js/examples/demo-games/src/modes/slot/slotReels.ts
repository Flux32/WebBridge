/**
 * The reels as strips of symbols scrolling down. A spin builds each reel a strip — the new board on top,
 * fillers, then the board it showed — and slides its window from the old board to the new one at a steady
 * speed, then lands the last cell with a short overshoot. Reels stop one after another.
 */
import { easeOutBack, lerp } from '../../kit/easing';
import type { Rect } from '../../kit/paint';
import { SLOT_REELS, SLOT_ROWS } from './slotRound';
import { FILLER_SYMBOLS, type SlotSymbol } from './slotSymbols';

const FIRST_STOP_MS = 820;
const STOP_STAGGER_MS = 240;
const LAND_MS = 280;
/** Cells a reel scrolls per millisecond before it lands. */
const SPIN_SPEED = 0.024;

export const SPIN_MS = FIRST_STOP_MS + STOP_STAGGER_MS * (SLOT_REELS - 1);

interface Reel {
  strip: SlotSymbol[];
  /** The strip index at the window's top row; it falls to 0 as the reel spins. */
  offset: number;
  start: number;
  isBlurred: boolean;
}

const randomFiller = (): SlotSymbol =>
  FILLER_SYMBOLS[Math.floor(Math.random() * FILLER_SYMBOLS.length)] ?? { kind: 'empty' };

const fillers = (count: number): SlotSymbol[] => Array.from({ length: count }, randomFiller);

/** A symbol's place on screen; `boardIndex` is -1 for a filler passing by. */
export interface ReelCell {
  readonly x: number;
  readonly y: number;
  readonly boardIndex: number;
  readonly isBlurred: boolean;
}

export interface ReelGrid {
  readonly cell: number;
  readonly gap: number;
  readonly frame: Rect;
}

export class SlotReels {
  private readonly reels: Reel[] = Array.from({ length: SLOT_REELS }, () => ({
    strip: fillers(SLOT_ROWS),
    offset: 0,
    start: 0,
    isBlurred: false,
  }));

  /** Sets every reel up to land on `cells`, column-major as the board string. */
  public prepare(cells: readonly SlotSymbol[]): void {
    this.reels.forEach((reel, index) => {
      const shown = reel.strip.slice(0, SLOT_ROWS);
      const target = cells.slice(index * SLOT_ROWS, (index + 1) * SLOT_ROWS);
      const travelMs = FIRST_STOP_MS + STOP_STAGGER_MS * index - LAND_MS;
      const fillerCount = Math.max(SLOT_ROWS, Math.round(travelMs * SPIN_SPEED) - SLOT_ROWS);
      reel.strip = [...target, ...fillers(fillerCount), ...shown];
      reel.start = SLOT_ROWS + fillerCount;
      reel.offset = reel.start;
    });
  }

  public advance(elapsedMs: number): void {
    this.reels.forEach((reel, index) => {
      const stopAt = FIRST_STOP_MS + STOP_STAGGER_MS * index;
      const landAt = stopAt - LAND_MS;
      reel.isBlurred = elapsedMs < landAt;
      if (elapsedMs >= stopAt) reel.offset = 0;
      else if (elapsedMs >= landAt) reel.offset = lerp(1, 0, easeOutBack((elapsedMs - landAt) / LAND_MS));
      else reel.offset = lerp(reel.start, 1, elapsedMs / landAt);
    });
  }

  /** Drops the travelled part of the strips once landed: the window shows only the board. */
  public settle(): void {
    for (const reel of this.reels) {
      reel.strip = reel.strip.slice(0, SLOT_ROWS);
      reel.offset = 0;
      reel.isBlurred = false;
    }
  }

  public draw(
    context: CanvasRenderingContext2D,
    grid: ReelGrid,
    drawCell: (symbol: SlotSymbol, cell: ReelCell) => void,
  ): void {
    const pitch = grid.cell + grid.gap;
    this.reels.forEach((reel, index) => {
      const x = grid.frame.x + grid.gap + index * pitch + grid.cell / 2;
      const first = Math.floor(reel.offset) - 1;
      for (let stripIndex = Math.max(0, first); stripIndex <= first + SLOT_ROWS + 1; stripIndex += 1) {
        const symbol = reel.strip[stripIndex];
        if (symbol === undefined) continue;
        const y = grid.frame.y + grid.gap + (stripIndex - reel.offset) * pitch + grid.cell / 2;
        const boardIndex = stripIndex < SLOT_ROWS ? index * SLOT_ROWS + stripIndex : -1;
        drawCell(symbol, { x, y, boardIndex, isBlurred: reel.isBlurred });
      }
    });
  }
}

/** The reel window inside `area`: square cells, as big as the area allows. */
export const reelGridOf = (area: Rect): ReelGrid => {
  const gap = 8;
  const cell = Math.max(40, Math.min(112, (area.width - gap * (SLOT_REELS + 1)) / SLOT_REELS, (area.height - gap * (SLOT_ROWS + 1)) / SLOT_ROWS));
  const width = cell * SLOT_REELS + gap * (SLOT_REELS + 1);
  const height = cell * SLOT_ROWS + gap * (SLOT_ROWS + 1);
  return { cell, gap, frame: { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height } };
};

/** The centre of a board cell (`reel * rows + row`) in the grid. */
export const cellCenter = (grid: ReelGrid, index: number): { x: number; y: number } => {
  const reel = Math.floor(index / SLOT_ROWS);
  const row = index % SLOT_ROWS;
  const pitch = grid.cell + grid.gap;
  return { x: grid.frame.x + grid.gap + reel * pitch + grid.cell / 2, y: grid.frame.y + grid.gap + row * pitch + grid.cell / 2 };
};
