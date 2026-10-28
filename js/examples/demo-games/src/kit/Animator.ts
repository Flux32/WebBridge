/**
 * Time-based motions behind promises. A scene awaits a motion and only then tells the host the move
 * is played out — that is the round-pace contract (`SpinReady` / `DropFinished` after the animation).
 * The clock is injected, so tests play motions to their end without a browser.
 */
interface Motion {
  readonly startedAt: number;
  readonly durationMs: number;
  readonly onFrame: (progress: number) => void;
  readonly settle: (isPlayed: boolean) => void;
}

export class Animator {
  private readonly motions = new Set<Motion>();

  public constructor(
    private readonly clock: () => number,
    private readonly invalidate: () => void,
  ) {}

  public get isMoving(): boolean {
    return this.motions.size > 0;
  }

  /** Resolves `true` once played to the end, `false` when cut short by `cancelAll` (the game was destroyed). */
  public play(durationMs: number, onFrame: (progress: number) => void): Promise<boolean> {
    return new Promise((settle) => {
      this.motions.add({ startedAt: this.clock(), durationMs: Math.max(durationMs, 1), onFrame, settle });
      onFrame(0);
      this.invalidate();
    });
  }

  public wait(durationMs: number): Promise<boolean> {
    return this.play(durationMs, () => undefined);
  }

  /** Advances every motion to `now`; finished ones get their last frame and resolve. */
  public tick(now: number): void {
    for (const motion of this.motions) {
      const progress = Math.min(1, (now - motion.startedAt) / motion.durationMs);
      motion.onFrame(progress);
      if (progress < 1) continue;
      this.motions.delete(motion);
      motion.settle(true);
    }
  }

  public cancelAll(): void {
    for (const motion of this.motions) motion.settle(false);
    this.motions.clear();
  }
}
