/**
 * Three totem columns. A spin gives each column a strip — a fresh head above, the landing head, fillers,
 * then the three heads it showed — and scrolls it down at a steady speed, landing the last cell with a
 * short overshoot. The columns stop one after another; each window shows its head and peeks at the next.
 */
import { easeOutBack, lerp } from '../../kit/easing';
import { roundRectPath, type Rect } from '../../kit/paint';
import type { Totem, TotemTriple } from './twistSpin';

const FIRST_STOP_MS = 760;
const STOP_STAGGER_MS = 260;
const LAND_MS = 300;
const SPIN_SPEED = 0.02;
const COLUMNS = 3;
/** Head above, the landed head, head below. */
const VISIBLE = 3;
export type SpinKind = 'round' | 'series';
/** A bought series has no death, so no skull flies past either. */
const FILLERS_OF: Readonly<Record<SpinKind, readonly Totem[]>> = {
  round: ['fire', 'earth', 'water', 'death'],
  series: ['fire', 'earth', 'water'],
};

export const TOTEM_SPIN_MS = FIRST_STOP_MS + STOP_STAGGER_MS * (COLUMNS - 1);

interface Column {
  strip: Totem[];
  /** The strip index in the middle of the window; it falls to 1 as the column spins. */
  offset: number;
  start: number;
}

const filler = (pool: readonly Totem[] = FILLERS_OF.round): Totem => pool[Math.floor(Math.random() * pool.length)] ?? 'fire';
const fillers = (count: number, pool?: readonly Totem[]): Totem[] => Array.from({ length: count }, () => filler(pool));

export class TwistTotems {
  private readonly columns: Column[] = Array.from({ length: COLUMNS }, () => ({ strip: fillers(VISIBLE), offset: 1, start: 1 }));
  public landed: TotemTriple | null = null;

  public prepare(totems: TotemTriple, kind: SpinKind): void {
    this.landed = null;
    const pool = FILLERS_OF[kind];
    this.columns.forEach((column, index) => {
      const shown = column.strip.slice(0, VISIBLE);
      const travelMs = FIRST_STOP_MS + STOP_STAGGER_MS * index - LAND_MS;
      const fillerCount = Math.max(VISIBLE, Math.round(travelMs * SPIN_SPEED));
      column.strip = [filler(pool), totems[index] ?? 'fire', ...fillers(fillerCount, pool), ...shown];
      column.start = 2 + fillerCount + 1;
      column.offset = column.start;
    });
  }

  public advance(elapsedMs: number): void {
    this.columns.forEach((column, index) => {
      const stopAt = FIRST_STOP_MS + STOP_STAGGER_MS * index;
      const landAt = stopAt - LAND_MS;
      if (elapsedMs >= stopAt) column.offset = 1;
      else if (elapsedMs >= landAt) column.offset = lerp(2, 1, easeOutBack((elapsedMs - landAt) / LAND_MS));
      else column.offset = lerp(column.start, 2, elapsedMs / landAt);
    });
  }

  public settle(totems: TotemTriple): void {
    for (const column of this.columns) {
      column.strip = column.strip.slice(0, VISIBLE);
      column.offset = 1;
    }
    this.landed = totems;
  }

  /** `draw` gets a head's centre and how far it sits from the window's middle, in cells. */
  public draw(
    context: CanvasRenderingContext2D,
    windows: readonly Rect[],
    pitch: number,
    drawHead: (totem: Totem, x: number, y: number, distance: number) => void,
  ): void {
    this.columns.forEach((column, index) => {
      const window = windows[index];
      if (window === undefined) return;
      context.save();
      roundRectPath(context, window, 18);
      context.clip();
      const middleY = window.y + window.height / 2;
      const first = Math.max(0, Math.floor(column.offset) - 2);
      for (let stripIndex = first; stripIndex <= first + 4; stripIndex += 1) {
        const totem = column.strip[stripIndex];
        if (totem === undefined) continue;
        const distance = stripIndex - column.offset;
        drawHead(totem, window.x + window.width / 2, middleY + distance * pitch, Math.abs(distance));
      }
      context.restore();
    });
  }
}
