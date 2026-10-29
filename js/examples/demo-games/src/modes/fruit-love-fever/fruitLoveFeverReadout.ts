/** The readout over the reels: the round's win, the caps label above it, the status line under it. */
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawText } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame } from '../../kit/Stage';
import type { FruitLoveFeverPhase } from './FruitLoveFeverController';
import type { BonusProgress } from './fruitLoveFeverRound';

export interface FruitLoveFeverViewModel {
  readonly phase: FruitLoveFeverPhase;
  readonly lastResult: string;
  readonly totalWin: number;
  readonly spinWin: number;
  readonly currency: string;
  readonly bonus: BonusProgress | null;
  readonly stickyCells: ReadonlySet<number>;
  readonly isFastGame: boolean;
}

/** The readout's share of the playfield's top: label, number and status line. */
export const READOUT_HEIGHT = 104;

export const drawReadout = (context: CanvasRenderingContext2D, frame: Frame, view: FruitLoveFeverViewModel): void => {
  const { playfield, now } = frame;
  const centerX = playfield.x + playfield.width / 2;
  const top = playfield.y + 14;
  const valueSize = Math.max(28, Math.min(52, playfield.width * 0.1));
  const isBroken = view.phase === 'broken';
  drawText(context, view.bonus === null ? 'WIN' : 'BONUS WIN', centerX, top, { size: 12, weight: 700, color: PALETTE.inkFaint });
  drawText(context, `${view.totalWin.toFixed(2)} ${view.currency}`.trim(), centerX, top + valueSize * 0.82, {
    size: valueSize,
    weight: 800,
    color: isBroken ? PALETTE.coral : view.totalWin > 0 ? PALETTE.rose : PALETTE.ink,
  });
  const pulse = view.phase === 'idle' ? 0.55 + 0.45 * Math.sin(now / 320) : 1;
  context.globalAlpha = easeOutBack(clamp01(pulse));
  drawText(context, captionOf(view), centerX, top + valueSize * 1.62, { size: 14, weight: 600, color: isBroken ? PALETTE.coral : PALETTE.inkSoft });
  context.globalAlpha = 1;
};

const freeSpinOf = ({ played, total }: BonusProgress, offset: number): string => `Free spin ${played + offset} of ${total}`;

const captionOf = (view: FruitLoveFeverViewModel): string => {
  const { bonus } = view;
  switch (view.phase) {
    case 'idle':
      return view.lastResult === '' ? 'Tap to spin' : `${view.lastResult} · tap to spin`;
    case 'spinning':
      return bonus === null ? 'Spinning…' : freeSpinOf(bonus, 1);
    case 'paying':
      return `${bonus === null || bonus.played === 0 ? 'Lines pay' : freeSpinOf(bonus, 0)} · +${view.spinWin.toFixed(2)}`;
    case 'intro':
      return bonus === null ? 'Bonus game' : `${bonus.total} free spins · wilds stick`;
    case 'waiting':
      return bonus === null ? 'Next free spin…' : `${freeSpinOf(bonus, 1)}…`;
    case 'outro':
      return 'Bonus game over';
    case 'broken':
      return `Broken round: ${view.lastResult}`;
  }
};
