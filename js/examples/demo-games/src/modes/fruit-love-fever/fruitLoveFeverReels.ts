/**
 * The five reels as strips scrolling down, as the other slot demos spin them: a spin builds each reel a
 * strip — the new board on top, fillers, then the board it showed — slides the window from the old board to
 * the new one, and lands with a short overshoot; reels stop one after another. Times are nominal: a fast
 * game plays the same strip in less real time.
 */
import { easeOutBack, lerp } from '../../kit/easing';
import type { FruitLayout } from './fruitLoveFeverLayout';
import { cellCenter } from './fruitLoveFeverLayout';
import { REEL_COUNT, REEL_ROWS } from './fruitLoveFeverRound';
import { FILLER_SYMBOLS, type ReelSymbol } from './fruitLoveFeverSymbols';

const FIRST_STOP_MS = 700;
const STOP_STAGGER_MS = 160;
const LAND_MS = 240;
/** Cells a reel scrolls per millisecond before it lands. */
const SPIN_SPEED = 0.026;

export const SPIN_MS = FIRST_STOP_MS + STOP_STAGGER_MS * (REEL_COUNT - 1);

interface Reel {
  strip: ReelSymbol[];
  /** The strip index at the window's top row; it falls to 0 as the reel spins. */
  offset: number;
  start: number;
  isBlurred: boolean;
}

/** A symbol's place on screen; `boardIndex` is -1 for a filler passing by. */
export interface ReelCell {
  readonly x: number;
  readonly y: number;
  readonly boardIndex: number;
  readonly isBlurred: boolean;
}

const randomFiller = (): ReelSymbol => FILLER_SYMBOLS[Math.floor(Math.random() * FILLER_SYMBOLS.length)]!;

const fillers = (count: number): ReelSymbol[] => Array.from({ length: count }, randomFiller);

export class FruitLoveFeverReels {
  private readonly reels: Reel[] = Array.from({ length: REEL_COUNT }, () => ({
    strip: fillers(REEL_ROWS),
    offset: 0,
    start: 0,
    isBlurred: false,
  }));

  /** Sets every reel up to land on `board`, reel-major. */
  public prepare(board: readonly ReelSymbol[]): void {
    this.reels.forEach((reel, index) => {
      const shown = reel.strip.slice(0, REEL_ROWS);
      const target = board.slice(index * REEL_ROWS, (index + 1) * REEL_ROWS);
      const travelMs = FIRST_STOP_MS + STOP_STAGGER_MS * index - LAND_MS;
      const fillerCount = Math.max(REEL_ROWS, Math.round(travelMs * SPIN_SPEED) - REEL_ROWS);
      reel.strip = [...target, ...fillers(fillerCount), ...shown];
      reel.start = REEL_ROWS + fillerCount;
      reel.offset = reel.start;
    });
  }

  /** Puts `board` in the window at once: a resumed round, no spin. */
  public place(board: readonly ReelSymbol[]): void {
    this.reels.forEach((reel, index) => {
      reel.strip = board.slice(index * REEL_ROWS, (index + 1) * REEL_ROWS);
      reel.offset = 0;
      reel.isBlurred = false;
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

  public draw(layout: FruitLayout, drawCell: (symbol: ReelSymbol, cell: ReelCell) => void): void {
    const pitch = layout.cell + layout.gap;
    this.reels.forEach((reel, index) => {
      const top = cellCenter(layout, index * REEL_ROWS);
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
