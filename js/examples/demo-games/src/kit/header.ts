/** The header every demo game shares: the mode pill and the live backend feed under it. */
import type { FeedLine } from './BackendFeed';
import { fillRoundRect, drawText, withAlpha } from './paint';
import { font, MONO_FAMILY, PALETTE } from './palette';
import type { Frame } from './Stage';

export interface HeaderModel {
  readonly title: string;
  readonly accent: string;
  readonly feed: readonly FeedLine[];
}

const PILL_HEIGHT = 26;
const LINE_HEIGHT = 15;

/** Cuts the line to the width with an ellipsis; the font must be set on the context already. */
const fitToWidth = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (context.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && context.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 4;
  return `${text.slice(0, Math.max(1, end))}…`;
};

export const drawHeader = (context: CanvasRenderingContext2D, frame: Frame, header: HeaderModel): void => {
  const { x, y, width } = frame.content;
  const label = `DEMO · ${header.title.toUpperCase()}`;
  context.font = font(800, 11.5);
  const pillWidth = context.measureText(label).width + 26;
  fillRoundRect(context, { x, y, width: pillWidth, height: PILL_HEIGHT }, withAlpha(header.accent, 0.18), PILL_HEIGHT / 2);
  context.fillStyle = header.accent;
  context.beginPath();
  context.arc(x + 11, y + PILL_HEIGHT / 2, 3, 0, Math.PI * 2);
  context.fill();
  drawText(context, label, x + 18, y + PILL_HEIGHT / 2 + 0.5, { size: 11.5, weight: 800, align: 'left', color: PALETTE.ink });

  const newest = header.feed.length - 1;
  header.feed.forEach((line, index) => {
    const age = newest - index;
    const arrow = line.direction === 'in' ? '←' : '→';
    const color = line.direction === 'in' ? PALETTE.inkSoft : header.accent;
    context.globalAlpha = Math.max(0.25, 1 - age * 0.2);
    context.font = font(500, 10.5, MONO_FAMILY);
    const text = fitToWidth(context, `${arrow} ${line.text}`, width - 4);
    drawText(context, text, x + 2, y + PILL_HEIGHT + 14 + index * LINE_HEIGHT, {
      size: 10.5,
      weight: 500,
      family: MONO_FAMILY,
      align: 'left',
      color,
    });
  });
  context.globalAlpha = 1;
};
