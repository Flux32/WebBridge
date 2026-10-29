/**
 * Fruit Love Fever symbols drawn with shapes in the shared palette — a heart for the wild, a hibiscus for
 * the scatter, the fruits, the mojito, the bra and the card ranks. No textures: the bundle stays one file.
 */
import { drawGlow, drawText, fillRoundRect, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { ReelSymbol, SymbolKind } from './fruitLoveFeverSymbols';

type Glyph = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => void;

const LEAF = PALETTE.mint;
const GLASS = withAlpha(PALETTE.sky, 0.42);
const HEART_GLOW = withAlpha(PALETTE.rose, 0.45);
const SCATTER_GLOW = withAlpha(PALETTE.amber, 0.4);


const fillPath = (context: CanvasRenderingContext2D, color: string, path: () => void): void => {
  context.beginPath();
  path();
  context.fillStyle = color;
  context.fill();
};

/** A heart around (x, y), `size` wide: two lobes and a point. */
export const heartPath = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  const half = size / 2;
  context.moveTo(x, y + half * 0.8);
  context.bezierCurveTo(x - half * 1.3, y - half * 0.05, x - half * 0.55, y - half * 1.05, x, y - half * 0.4);
  context.bezierCurveTo(x + half * 0.55, y - half * 1.05, x + half * 1.3, y - half * 0.05, x, y + half * 0.8);
  context.closePath();
};

const leaves = (context: CanvasRenderingContext2D, x: number, y: number, size: number, count: number): void => {
  for (let leaf = 0; leaf < count; leaf += 1) {
    const angle = ((leaf - (count - 1) / 2) * Math.PI) / 7;
    fillPath(context, LEAF, () => context.ellipse(x + Math.sin(angle) * size * 0.1, y, size * 0.06, size * 0.17, angle, 0, Math.PI * 2));
  }
};

const pineapple: Glyph = (context, x, y, size) => {
  leaves(context, x, y - size * 0.24, size, 3);
  fillPath(context, PALETTE.copper, () => context.ellipse(x, y + size * 0.08, size * 0.22, size * 0.28, 0, 0, Math.PI * 2));
  context.strokeStyle = withAlpha(PALETTE.night, 0.35);
  context.lineWidth = Math.max(1, size * 0.025);
  for (let line = -1; line <= 1; line += 1) {
    context.beginPath();
    context.moveTo(x - size * 0.2, y + line * size * 0.12 - size * 0.04);
    context.lineTo(x + size * 0.2, y + line * size * 0.12 + size * 0.2);
    context.moveTo(x + size * 0.2, y + line * size * 0.12 - size * 0.04);
    context.lineTo(x - size * 0.2, y + line * size * 0.12 + size * 0.2);
    context.stroke();
  }
};

const banana: Glyph = (context, x, y, size) =>
  fillPath(context, PALETTE.amber, () => {
    context.arc(x - size * 0.1, y - size * 0.12, size * 0.38, Math.PI * 0.05, Math.PI * 0.85);
    context.arc(x - size * 0.1, y - size * 0.28, size * 0.38, Math.PI * 0.8, Math.PI * 0.1, true);
  });

const coconut: Glyph = (context, x, y, size) => {
  fillPath(context, PALETTE.copper, () => context.arc(x, y, size * 0.34, 0, Math.PI * 2));
  fillPath(context, PALETTE.ink, () => context.arc(x, y, size * 0.25, 0, Math.PI * 2));
  fillPath(context, withAlpha(PALETTE.sky, 0.3), () => context.arc(x, y, size * 0.13, 0, Math.PI * 2));
};

const strawberry: Glyph = (context, x, y, size) => {
  fillPath(context, PALETTE.coral, () => heartPath(context, x, y + size * 0.06, size * 0.7));
  context.fillStyle = withAlpha(PALETTE.amber, 0.85);
  for (const [dx, dy] of [[-0.12, 0], [0.12, 0], [0, 0.12], [-0.06, 0.22], [0.06, 0.22], [0, -0.06]] as const) {
    context.fillRect(x + dx * size - 1, y + dy * size - 1, 2.5, 2.5);
  }
  leaves(context, x, y - size * 0.22, size * 0.8, 3);
};

