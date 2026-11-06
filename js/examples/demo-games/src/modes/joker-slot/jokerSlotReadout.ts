/** The joker-slot readout: what the round paid in bets over the reels, its caps label, the status line under it. */
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawText } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame } from '../../kit/Stage';
import type { JokerSlotPhase } from './JokerSlotController';

export interface JokerSlotViewModel {
  readonly phase: JokerSlotPhase;
  readonly lastResult: string;
  readonly total: number;
  readonly spinsLeft: number | null;
}

const captionOf = ({ phase, lastResult, spinsLeft }: JokerSlotViewModel): string => {
  const bonus = spinsLeft === null ? '' : `Bonus · ${spinsLeft} ${spinsLeft === 1 ? 'spin' : 'spins'} left`;
  switch (phase) {
    case 'idle':
      return lastResult === '' ? 'Tap to spin' : `${lastResult} · tap to spin`;
    case 'spinning':
      return 'Spinning…';
    case 'lines':
      return 'Three in a line';
    case 'collecting':
      return bonus === '' ? 'The Joker collects the coins' : `${bonus} · the Joker collects`;
    case 'bonus':
      return bonus;
    case 'broken':
      return `Broken round: ${lastResult}`;
  }
};

export const drawReadout = (context: CanvasRenderingContext2D, frame: Frame, view: JokerSlotViewModel): void => {
  const { playfield, now } = frame;
  const centerX = playfield.x + playfield.width / 2;
  const top = playfield.y + 14;
  const valueSize = Math.max(30, Math.min(56, playfield.width * 0.11));
  const isBroken = view.phase === 'broken';
  drawText(context, view.spinsLeft === null ? 'WIN IN BETS' : 'BONUS WIN IN BETS', centerX, top, { size: 12, weight: 700, color: PALETTE.inkFaint });
  drawText(context, `x${view.total.toFixed(2)}`, centerX, top + valueSize * 0.85, {
    size: valueSize,
    weight: 800,
    color: isBroken ? PALETTE.coral : view.total > 0 ? PALETTE.magenta : PALETTE.ink,
  });
  const pulse = view.phase === 'idle' ? 0.55 + 0.45 * Math.sin(now / 320) : 1;
  context.globalAlpha = easeOutBack(clamp01(pulse));
  drawText(context, captionOf(view), centerX, top + valueSize * 1.7, { size: 14, weight: 600, color: isBroken ? PALETTE.coral : PALETTE.inkSoft });
  context.globalAlpha = 1;
};
