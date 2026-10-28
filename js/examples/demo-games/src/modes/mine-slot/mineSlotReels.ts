/**
 * The five reels as strips of symbols scrolling down, as slot-coin spins them: a spin builds each reel a
 * strip — the new board on top, fillers, then the board it showed — slides the window from the old board to
 * the new one, and lands the last cell with a short overshoot. Reels stop one after another.
 */
import { easeOutBack, lerp } from '../../kit/easing';
import { fillRoundRect, roundRectPath, strokeRoundRect, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import { drawReelSymbol } from './mineSlotGlyphs';
import { boardCellCenter, type MineLayout } from './mineSlotLayout';
import { REEL_COUNT, REEL_ROWS } from './mineSlotRound';
import { FILLER_SYMBOLS, type ReelSymbol } from './mineSlotSymbols';

const FIRST_STOP_MS = 760;
const STOP_STAGGER_MS = 170;
const LAND_MS = 260;
/** Cells a reel scrolls per millisecond before it lands. */
const SPIN_SPEED = 0.026;

const REEL_LINE = withAlpha(PALETTE.copper, 0.35);

export const SPIN_MS = FIRST_STOP_MS + STOP_STAGGER_MS * (REEL_COUNT - 1);

interface Reel {
  strip: ReelSymbol[];
  /** The strip index at the window's top row; it falls to 0 as the reel spins. */
  offset: number;
  start: number;
  isBlurred: boolean;
}

const randomFiller = (): ReelSymbol => FILLER_SYMBOLS[Math.floor(Math.random() * FILLER_SYMBOLS.length)] ?? { kind: 'empty' };

const fillers = (count: number): ReelSymbol[] => Array.from({ length: count }, randomFiller);

/** A symbol's place on screen; `boardIndex` is -1 for a filler passing by. */
export interface ReelCell {
  readonly x: number;
  readonly y: number;
  readonly boardIndex: number;
  readonly isBlurred: boolean;
}

export class MineSlotReels {
  private readonly reels: Reel[] = Array.from({ length: REEL_COUNT }, () => ({
    strip: fillers(REEL_ROWS),
    offset: 0,
    start: 0,
    isBlurred: false,
  }));

  /** Sets every reel up to land on `cells`, column-major as the board string. */
  public prepare(cells: readonly ReelSymbol[]): void {
    this.reels.forEach((reel, index) => {
      const shown = reel.strip.slice(0, REEL_ROWS);
      const target = cells.slice(index * REEL_ROWS, (index + 1) * REEL_ROWS);
      const travelMs = FIRST_STOP_MS + STOP_STAGGER_MS * index - LAND_MS;
      const fillerCount = Math.max(REEL_ROWS, Math.round(travelMs * SPIN_SPEED) - REEL_ROWS);
      reel.strip = [...target, ...fillers(fillerCount), ...shown];
      reel.start = REEL_ROWS + fillerCount;
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
      reel.strip = reel.strip.slice(0, REEL_ROWS);
      reel.offset = 0;
      reel.isBlurred = false;
    }
  }

  /** The reel window with its symbols; `usedCells` are the cells whose striker has left for the field. */
  public drawWindow(context: CanvasRenderingContext2D, layout: MineLayout, usedCells: ReadonlySet<number>): void {
    const { reels, cell } = layout;
    fillRoundRect(context, reels, PALETTE.dusk, 16);
    strokeRoundRect(context, reels, REEL_LINE, 1.5, 16);
    context.save();
    roundRectPath(context, reels, 16);
    context.clip();
    this.draw(layout, (symbol, { x, y, boardIndex, isBlurred }) => {
      fillRoundRect(context, { x: x - cell / 2, y: y - cell / 2, width: cell, height: cell }, PALETTE.panel, 10);
      context.globalAlpha = isBlurred ? 0.55 : usedCells.has(boardIndex) ? 0.22 : 1;
      drawReelSymbol(context, symbol, x, y, cell * 0.86);
      context.globalAlpha = 1;
    });
    context.restore();
  }

  private draw(layout: MineLayout, drawCell: (symbol: ReelSymbol, cell: ReelCell) => void): void {
    const pitch = layout.cell + layout.gap;
    this.reels.forEach((reel, index) => {
      const top = boardCellCenter(layout, index * REEL_ROWS);
      const first = Math.floor(reel.offset) - 1;
      for (let stripIndex = Math.max(0, first); stripIndex <= first + REEL_ROWS + 1; stripIndex += 1) {
        const symbol = reel.strip[stripIndex];
        if (symbol === undefined) continue;
        const boardIndex = stripIndex < REEL_ROWS ? index * REEL_ROWS + stripIndex : -1;
        drawCell(symbol, { x: top.x, y: top.y + (stripIndex - reel.offset) * pitch, boardIndex, isBlurred: reel.isBlurred });
      }
    });
  }
}
