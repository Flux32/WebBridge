/** The slot-coin readout: the round multiplier over the reels, the caps label above it, the status line under it. */
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawText } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame } from '../../kit/Stage';
import type { SlotCoinPhase } from './SlotCoinController';

export interface SlotCoinViewModel {
  readonly phase: SlotCoinPhase;
  readonly lastResult: string;
  readonly multiplier: number;
  readonly boardNumber: number;
  readonly boardCount: number;
}

export const drawReadout = (context: CanvasRenderingContext2D, frame: Frame, view: SlotCoinViewModel): void => {
  const { playfield, now } = frame;
  const centerX = playfield.x + playfield.width / 2;
  const top = playfield.y + 14;
  const valueSize = Math.max(30, Math.min(56, playfield.width * 0.11));
  const isBroken = view.phase === 'broken';
  drawText(context, 'MULTIPLIER', centerX, top, { size: 12, weight: 700, color: PALETTE.inkFaint });
  drawText(context, `x${view.multiplier.toFixed(2)}`, centerX, top + valueSize * 0.85, {
    size: valueSize,
    weight: 800,
    color: isBroken ? PALETTE.coral : view.multiplier > 0 ? PALETTE.amber : PALETTE.ink,
  });
  const pulse = view.phase === 'idle' ? 0.55 + 0.45 * Math.sin(now / 320) : 1;
  context.globalAlpha = easeOutBack(clamp01(pulse));
  drawText(context, captionOf(view), centerX, top + valueSize * 1.7, { size: 14, weight: 600, color: isBroken ? PALETTE.coral : PALETTE.inkSoft });
  context.globalAlpha = 1;
};

const captionOf = ({ phase, lastResult, boardNumber, boardCount }: SlotCoinViewModel): string => {
  switch (phase) {
    case 'idle':
      return lastResult === '' ? 'Tap to spin' : `${lastResult} · tap to spin`;
    case 'spinning':
      return boardCount > 1 ? `Board ${boardNumber} of ${boardCount}` : 'Spinning…';
    case 'collecting':
      return 'Coins fly to the trigger';
    case 'broken':
      return `Broken round: ${lastResult}`;
  }
};
