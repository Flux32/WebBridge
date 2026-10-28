/**
 * The wheel's static parts in the shared look. The ring of 54 cells is painted once per size into an
 * offscreen canvas and only rotated per frame: 54 annular sectors a frame is wasted work on weak Android.
 */
import { drawText, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import { CELL_ANGLE, WHEEL_CELLS, WHEEL_COLORS, WHEEL_MULTIPLIERS, type WheelColor } from './wheelCells';

export const CELL_TONES: Readonly<Record<WheelColor, string>> = {
  BLACK: PALETTE.panel,
  RED: PALETTE.coral,
  BLUE: PALETTE.sky,
  GREEN: PALETTE.mint,
};

/** The ring's inner edge as a share of its outer radius; the hub sits inside it. */
export const RING_INNER = 0.74;
const RIM = 6;
/** Canvas angles start at 3 o'clock; the wheel's cells are counted from 12. */
const TOP = -Math.PI / 2;

const paintCell = (context: CanvasRenderingContext2D, index: number, radius: number): void => {
  const color = WHEEL_CELLS[index] ?? 'BLACK';
  const start = TOP + index * CELL_ANGLE;
  context.beginPath();
  context.arc(0, 0, radius, start, start + CELL_ANGLE);
  context.arc(0, 0, radius * RING_INNER, start + CELL_ANGLE, start, true);
  context.closePath();
  context.fillStyle = CELL_TONES[color];
  context.fill();
  context.stroke();
};

const paintRing = (radius: number, scale: number): HTMLCanvasElement => {
  const size = Math.ceil((radius + RIM) * 2 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context === null) return canvas;
  context.scale(scale, scale);
  context.translate(radius + RIM, radius + RIM);
  context.beginPath();
  context.arc(0, 0, radius + RIM / 2, 0, Math.PI * 2);
  context.lineWidth = RIM;
  context.strokeStyle = PALETTE.dusk;
  context.stroke();
  context.strokeStyle = PALETTE.night;
  context.lineWidth = 1.2;
  for (let index = 0; index < WHEEL_CELLS.length; index += 1) paintCell(context, index, radius);
  return canvas;
};

export class WheelRing {
  private cache: { key: string; image: HTMLCanvasElement } | null = null;

  /** The ring at `rotation` around (x, y); the backing store follows the context's DPR scale. */
  public draw(context: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number): void {
    const scale = context.getTransform().a;
    const key = `${Math.round(radius)}:${scale}`;
    if (this.cache?.key !== key) this.cache = { key, image: paintRing(Math.round(radius), scale) };
    const half = Math.round(radius) + RIM;
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.drawImage(this.cache.image, -half, -half, half * 2, half * 2);
    context.restore();
  }
}

/** Outlines the cell under the pointer: the winner, once revealed. */
export const drawWinningCell = (
  context: CanvasRenderingContext2D,
  center: { readonly x: number; readonly y: number; readonly radius: number },
  rotation: number,
  cellIndex: number,
): void => {
  const start = TOP + rotation + cellIndex * CELL_ANGLE;
  context.beginPath();
  context.arc(center.x, center.y, center.radius + 2, start, start + CELL_ANGLE);
  context.arc(center.x, center.y, center.radius * RING_INNER - 2, start + CELL_ANGLE, start, true);
  context.closePath();
  context.lineJoin = 'round';
  context.lineWidth = 3;
  context.strokeStyle = PALETTE.ink;
  context.stroke();
};

/** The pointer above the ring, pointing down at the cell that wins. */
export const drawPointer = (context: CanvasRenderingContext2D, x: number, top: number, size: number): void => {
  context.beginPath();
  context.moveTo(x - size * 0.6, top - size * 0.4);
  context.lineTo(x + size * 0.6, top - size * 0.4);
  context.lineTo(x, top + size * 0.75);
  context.closePath();
  context.fillStyle = PALETTE.ink;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = PALETTE.violet;
  context.stroke();
};

/** The countdown ring around the hub: what is left of the betting phase. */
export const drawCountdownArc = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, left: number): void => {
  context.lineCap = 'round';
  context.lineWidth = 4;
  context.strokeStyle = withAlpha(PALETTE.violet, 0.18);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  if (left > 0) {
    context.strokeStyle = PALETTE.violet;
    context.beginPath();
    context.arc(x, y, radius, TOP, TOP + Math.PI * 2 * left);
    context.stroke();
  }
  context.lineCap = 'butt';
};

/** The four colours and what they pay, in one row under the wheel. */
export const drawLegend = (context: CanvasRenderingContext2D, centerX: number, y: number, winner: WheelColor | null): void => {
  const pitch = 64;
  WHEEL_COLORS.forEach((color, index) => {
    const x = centerX + (index - (WHEEL_COLORS.length - 1) / 2) * pitch;
    context.globalAlpha = winner === null || winner === color ? 1 : 0.4;
    context.beginPath();
    context.arc(x - 14, y, 5, 0, Math.PI * 2);
    context.fillStyle = CELL_TONES[color];
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = PALETTE.inkFaint;
    context.stroke();
    drawText(context, `x${WHEEL_MULTIPLIERS[color]}`, x + 6, y + 0.5, { size: 13, weight: 800, color: PALETTE.ink });
  });
  context.globalAlpha = 1;
};
