/**
 * The scene, the player's motion and the canvas they are drawn on, behind one frame loop. Every
 * motion starts here, so a started move always gets frames.
 */
import { CanvasSurface } from '../render/CanvasSurface';
import { drawScene } from '../render/drawScene';
import { FrameLoop } from '../render/FrameLoop';
import { JumperScene } from '../scene/JumperScene';
import { PlayerMotion } from '../scene/PlayerMotion';

export class StubStage {
  public readonly scene = new JumperScene();
  private readonly motion = new PlayerMotion();
  private readonly surface: CanvasSurface;
  private readonly loop: FrameLoop;

  public constructor(container: HTMLElement, devicePixelRatioCap: number | undefined) {
    this.loop = new FrameLoop((now) => this.draw(now));
    this.surface = new CanvasSurface(container, devicePixelRatioCap, () => this.redraw());
  }

  public get canvas(): HTMLCanvasElement {
    return this.surface.canvas;
  }

  /** Draw the next frame: call after any change of the scene. */
  public redraw(): void {
    this.loop.invalidate();
  }

  public place(step: number): void {
    this.motion.place(step);
    this.redraw();
  }

  public jump(waypoints: readonly number[], durationMs: number): Promise<boolean> {
    return this.animate(this.motion.jump(waypoints, durationMs, performance.now()));
  }

  public fallDown(durationMs: number): Promise<boolean> {
    return this.animate(this.motion.fallDown(durationMs, performance.now()));
  }

  public hold(durationMs: number): Promise<boolean> {
    return this.animate(this.motion.hold(durationMs, performance.now()));
  }

  public shake(): void {
    this.scene.shake(performance.now());
    this.redraw();
  }

  public destroy(): void {
    this.motion.cancel();
    this.loop.stop();
    this.surface.destroy();
  }

  private animate(move: Promise<boolean>): Promise<boolean> {
    this.redraw();
    return move;
  }

  private draw(now: number): boolean {
    const frame = this.motion.sample(now);
    this.surface.beginFrame();
    drawScene(this.surface.context, this.surface.viewport, this.scene, frame, now);
    return this.motion.isMoving || this.scene.isShaking(now);
  }
}
