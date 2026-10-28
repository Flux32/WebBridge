/** Slot symbols drawn with shapes in the shared palette: no textures, so the bundle stays one small file. */
import { drawGlow, drawText, fillRoundRect, roundRectPath, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { SlotSymbol } from './slotSymbols';

const BASE_COLORS = [PALETTE.sky, PALETTE.violet, PALETTE.mint, PALETTE.coral, PALETTE.lime, PALETTE.pink, PALETTE.amber] as const;

const polygonPath = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, sides: number): void => {
  context.beginPath();
  for (let side = 0; side < sides; side += 1) {
    const angle = -Math.PI / 2 + (side * Math.PI * 2) / sides;
    context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  context.closePath();
};

const starPath = (context: CanvasRenderingContext2D, x: number, y: number, radius: number): void => {
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const reach = point % 2 === 0 ? radius : radius * 0.45;
    context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  context.closePath();
};

const fillPath = (context: CanvasRenderingContext2D, color: string): void => {
  context.fillStyle = color;
  context.fill();
};

type ShapePath = (context: CanvasRenderingContext2D, x: number, y: number, radius: number) => void;

const circlePath: ShapePath = (context, x, y, radius) => {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
};

/** Ranks 1–6 are filled shapes; 7, 8 and 9 are the classic seven, bar and ring. */
const BASE_PATHS: Readonly<Record<number, ShapePath>> = {
  1: circlePath,
  2: (context, x, y, radius) => polygonPath(context, x, y, radius * 1.2, 4),
  3: (context, x, y, radius) => polygonPath(context, x, y + radius * 0.2, radius * 1.25, 3),
  4: (context, x, y, radius) => roundRectPath(context, { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 }, radius * 0.35),
  5: (context, x, y, radius) => polygonPath(context, x, y, radius * 1.1, 6),
  6: (context, x, y, radius) => starPath(context, x, y, radius * 1.25),
};

const drawBase = (context: CanvasRenderingContext2D, rank: number, x: number, y: number, size: number): void => {
  const radius = size * 0.28;
  const color = BASE_COLORS[(rank - 1) % BASE_COLORS.length] ?? PALETTE.ink;
  const path = BASE_PATHS[rank];
  if (path !== undefined) {
    path(context, x, y, radius);
    return fillPath(context, color);
  }
  if (rank === 7) return drawText(context, '7', x, y + size * 0.02, { size: size * 0.62, weight: 900, color });
  if (rank === 8) {
    const plate = { x: x - radius * 1.25, y: y - radius * 0.6, width: radius * 2.5, height: radius * 1.2 };
    fillRoundRect(context, plate, withAlpha(PALETTE.ink, 0.9), radius * 0.3);
    return drawText(context, 'BAR', x, y + 1, { size: size * 0.2, weight: 900, color: PALETTE.dusk });
  }
  circlePath(context, x, y, radius);
  context.strokeStyle = PALETTE.amber;
  context.lineWidth = size * 0.08;
  context.stroke();
};

const drawDisc = (context: CanvasRenderingContext2D, x: number, y: number, size: number, tone: string): void => {
  const radius = size * 0.36;
  drawGlow(context, x, y, radius * 1.7, withAlpha(tone, 0.35));
  circlePath(context, x, y, radius);
  fillPath(context, tone);
  circlePath(context, x, y, radius * 0.8);
  context.strokeStyle = withAlpha(PALETTE.night, 0.35);
  context.lineWidth = Math.max(1.5, size * 0.03);
  context.stroke();
};

/** One coin label: the flight draws the same disc between cells. */
export const drawCoin = (context: CanvasRenderingContext2D, label: string, x: number, y: number, size: number): void => {
  drawDisc(context, x, y, size, PALETTE.amber);
  drawText(context, label, x, y + 1, { size: size * (label.length > 3 ? 0.17 : 0.22), weight: 900, color: PALETTE.night });
};

export const coinLabel = (coeff: number): string => `×${coeff}`;

export const drawSymbol = (context: CanvasRenderingContext2D, symbol: SlotSymbol, x: number, y: number, size: number): void => {
  switch (symbol.kind) {
    case 'empty':
      return;
    case 'base':
      return drawBase(context, symbol.rank, x, y, size);
    case 'coin':
      return drawCoin(context, coinLabel(symbol.coeff), x, y, size);
    case 'jackpot':
      drawDisc(context, x, y, size, PALETTE.violet);
      return drawText(context, symbol.tier, x, y + 1, { size: size * 0.15, weight: 900, color: PALETTE.ink });
    case 'trigger':
      drawDisc(context, x, y, size, PALETTE.amber);
      starPath(context, x, y, size * 0.2);
      return fillPath(context, PALETTE.night);
    case 'special':
      polygonPath(context, x, y, size * 0.32, 4);
      fillPath(context, PALETTE.pink);
      return drawText(context, '?', x, y + 1, { size: size * 0.3, weight: 900, color: PALETTE.night });
  }
};

/** The highlight of a cell that took part in a win. */
export const drawWinCell = (context: CanvasRenderingContext2D, rect: Rect): void => {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  drawGlow(context, centerX, centerY, rect.width * 0.75, withAlpha(PALETTE.amber, 0.3));
  strokeRoundRect(context, rect, PALETTE.amber, 2.5, 12);
};
