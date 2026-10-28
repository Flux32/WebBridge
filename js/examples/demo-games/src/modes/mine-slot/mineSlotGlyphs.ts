/**
 * Mine Slot reel symbols drawn with shapes in the shared palette: one pickaxe glyph in four tones by tier, a
 * dynamite stick, the enchantment book and the scatter gem. No textures, so the bundle stays one small file.
 */
import { drawGlow, fillRoundRect, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { PickaxeTier, ReelSymbol } from './mineSlotSymbols';

export const PICKAXE_TONES: Readonly<Record<PickaxeTier, string>> = {
  wooden: PALETTE.copper,
  stone: PALETTE.ink,
  golden: PALETTE.amber,
  enchanted: PALETTE.violet,
};

const HANDLE = withAlpha(PALETTE.copper, 0.6);
const ENCHANTED_GLOW = withAlpha(PALETTE.pink, 0.4);
const SCATTER_GLOW = withAlpha(PALETTE.mint, 0.35);
const PAGE = withAlpha(PALETTE.ink, 0.85);
/** The classic tilt of a pickaxe icon, head up and to the right; a falling pickaxe swings from it head-down. */
export const PICKAXE_REST_ANGLE = Math.PI / 4;
export const PICKAXE_BLOW_ANGLE = Math.PI * 0.8;

/** A pickaxe around (x, y): a handle and a curved head; at `angle` 0 it stands upright, head on top. */
export const drawPickaxe = (context: CanvasRenderingContext2D, tier: PickaxeTier, x: number, y: number, size: number, angle: number): void => {
  if (tier === 'enchanted') drawGlow(context, x, y, size * 0.55, ENCHANTED_GLOW);
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.lineCap = 'round';
  context.strokeStyle = HANDLE;
  context.lineWidth = size * 0.08;
  context.beginPath();
  context.moveTo(0, -size * 0.24);
  context.lineTo(0, size * 0.34);
  context.stroke();
  context.strokeStyle = PICKAXE_TONES[tier];
  context.lineWidth = size * 0.11;
  context.beginPath();
  context.moveTo(-size * 0.32, -size * 0.1);
  context.quadraticCurveTo(0, -size * 0.4, size * 0.32, -size * 0.1);
  context.stroke();
  context.restore();
};

export const drawDynamite = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  const width = size * 0.26;
  const height = size * 0.5;
  fillRoundRect(context, { x: x - width / 2, y: y - height / 2 + size * 0.06, width, height }, PALETTE.coral, width * 0.3);
  context.strokeStyle = PALETTE.ink;
  context.lineWidth = Math.max(1.5, size * 0.03);
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x, y - height / 2 + size * 0.06);
  context.quadraticCurveTo(x + size * 0.1, y - size * 0.28, x + size * 0.06, y - size * 0.34);
  context.stroke();
  drawGlow(context, x + size * 0.06, y - size * 0.34, size * 0.12, PALETTE.amber);
};

const sparklePath = (context: CanvasRenderingContext2D, x: number, y: number, radius: number): void => {
  context.beginPath();
  for (let point = 0; point < 8; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 4;
    const reach = point % 2 === 0 ? radius : radius * 0.38;
    context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  context.closePath();
};

const drawBook = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  const width = size * 0.5;
  const height = size * 0.58;
  fillRoundRect(context, { x: x - width / 2, y: y - height / 2, width, height }, PALETTE.violet, size * 0.06);
  fillRoundRect(context, { x: x + width / 2 - size * 0.08, y: y - height / 2 + size * 0.05, width: size * 0.05, height: height - size * 0.1 }, PAGE, 2);
  sparklePath(context, x - size * 0.03, y, size * 0.15);
  context.fillStyle = PALETTE.pink;
  context.fill();
};

const drawScatter = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  drawGlow(context, x, y, size * 0.5, SCATTER_GLOW);
  sparklePath(context, x, y, size * 0.34);
  context.fillStyle = PALETTE.mint;
  context.fill();
  sparklePath(context, x, y, size * 0.14);
  context.fillStyle = PALETTE.ink;
  context.fill();
};

export const drawReelSymbol = (context: CanvasRenderingContext2D, symbol: ReelSymbol, x: number, y: number, size: number): void => {
  switch (symbol.kind) {
    case 'empty':
      return;
    case 'pickaxe':
      return drawPickaxe(context, symbol.tier, x, y, size, PICKAXE_REST_ANGLE);
    case 'dynamite':
      return drawDynamite(context, x, y, size);
    case 'book':
      return drawBook(context, x, y, size);
    case 'scatter':
      return drawScatter(context, x, y, size);
  }
};
