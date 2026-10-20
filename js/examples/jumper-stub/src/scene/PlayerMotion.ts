/**
 * Where the player is on the ladder, frame by frame. A move is a queue of timed segments — jumps
 * between platforms, a fall, a hold — and its promise settles when the last one has played out
 * (`true`) or when the move was cut short by `place` / `cancel` (`false`).
 */
import { START_STEP } from './routes';

export interface MotionFrame {
  /** The step the player is at, fractional mid-jump. */
  readonly position: number;
  /** Height of the jump arc, 0..1. */
  readonly hop: number;
  /** How far the fall has gone, 0..1. */
  readonly fall: number;
}

type SegmentKind = 'jump' | 'fall' | 'hold';

interface Segment {
  readonly kind: SegmentKind;
  readonly from: number;
  readonly to: number;
  readonly durationMs: number;
}

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class PlayerMotion {
  private position: number = START_STEP;
  private fall = 0;
  private segments: Segment[] = [];
  private segmentStartedAt = 0;
  private settle: ((isCompleted: boolean) => void) | null = null;

  public get isMoving(): boolean {
    return this.segments.length > 0;
  }

  /** Put the player on a step at once, dropping any move in progress. */
  public place(step: number): void {
    this.cancel();
    this.position = step;
    this.fall = 0;
  }

  /** Jump through the waypoints in `durationMs` overall, one even slice per jump. */
  public jump(waypoints: readonly number[], durationMs: number, now: number): Promise<boolean> {
    const sliceMs = durationMs / Math.max(waypoints.length, 1);
    let from = this.position;
    const segments = waypoints.map((to): Segment => {
      const segment: Segment = { kind: 'jump', from, to, durationMs: sliceMs };
      from = to;
      return segment;
    });
    return this.run(segments, now);
  }

  public fallDown(durationMs: number, now: number): Promise<boolean> {
    return this.run([{ kind: 'fall', from: this.position, to: this.position, durationMs }], now);
  }

  public hold(durationMs: number, now: number): Promise<boolean> {
    return this.run([{ kind: 'hold', from: this.position, to: this.position, durationMs }], now);
  }

  public cancel(): void {
    this.segments = [];
    this.finish(false);
  }

  /** Advance to `now` and read the frame; settles the move once its last segment is over. */
  public sample(now: number): MotionFrame {
    let segment = this.segments[0];
    while (segment !== undefined && now - this.segmentStartedAt >= segment.durationMs) {
      this.complete(segment);
      this.segmentStartedAt += segment.durationMs;
      this.segments.shift();
      segment = this.segments[0];
    }
    if (segment === undefined) {
      this.finish(true);
      return { position: this.position, hop: 0, fall: this.fall };
    }
    // A frame's timestamp may precede the moment the move started within that frame.
    return this.frameWithin(segment, Math.max(0, now - this.segmentStartedAt) / segment.durationMs);
  }

  private run(segments: Segment[], now: number): Promise<boolean> {
    this.cancel();
    this.segments = segments;
    this.segmentStartedAt = now;
    return new Promise((resolve) => {
      this.settle = resolve;
    });
  }

  private complete(segment: Segment): void {
    this.position = segment.to;
    if (segment.kind === 'fall') this.fall = 1;
  }

  private frameWithin(segment: Segment, t: number): MotionFrame {
    if (segment.kind === 'fall') return { position: this.position, hop: 0, fall: t * t };
    if (segment.kind === 'hold') return { position: this.position, hop: 0, fall: this.fall };

    const position = segment.from + (segment.to - segment.from) * easeInOut(t);
    return { position, hop: Math.sin(Math.PI * t), fall: 0 };
  }

  private finish(isCompleted: boolean): void {
    const settle = this.settle;
    this.settle = null;
    settle?.(isCompleted);
  }
}
