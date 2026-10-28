/** Totem heads drawn with shapes: one colour and one sign per sector, a skull for death. */
import { fillRoundRect, strokeRoundRect, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Totem } from './twistSpin';

export const TOTEM_COLORS: Readonly<Record<Totem, string>> = {
  fire: PALETTE.coral,
  earth: PALETTE.amber,
  water: PALETTE.sky,
  death: PALETTE.violet,
};

/** A flame: a teardrop with its tip flicked aside; the inner tongue is drawn by `drawTotem`. */
const flamePath = (context: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  context.beginPath();
  context.moveTo(x + r * 0.2, y - r * 1.2);
  context.bezierCurveTo(x + r * 1.1, y - r * 0.3, x + r * 0.95, y + r, x, y + r);
  context.bezierCurveTo(x - r * 0.95, y + r, x - r * 1.05, y - r * 0.1, x - r * 0.45, y - r * 0.55);
  context.quadraticCurveTo(x - r * 0.3, y - r * 0.1, x - r * 0.1, y - r * 0.2);
  context.quadraticCurveTo(x - r * 0.1, y - r * 0.8, x + r * 0.2, y - r * 1.2);
  context.closePath();
};

const peakPath = (context: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  context.beginPath();
  context.moveTo(x - r * 1.1, y + r * 0.8);
  context.lineTo(x - r * 0.25, y - r * 0.9);
  context.lineTo(x + r * 0.2, y - r * 0.1);
  context.lineTo(x + r * 0.5, y - r * 0.5);
  context.lineTo(x + r * 1.1, y + r * 0.8);
  context.closePath();
};

const dropPath = (context: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  context.beginPath();
  context.moveTo(x, y - r * 1.15);
  context.quadraticCurveTo(x + r * 0.2, y - r * 0.6, x + r * 0.8, y + r * 0.15);
  context.arc(x, y + r * 0.25, r * 0.8, 0, Math.PI);
  context.quadraticCurveTo(x - r * 0.2, y - r * 0.6, x, y - r * 1.15);
  context.closePath();
};

const drawSkull = (context: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  context.fillStyle = PALETTE.ink;
  context.beginPath();
  context.arc(x, y - r * 0.15, r * 0.85, 0, Math.PI * 2);
  context.fill();
  fillRoundRect(context, { x: x - r * 0.45, y: y + r * 0.3, width: r * 0.9, height: r * 0.6 }, PALETTE.ink, r * 0.15);
  context.fillStyle = PALETTE.night;
  for (const side of [-1, 1]) {
    context.beginPath();
    context.arc(x + side * r * 0.35, y - r * 0.2, r * 0.22, 0, Math.PI * 2);
    context.fill();
  }
};

const SIGN_PATHS: Readonly<Record<Exclude<Totem, 'death'>, typeof flamePath>> = {
  fire: flamePath,
  earth: peakPath,
  water: dropPath,
};

/** A totem head centred on `(x, y)`; `size` is the side of its plate. */
export const drawTotem = (context: CanvasRenderingContext2D, totem: Totem, x: number, y: number, size: number): void => {
  const color = TOTEM_COLORS[totem];
  const plate = { x: x - size / 2, y: y - size / 2, width: size, height: size };
  fillRoundRect(context, plate, withAlpha(color, 0.16), size * 0.22);
  strokeRoundRect(context, plate, withAlpha(color, 0.7), 2, size * 0.22);
  const radius = size * 0.26;
  if (totem === 'death') return drawSkull(context, x, y, radius);
  SIGN_PATHS[totem](context, x, y, radius);
  context.fillStyle = color;
  context.fill();
  if (totem !== 'fire') return;
  dropPath(context, x, y + radius * 0.42, radius * 0.45);
  context.fillStyle = PALETTE.amber;
  context.fill();
};