const mojito: Glyph = (context, x, y, size) => {
  context.strokeStyle = PALETTE.lime;
  context.lineWidth = Math.max(1.5, size * 0.04);
  context.beginPath();
  context.moveTo(x + size * 0.08, y + size * 0.2);
  context.lineTo(x + size * 0.22, y - size * 0.38);
  context.stroke();
  fillPath(context, GLASS, () => {
    context.moveTo(x - size * 0.24, y - size * 0.22);
    context.lineTo(x + size * 0.24, y - size * 0.22);
    context.lineTo(x + size * 0.17, y + size * 0.32);
    context.lineTo(x - size * 0.17, y + size * 0.32);
    context.closePath();
  });
  leaves(context, x - size * 0.04, y - size * 0.06, size * 0.7, 2);
  fillPath(context, PALETTE.lime, () => context.arc(x - size * 0.22, y - size * 0.24, size * 0.1, 0, Math.PI * 2));
};

const bra: Glyph = (context, x, y, size) => {
  context.strokeStyle = PALETTE.pink;
  context.lineWidth = Math.max(1.5, size * 0.035);
  context.beginPath();
  context.moveTo(x - size * 0.3, y);
  context.lineTo(x - size * 0.22, y - size * 0.3);
  context.moveTo(x + size * 0.3, y);
  context.lineTo(x + size * 0.22, y - size * 0.3);
  context.stroke();
  for (const side of [-1, 1]) {
    fillPath(context, PALETTE.pink, () => context.arc(x + side * size * 0.17, y, size * 0.17, 0, Math.PI));
  }
  fillPath(context, PALETTE.rose, () => heartPath(context, x, y + size * 0.03, size * 0.12));
};

const wild: Glyph = (context, x, y, size) => {
  drawGlow(context, x, y, size * 0.6, HEART_GLOW);
  fillPath(context, PALETTE.rose, () => heartPath(context, x, y, size * 0.86));
  drawText(context, 'WILD', x, y - size * 0.04, { size: size * 0.2, weight: 900 });
};

const scatter: Glyph = (context, x, y, size) => {
  drawGlow(context, x, y, size * 0.6, SCATTER_GLOW);
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = -Math.PI / 2 + (petal * Math.PI * 2) / 5;
    fillPath(context, PALETTE.rose, () => context.arc(x + Math.cos(angle) * size * 0.2, y + Math.sin(angle) * size * 0.2, size * 0.17, 0, Math.PI * 2));
  }
  fillPath(context, PALETTE.amber, () => context.arc(x, y, size * 0.11, 0, Math.PI * 2));
  drawText(context, 'FREE', x, y + size * 0.43, { size: size * 0.13, weight: 900, color: PALETTE.amber });
};

const rank =
  (label: string, color: string): Glyph =>
  (context, x, y, size) =>
    drawText(context, label, x, y, { size: size * 0.58, weight: 900, color });

const GLYPHS: Readonly<Record<SymbolKind, Glyph>> = {
  wild,
  pineapple,
  banana,
  coconut,
  strawberry,
  mojito,
  bra,
  a: rank('A', PALETTE.violet),
  k: rank('K', PALETTE.sky),
  q: rank('Q', PALETTE.mint),
  j: rank('J', PALETTE.lime),
  ten: rank('10', PALETTE.amber),
  scatter,
};

export const drawSymbol = (context: CanvasRenderingContext2D, symbol: ReelSymbol, x: number, y: number, size: number): void => {
  GLYPHS[symbol.kind](context, x, y, size);
  if (symbol.multiplier !== null) drawMultiplier(context, `x${symbol.multiplier}`, x + size * 0.3, y + size * 0.32, size);
};

const drawMultiplier = (context: CanvasRenderingContext2D, label: string, x: number, y: number, size: number): void => {
  const width = size * 0.36;
  const height = size * 0.22;
  fillRoundRect(context, { x: x - width / 2, y: y - height / 2, width, height }, PALETTE.amber, height / 2);
  drawText(context, label, x, y, { size: height * 0.72, weight: 900, color: PALETTE.night });
};
