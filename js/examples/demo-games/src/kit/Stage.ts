/**
 * Everything a demo scene draws on and moves with: the canvas, the frame loop, the animator, confetti,
 * the safe area and the backend feed. The scene only paints its playfield; the backdrop and the header
 * are the stage's, so all demo games look alike.
 */
import type { BridgeBase } from '@omega/webbridge-js';
import { Animator } from './Animator';
import { BackendFeed } from './BackendFeed';
import { drawHeader } from './header';
import { Backdrop, type Rect } from './paint';
import { Particles } from './Particles';
import { SafeArea } from './SafeArea';
import { Surface, type Viewport } from './Surface';
import { FrameLoop } from './FrameLoop';

export interface Frame {
  readonly now: number;
  readonly viewport: Viewport;
  /** Clear of the host's bars. */
  readonly content: Rect;
  /** `content` below the shared header: where a scene lays out its game. */
  readonly playfield: Rect;
}

export interface SceneRenderer {
  draw(context: CanvasRenderingContext2D, frame: Frame): void;
  /** Ambient motion that needs frames on its own (a pulsing hint); motions via the animator need none. */
  isAnimating?(now: number): boolean;
}

export interface StageOptions {
  readonly container: HTMLElement;
  readonly devicePixelRatio: number | undefined;
  readonly bridge: BridgeBase;
  readonly title: string;
  readonly accent: string;
}

const SHAKE_MS = 360;
/** The mode pill and the five feed lines under it. */
const HEADER_HEIGHT = 112;

const belowHeader = (content: Rect): Rect => ({
  x: content.x,
  y: content.y + HEADER_HEIGHT,
  width: content.width,
  height: Math.max(0, content.height - HEADER_HEIGHT),
});

export class Stage {
  public readonly animator: Animator;
  public readonly particles = new Particles();
  public readonly feed: BackendFeed;
  private readonly surface: Surface;
  private readonly loop: FrameLoop;
  private readonly safeArea: SafeArea;
  private readonly backdrop = new Backdrop();
  private renderer: SceneRenderer | null = null;
  private shakeStartedAt = -Infinity;

  public constructor(private readonly options: StageOptions) {
    this.loop = new FrameLoop((now) => this.draw(now));
    this.animator = new Animator(() => performance.now(), () => this.redraw());
    this.feed = new BackendFeed(() => this.redraw());
    this.surface = new Surface(options.container, options.devicePixelRatio, () => this.redraw());
    this.safeArea = new SafeArea(options.bridge, () => this.redraw());
  }

  public get canvas(): HTMLCanvasElement {
    return this.surface.canvas;
  }

  public get content(): Rect {
    return this.safeArea.content(this.surface.viewport);
  }

  public setRenderer(renderer: SceneRenderer): void {
    this.renderer = renderer;
    this.redraw();
  }

  public redraw(): void {
    this.loop.invalidate();
  }

  public shake(): void {
    this.shakeStartedAt = performance.now();
    this.redraw();
  }

  public celebrate(x: number, y: number, colors: readonly string[]): void {
    this.particles.burst({ x, y, colors, count: 48, speed: 620 }, performance.now());
    this.redraw();
  }

  public destroy(): void {
    this.animator.cancelAll();
    this.loop.stop();
    this.safeArea.destroy();
    this.surface.destroy();
  }

  private draw(now: number): boolean {
    this.animator.tick(now);
    const { context, viewport } = this.surface;
    this.surface.beginFrame();
    this.backdrop.draw(context, viewport, this.options.accent);
    const content = this.safeArea.content(viewport);
    const frame: Frame = { now, viewport, content, playfield: belowHeader(content) };

    const shakeProgress = (now - this.shakeStartedAt) / SHAKE_MS;
    const isShaking = shakeProgress < 1;
    context.save();
    if (isShaking) context.translate(Math.sin(shakeProgress * 40) * 7 * (1 - shakeProgress), 0);
    this.renderer?.draw(context, frame);
    context.restore();

    this.particles.draw(context, now);
    drawHeader(context, frame, { title: this.options.title, accent: this.options.accent, feed: this.feed.entries });
    return this.animator.isMoving || this.particles.isAlive || isShaking || (this.renderer?.isAnimating?.(now) ?? false);
  }
}
