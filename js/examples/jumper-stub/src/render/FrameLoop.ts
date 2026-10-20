/**
 * Draws on demand: a frame is scheduled by `invalidate()`, and the loop keeps running only while
 * the draw call reports that something is still moving. An idle scene costs no frames.
 */
export class FrameLoop {
  private frameId: number | null = null;

  /** `draw` returns whether the next frame is needed too. */
  public constructor(private readonly draw: (now: number) => boolean) {}

  public invalidate(): void {
    if (this.frameId !== null) return;
    this.frameId = requestAnimationFrame(this.onFrame);
  }

  public stop(): void {
    if (this.frameId === null) return;
    cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private readonly onFrame = (now: number): void => {
    this.frameId = null;
    if (this.draw(now)) this.invalidate();
  };
}
