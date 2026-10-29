/**
 * What the view draws over the reels: the free-spin counter strip, the lock on each sticky wild, the paying
 * lines and the bonus banners (intro and total).
 */
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawGlow, drawText, fillRoundRect, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import { heartPath } from './fruitLoveFeverGlyphs';
import { cellCenter, cellRect, type FruitLayout } from './fruitLoveFeverLayout';
import type { BonusProgress, WinLinePlan } from './fruitLoveFeverRound';

const LINE_COLORS = [PALETTE.amber, PALETTE.mint, PALETTE.sky, PALETTE.pink, PALETTE.lime, PALETTE.violet] as const;
const LOCK_TINT = withAlpha(PALETTE.rose, 0.16);
const BANNER_SHADE = withAlpha(PALETTE.night, 0.62);

export interface Banner {
  readonly title: string;
  readonly value: string;
  /** 0…1 through the banner's life: it pops in, holds, then fades. */
  progress: number;
}

/** "FREE SPIN 3 / 10" and the locked wilds, while a bonus game runs. */
export const drawCounter = (context: CanvasRenderingContext2D, layout: FruitLayout, bonus: BonusProgress | null, locked: number): void => {
  if (bonus === null) return;
  const { counter } = layout;
  fillRoundRect(context, counter, withAlpha(PALETTE.rose, 0.18), counter.height / 2);
  const text = `FREE SPIN ${bonus.played} / ${bonus.total}   ·   ♥ ${locked} LOCKED`;
  drawText(context, text, counter.x + counter.width / 2, counter.y + counter.height / 2, { size: 13, weight: 800, color: PALETTE.rose });
};

/** A sticky wild sits in a tinted cell with a rose frame and a heart badge: it will not move this bonus. */
export const drawLocks = (context: CanvasRenderingContext2D, layout: FruitLayout, cells: ReadonlySet<number>): void => {
  for (const cell of cells) {
    const rect = cellRect(layout, cell);
    fillRoundRect(context, rect, LOCK_TINT, 12);
    strokeRoundRect(context, rect, PALETTE.rose, 3, 12);
    const badge = layout.cell * 0.2;
    context.beginPath();
    heartPath(context, rect.x + badge * 0.75, rect.y + badge * 0.75, badge);
    context.fillStyle = PALETTE.rose;
    context.fill();
  }
};

/** Each paying line drawn through its cells in its own colour; `progress` draws them on one after another. */
export const drawLines = (context: CanvasRenderingContext2D, layout: FruitLayout, lines: readonly WinLinePlan[], progress: number): void => {
  lines.forEach((line, index) => {
    const reveal = clamp01(progress * lines.length - index);
    if (reveal <= 0) return;
    const color = LINE_COLORS[index % LINE_COLORS.length]!;
    context.globalAlpha = reveal;
    for (const cell of line.cells) strokeRoundRect(context, cellRect(layout, cell), color, 2.5, 12);
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.lineJoin = 'round';
    context.beginPath();
    line.cells.forEach((cell, step) => {
      const { x, y } = cellCenter(layout, cell);
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.globalAlpha = 1;
  });
};

export const drawBanner = (context: CanvasRenderingContext2D, area: Rect, banner: Banner | null): void => {
  if (banner === null) return;
  const fadeOut = clamp01((1 - banner.progress) / 0.2);
  const scale = easeOutBack(clamp01(banner.progress / 0.3));
  context.globalAlpha = fadeOut;
  fillRoundRect(context, area, BANNER_SHADE, 16);
  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  drawGlow(context, centerX, centerY, area.width * 0.4, withAlpha(PALETTE.rose, 0.35));
  const valueSize = Math.min(64, area.height * 0.34) * scale;
  drawText(context, banner.title, centerX, centerY - area.height * 0.2, { size: 15, weight: 800, color: PALETTE.amber });
  drawText(context, banner.value, centerX, centerY + area.height * 0.06, { size: Math.max(1, valueSize), weight: 900, color: PALETTE.ink });
  context.globalAlpha = 1;
};
