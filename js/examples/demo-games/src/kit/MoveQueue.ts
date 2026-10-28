/**
 * Plays the host's commands one after another. A restart can arrive while a hop is still in the air;
 * queued, it waits for the hop to land instead of tearing the scene from under it.
 */
export class MoveQueue {
  private tail: Promise<void> = Promise.resolve();
  private isClosed = false;

  /** `move` resolves `false` when its motion was cut short: the queue then stops for good (the game is gone). */
  public enqueue(move: () => Promise<boolean | void>): void {
    this.tail = this.tail.then(async () => {
      if (this.isClosed) return;
      if ((await move()) === false) this.isClosed = true;
    });
  }

  public close(): void {
    this.isClosed = true;
  }
}
