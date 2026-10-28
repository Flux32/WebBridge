/**
 * The host's go-ahead for a bought series (`FreeGamesIntroFinished`): the first free spin waits for it, so
 * the totems do not spin under the free-spins intro. It is a latch, not an event: the go-ahead may land
 * while the series still waits in the move queue behind the spin that bought it.
 */
export class IntroLatch {
  private isOpen = false;
  private readonly waiters: ((isOpened: boolean) => void)[] = [];

  public open(): void {
    this.isOpen = true;
    this.waiters.splice(0).forEach((resolve) => resolve(true));
  }

  /** Resolves `true` once open, `false` when the game is destroyed first. */
  public wait(): Promise<boolean> {
    if (this.isOpen) return Promise.resolve(true);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** The next series waits for its own intro. */
  public rearm(): void {
    this.isOpen = false;
  }

  public close(): void {
    this.waiters.splice(0).forEach((resolve) => resolve(false));
  }
}
