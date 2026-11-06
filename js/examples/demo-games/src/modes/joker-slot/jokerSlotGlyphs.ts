/**
 * Joker Slot's own symbols over slot-coin's: the Joker Coin (`l`) and the Super Joker Coin (`m`), which
 * slot-coin's scene draws as its trigger and its unknown special. Every other code is drawn by slot-coin.
 */
import { drawGlow, drawText, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import { drawSymbol } from '../slot-coin/slotCoinGlyphs';
import type { SlotCoinSymbol } from '../slot-coin/slotCoinSymbols';

const disc = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void => {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
};

/** A jester's three-pointed cap over the coin's letter. */
const capPath = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  const half = size * 0.18;
  const top = y - size * 0.2;
  context.beginPath();
  context.moveTo(x - half, top + size * 0.12);
  context.lineTo(x - half * 1.1, top - size * 0.04);
  context.lineTo(x - half * 0.35, top + size * 0.05);
  context.lineTo(x, top - size * 0.09);
  context.lineTo(x + half * 0.35, top + size * 0.05);
  context.lineTo(x + half * 1.1, top - size * 0.04);
  context.lineTo(x + half, top + size * 0.12);
  context.closePath();
};

const drawJoker = (context: CanvasRenderingContext2D, x: number, y: number, size: number, isSuper: boolean): void => {
  const radius = size * 0.38;
  drawGlow(context, x, y, radius * (isSuper ? 2.1 : 1.7), withAlpha(isSuper ? PALETTE.amber : PALETTE.magenta, 0.4));
  if (isSuper) disc(context, x, y, radius * 1.08, PALETTE.amber);
  disc(context, x, y, radius, PALETTE.magenta);
  capPath(context, x, y, size);
  context.fillStyle = isSuper ? PALETTE.amber : PALETTE.ink;
  context.fill();
  drawText(context, isSuper ? 'SUPER' : 'JOKER', x, y + size * 0.12, { size: size * 0.13, weight: 900, color: PALETTE.ink });
};

export const drawJokerSlotSymbol = (context: CanvasRenderingContext2D, symbol: SlotCoinSymbol, x: number, y: number, size: number): void => {
  if (symbol.kind === 'trigger') return drawJoker(context, x, y, size, false);
  if (symbol.kind === 'special') return drawJoker(context, x, y, size, true);
  drawSymbol(context, symbol, x, y, size);
};

/** A Super Joker's multiplier, in a badge over its cell. */
export const drawMultiplierBadge = (context: CanvasRenderingContext2D, multiplier: number, x: number, y: number, size: number): void => {
  disc(context, x + size * 0.32, y - size * 0.32, size * 0.17, PALETTE.amber);
  drawText(context, `×${multiplier}`, x + size * 0.32, y - size * 0.31, { size: size * 0.14, weight: 900, color: PALETTE.night });
};
