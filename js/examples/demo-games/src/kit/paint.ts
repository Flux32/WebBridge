/** Drawing primitives in the shared look: rounded shapes, rounded type, the night backdrop. */
import { font, PALETTE, RADIUS } from './palette';
import type { Viewport } from './Surface';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextStyle {
  readonly size: number;
  readonly weight?: number;
  readonly color?: string;
  readonly align?: CanvasTextAlign;
  readonly baseline?: CanvasTextBaseline;
  readonly family?: string;
}

export const roundRectPath = (context: CanvasRenderingContext2D, rect: Rect, radius: number = RADIUS): void => {
  const r = Math.min(radius, rect.width / 2, rect.height / 2);
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, r);
};

export const fillRoundRect = (context: CanvasRenderingContext2D, rect: Rect, color: string, radius?: number): void => {
  roundRectPath(context, rect, radius);
  context.fillStyle = color;
  context.fill();
};

export const strokeRoundRect = (
  context: CanvasRenderingContext2D,
  rect: Rect,
  color: string,
  lineWidth = 1.5,
  radius?: number,
): void => {
  roundRectPath(context, rect, radius);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
};

export const drawText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle): void => {
  context.font = font(style.weight ?? 700, style.size, style.family);
  context.fillStyle = style.color ?? PALETTE.ink;
  context.textAlign = style.align ?? 'center';
  context.textBaseline = style.baseline ?? 'middle';
  context.fillText(text, x, y);
};

/** A soft light under a highlighted shape; radial gradients, not `shadowBlur`, which is slow on weak Android. */
export const drawGlow = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void => {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

/** Adds alpha to a `#rrggbb` palette colour. */
export const withAlpha = (hex: string, alpha: number): string => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

/** The backdrop is cached per size and accent: gradients are built on resize, not every frame. */
export class Backdrop {
  private cache: { key: string; image: HTMLCanvasElement } | null = null;

  public draw(context: CanvasRenderingContext2D, viewport: Viewport, accent: string): void {
    const key = `${viewport.width}x${viewport.height}:${accent}`;
    if (this.cache?.key !== key) this.cache = { key, image: renderBackdrop(viewport, accent) };
    context.drawImage(this.cache.image, 0, 0, viewport.width, viewport.height);
  }
}

const renderBackdrop = ({ width, height }: Viewport, accent: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  if (context === null) return canvas;
  const base = context.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, PALETTE.dusk);
  base.addColorStop(1, PALETTE.night);
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);
  drawGlow(context, width * 0.5, height * 0.32, Math.max(width, height) * 0.55, withAlpha(accent, 0.16));
  context.fillStyle = 'rgba(255, 255, 255, 0.035)';
  const step = 28;
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) context.fillRect(x, y, 1.5, 1.5);
  }
  return canvas;
};
