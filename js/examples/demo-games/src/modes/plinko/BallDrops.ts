/**
 * Balls in the air: each one hops from peg to peg along its precomputed path and drops into its slot. The
 * drop motion resolves once the last ball of the drop has landed — the moment the host may hear about it.
 * Peg hits and slot landings are kept as timestamps, so the board flashes them without extra motions.
 */
import { easeInCubic, easeOutBounce, easeOutCubic, lerp } from '../../kit/easing';
import { PALETTE } from '../../kit/palette';
import type { Stage } from '../../kit/Stage';
import { ballPath } from './ballPath';
import { stopX, stopY, type BoardLayout } from './boardLayout';

interface Flight {
  readonly path: readonly number[];
  readonly slot: number;
  /** The stop the ball last left, `0` above the board. */
  stop: number;
  /** Progress from `stop` to the next one, 0…1. */
  hop: number;
}

/** One row gap of a fall; a 14-row board takes about two seconds. */
const HOP_MS = 125;
const MAX_STAGGER_MS = 160;
/** All the balls of a big drop leave within this time. */
const RELEASE_WINDOW_MS = 2600;
const HOP_HEIGHT_SHARE = 0.42;
const BALL_HIGHLIGHT = 'rgba(255, 255, 255, 0.7)';

export class BallDrops {
  private readonly flights = new Set<Flight>();
  private pegHits = new Float64Array(0);
  private landings = new Float64Array(0);
  private dropCount = 0;

  public constructor(private readonly stage: Stage) {}

  /** When each peg was last hit, by `row * (rows + 3) + column`. */
  public get pegHitTimes(): Float64Array {
    return this.pegHits;
  }

  /** When a ball last landed in each slot; `0` for none since the drop began. */
  public get landingTimes(): Float64Array {
    return this.landings;
  }

  public drop(rows: number, slots: readonly number[]): Promise<boolean> {
    this.dropCount += 1;
    this.prepare(rows);
    const stagger = Math.min(MAX_STAGGER_MS, RELEASE_WINDOW_MS / Math.max(1, slots.length));
    const balls = slots.map((slot, index) =>
      this.stage.animator
        .wait(index * stagger)
        .then((isReleased) => isReleased && this.fly(ballPath(rows, slot, this.dropCount * 97 + index), slot)),
    );
    return Promise.all(balls).then((played) => played.every(Boolean));
  }

  public draw(context: CanvasRenderingContext2D, layout: BoardLayout): void {
    const radius = layout.ballRadius;
    for (const flight of this.flights) {
      const x = this.ballX(layout, flight);
      const y = this.ballY(layout, flight);
      context.fillStyle = PALETTE.amber;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = BALL_HIGHLIGHT;
      context.beginPath();
      context.arc(x - radius * 0.32, y - radius * 0.32, radius * 0.32, 0, Math.PI * 2);
      context.fill();
    }
  }

  private prepare(rows: number): void {
    const pegCount = rows * (rows + 3);
    if (this.pegHits.length !== pegCount) this.pegHits = new Float64Array(pegCount);
    this.landings = new Float64Array(rows + 1);
  }

  private fly(path: readonly number[], slot: number): Promise<boolean> {
    const rows = path.length - 1;
    const flight: Flight = { path, slot, stop: 0, hop: 0 };
    this.flights.add(flight);
    return this.stage.animator.play((rows + 1) * HOP_MS, (progress) => {
      const travelled = progress * (rows + 1);
      const stop = Math.min(rows, Math.floor(travelled));
      if (stop > flight.stop) this.hitPeg(rows, stop - 1, (path[stop - 1] ?? 0) + 1);
      flight.stop = stop;
      flight.hop = travelled - stop;
      if (progress < 1) return;
      this.flights.delete(flight);
      this.landings[slot] = performance.now();
    });
  }

  private hitPeg(rows: number, row: number, column: number): void {
    this.pegHits[row * (rows + 3) + column] = performance.now();
  }

  private ballX(layout: BoardLayout, { path, stop, hop }: Flight): number {
    const eased = stop === layout.rows ? easeOutCubic(hop) : hop;
    return lerp(stopX(layout, path, stop), stopX(layout, path, stop + 1), eased);
  }

  /** Falls straight onto the top peg, hops over every next one and bounces into the slot. */
  private ballY(layout: BoardLayout, { stop, hop }: Flight): number {
    const from = stopY(layout, stop);
    const to = stopY(layout, stop + 1);
    if (stop === 0) return lerp(from, to, easeInCubic(hop));
    if (stop === layout.rows) return lerp(from, to, easeOutBounce(hop));
    return lerp(from, to, hop) - Math.sin(Math.PI * hop) * layout.rowGap * HOP_HEIGHT_SHARE;
  }
}
