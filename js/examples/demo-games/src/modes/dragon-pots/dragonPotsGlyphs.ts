/**
 * Dragon Pots drawn with shapes in the shared palette: the card ranks as type, a dragon, a lotus, a lantern,
 * a coin stack and a koi, a jade wild, and the pot coins in their pot's colour. No textures: the bundle
 * stays one file.
 */
import type { DragonPotsPotColor } from '@omega/webbridge-protocol';
import { drawGlow, drawText, fillRoundRect, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { SymbolKind } from './dragonPotsSymbols';

type Glyph = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => void;

/** The pots' colours, as the scene paints a pot and its coins. */
export const POT_TONES: Readonly<Record<DragonPotsPotColor, string>> = { Red: PALETTE.vermilion, Green: PALETTE.mint, Blue: PALETTE.sky };

const fillPath = (context: CanvasRenderingContext2D, color: string, path: () => void): void => {
  context.beginPath();
  path();
  context.fillStyle = color;
  context.fill();
};

const disc = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void =>
  fillPath(context, color, () => context.arc(x, y, radius, 0, Math.PI * 2));

const dragon: Glyph = (context, x, y, size) => {
  context.strokeStyle = PALETTE.amber;
  context.lineCap = 'round';
  context.lineWidth = Math.max(1.5, size * 0.045);
  context.beginPath();
  for (const side of [-1, 1]) {
    // Antlers: a stem with one tine; whiskers: a long curl out of each side of the snout.
    context.moveTo(x + side * size * 0.1, y - size * 0.18);
    context.lineTo(x + side * size * 0.2, y - size * 0.42);
    context.moveTo(x + side * size * 0.16, y - size * 0.32);
    context.lineTo(x + side * size * 0.3, y - size * 0.36);
    context.moveTo(x + side * size * 0.12, y + size * 0.14);
    context.quadraticCurveTo(x + side * size * 0.42, y + size * 0.1, x + side * size * 0.4, y + size * 0.34);
  }
  context.stroke();
  fillPath(context, PALETTE.vermilion, () => context.ellipse(x, y, size * 0.24, size * 0.24, 0, 0, Math.PI * 2));
  fillPath(context, PALETTE.coral, () => context.ellipse(x, y + size * 0.14, size * 0.17, size * 0.11, 0, 0, Math.PI * 2));
  for (const side of [-1, 1]) {
    disc(context, x + side * size * 0.1, y - size * 0.06, size * 0.06, PALETTE.ink);
    disc(context, x + side * size * 0.1, y - size * 0.06, size * 0.03, PALETTE.night);
    disc(context, x + side * size * 0.06, y + size * 0.15, size * 0.02, PALETTE.night);
  }
};

const flower: Glyph = (context, x, y, size) => {
  for (let petal = 0; petal < 6; petal += 1) {
    const angle = (petal * Math.PI * 2) / 6;
    disc(context, x + Math.cos(angle) * size * 0.19, y + Math.sin(angle) * size * 0.19, size * 0.15, PALETTE.pink);
  }
  disc(context, x, y, size * 0.12, PALETTE.amber);
};

const lantern: Glyph = (context, x, y, size) => {
  fillRoundRect(context, { x: x - size * 0.14, y: y - size * 0.36, width: size * 0.28, height: size * 0.08 }, PALETTE.amber, size * 0.03);
  fillRoundRect(context, { x: x - size * 0.14, y: y + size * 0.24, width: size * 0.28, height: size * 0.08 }, PALETTE.amber, size * 0.03);
  fillPath(context, PALETTE.coral, () => context.ellipse(x, y - size * 0.02, size * 0.27, size * 0.25, 0, 0, Math.PI * 2));
  context.fillStyle = PALETTE.amber;
  context.fillRect(x - size * 0.015, y + size * 0.32, size * 0.03, size * 0.1);
};

const coins: Glyph = (context, x, y, size) => {
  for (const [dx, dy] of [[-0.14, 0.1], [0.14, 0.1], [0, -0.12]] as const) {
    disc(context, x + dx * size, y + dy * size, size * 0.17, PALETTE.amber);
    disc(context, x + dx * size, y + dy * size, size * 0.1, withAlpha(PALETTE.copper, 0.8));
  }
};

const fish: Glyph = (context, x, y, size) => {
  fillPath(context, PALETTE.copper, () => {
    context.moveTo(x + size * 0.18, y);
    context.lineTo(x + size * 0.4, y - size * 0.16);
    context.lineTo(x + size * 0.4, y + size * 0.16);
    context.closePath();
  });
  fillPath(context, PALETTE.amber, () => context.ellipse(x - size * 0.06, y, size * 0.28, size * 0.17, 0, 0, Math.PI * 2));
  disc(context, x - size * 0.2, y - size * 0.04, size * 0.04, PALETTE.night);
};

const wild: Glyph = (context, x, y, size) => {
  drawGlow(context, x, y, size * 0.6, withAlpha(PALETTE.mint, 0.4));
  fillRoundRect(context, { x: x - size * 0.36, y: y - size * 0.3, width: size * 0.72, height: size * 0.6 }, PALETTE.mint, size * 0.14);
  drawText(context, 'WILD', x, y + size * 0.01, { size: size * 0.22, weight: 900, color: PALETTE.night });
};

const rank =
  (label: string, color: string): Glyph =>
  (context, x, y, size) =>
    drawText(context, label, x, y, { size: size * (label.length > 1 ? 0.48 : 0.58), weight: 900, color });

/** A pot coin: its pot's colour, ringed in gold when `isGold`. */
export const drawPotCoin = (context: CanvasRenderingContext2D, color: DragonPotsPotColor, isGold: boolean, x: number, y: number, size: number): void => {
  const tone = POT_TONES[color];
  drawGlow(context, x, y, size * 0.6, withAlpha(tone, 0.45));
  disc(context, x, y, size * (isGold ? 0.36 : 0.3), isGold ? PALETTE.amber : withAlpha(PALETTE.ink, 0.85));
  disc(context, x, y, size * 0.25, tone);
  disc(context, x, y, size * 0.09, withAlpha(PALETTE.night, 0.45));
};

const GLYPHS: Readonly<Record<Exclude<SymbolKind, 'coin'>, Glyph>> = {
  nine: rank('9', PALETTE.sky),
  ten: rank('10', PALETTE.lime),
  j: rank('J', PALETTE.mint),
  q: rank('Q', PALETTE.violet),
  k: rank('K', PALETTE.pink),
  a: rank('A', PALETTE.amber),
  dragon,
  flower,
  lantern,
  coins,
  fish,
  wild,
};

/** A reel symbol; a coin cell is drawn by `drawPotCoin`, which needs the coin's colour. */
export const drawSymbol = (context: CanvasRenderingContext2D, kind: Exclude<SymbolKind, 'coin'>, x: number, y: number, size: number): void =>
  GLYPHS[kind](context, x, y, size);
