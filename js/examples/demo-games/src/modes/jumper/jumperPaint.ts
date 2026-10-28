/** Jumper's shapes in the shared look: a platform per step, accelerator icons and the round jumper. */
import type { JumperSlotState } from '@omega/webbridge-protocol';
import { drawText, fillRoundRect, strokeRoundRect, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';

export type PlatformTone = 'ahead' | 'next' | 'passed' | 'fatal';

export interface PlatformPaint {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly tone: PlatformTone;
}

const TONE_COLORS: Readonly<Record<PlatformTone, string>> = {
  ahead: PALETTE.ink,
  next: PALETTE.ink,
  passed: PALETTE.pink,
  fatal: PALETTE.coral,
};

export const drawPlatform = (context: CanvasRenderingContext2D, platform: PlatformPaint): void => {
  const { x, y, width, height, tone } = platform;
  const rect = { x: x - width / 2, y: y - height / 2, width, height };
  const isMarked = tone === 'passed' || tone === 'fatal';
  fillRoundRect(context, rect, isMarked ? withAlpha(TONE_COLORS[tone], 0.18) : PALETTE.panel, height / 2);
  if (isMarked) strokeRoundRect(context, rect, withAlpha(TONE_COLORS[tone], 0.7), 1.5, height / 2);
  if (tone === 'next') strokeRoundRect(context, rect, PALETTE.pink, 2.5, height / 2);
  drawText(context, platform.label, x, y + 0.5, { size: height * 0.52, weight: 800, color: TONE_COLORS[tone] });
};

const drawTrampoline = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  context.strokeStyle = PALETTE.mint;
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x - size, y - size * 0.2);
  context.quadraticCurveTo(x, y + size * 0.5, x + size, y - size * 0.2);
  context.moveTo(x - size * 0.7, y + size * 0.1);
  context.lineTo(x - size * 0.8, y + size * 0.8);
  context.moveTo(x + size * 0.7, y + size * 0.1);
  context.lineTo(x + size * 0.8, y + size * 0.8);
  context.stroke();
  context.lineCap = 'butt';
};

const drawJetpack = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  const tank = { width: size * 0.62, height: size * 1.3 };
  fillRoundRect(context, { x: x - tank.width - 1, y: y - size * 0.8, ...tank }, PALETTE.amber, tank.width / 2);
  fillRoundRect(context, { x: x + 1, y: y - size * 0.8, ...tank }, PALETTE.amber, tank.width / 2);
  context.fillStyle = PALETTE.coral;
  context.beginPath();
  context.moveTo(x - size * 0.6, y + size * 0.55);
  context.lineTo(x, y + size * 1.05);
  context.lineTo(x + size * 0.6, y + size * 0.55);
  context.fill();
};

const drawRocket = (context: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  context.fillStyle = PALETTE.coral;
  context.beginPath();
  context.moveTo(x, y - size);
  context.quadraticCurveTo(x + size * 0.6, y - size * 0.2, x + size * 0.45, y + size * 0.6);
  context.lineTo(x - size * 0.45, y + size * 0.6);
  context.quadraticCurveTo(x - size * 0.6, y - size * 0.2, x, y - size);
  context.fill();
  context.fillStyle = PALETTE.ink;
  context.beginPath();
  context.arc(x, y - size * 0.15, size * 0.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = PALETTE.amber;
  context.fillRect(x - size * 0.25, y + size * 0.6, size * 0.5, size * 0.35);
};

/** An accelerator slot; a hidden one is a question mark until the player lands on it or flies over it. */
export const drawSlot = (context: CanvasRenderingContext2D, state: JumperSlotState, x: number, y: number, size: number): void => {
  if (state === 'TRAMPOLINE') return drawTrampoline(context, x, y, size);
  if (state === 'JETPACK') return drawJetpack(context, x, y, size);
  if (state === 'ROCKET') return drawRocket(context, x, y, size);
  const box = { x: x - size, y: y - size, width: size * 2, height: size * 2 };
  if (state === 'NONE') return strokeRoundRect(context, box, PALETTE.inkFaint, 1.5, size * 0.6);
  fillRoundRect(context, box, PALETTE.panel, size * 0.6);
  drawText(context, '?', x, y + 0.5, { size: size * 1.2, weight: 800, color: PALETTE.inkFaint });
};

export interface JumperPose {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Landing squash, 0..1. */
  readonly squash: number;
  readonly alpha: number;
}

/** The round jumper: a pink ball with eyes looking up the ladder. */
export const drawJumper = (context: CanvasRenderingContext2D, pose: JumperPose): void => {
  const { x, y, radius, squash } = pose;
  context.save();
  context.globalAlpha = pose.alpha;
  context.translate(x, y + radius * squash);
  context.scale(1 + squash * 0.45, 1 - squash);
  const gradient = context.createRadialGradient(-radius * 0.35, -radius * 0.4, radius * 0.1, 0, 0, radius);
  gradient.addColorStop(0, PALETTE.ink);
  gradient.addColorStop(0.25, PALETTE.pink);
  gradient.addColorStop(1, PALETTE.violet);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  for (const side of [-1, 1]) {
    context.fillStyle = PALETTE.ink;
    context.beginPath();
    context.arc(side * radius * 0.34, -radius * 0.12, radius * 0.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.night;
    context.beginPath();
    context.arc(side * radius * 0.34, -radius * 0.2, radius * 0.1, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
};
