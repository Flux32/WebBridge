/**
 * The canvas inside the shell's container. It tracks the container's size and keeps the backing store at
 * `css size × min(window DPR, host cap)`: the cap is the host's (`WebBootOptions.devicePixelRatio`), so a
 * DPR-3 phone does not pay for nine times the pixels next to the shell.
 */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export class Surface {
  public readonly canvas: HTMLCanvasElement;
  public readonly context: CanvasRenderingContext2D;
  private size: Viewport = { width: 0, height: 0 };
  private readonly observer: ResizeObserver;

  public constructor(
    private readonly container: HTMLElement,
    private readonly devicePixelRatioCap: number | undefined,
    onResize: () => void,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:manipulation';
    const context = this.canvas.getContext('2d');
    if (context === null) throw new Error('[demo-games] Canvas 2D is not available');
    this.context = context;
    // First in the container: the shell measures the game by the page's first canvas.
    container.prepend(this.canvas);
    this.observer = new ResizeObserver(() => {
      this.resize();
      onResize();
    });
    this.observer.observe(container);
    this.resize();
  }

  public get viewport(): Viewport {
    return this.size;
  }

  /** Scales the context so the frame is drawn in CSS pixels. */
  public beginFrame(): void {
    const ratio = this.canvas.width / Math.max(this.size.width, 1);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  public destroy(): void {
    this.observer.disconnect();
    this.canvas.remove();
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const windowRatio = window.devicePixelRatio;
    const ratio = Math.min(windowRatio, this.devicePixelRatioCap ?? windowRatio);
    this.size = { width, height };
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
  }
}
