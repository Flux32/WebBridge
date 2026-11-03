/** The readout over the pots: the round's win so far, the caps label above it, the status line under it. */
import type { DragonPotsPotColor } from '@omega/webbridge-protocol';
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawText } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame } from '../../kit/Stage';
import type { DragonPotsPhase, HoldAndWinView, JackpotView } from './DragonPotsController';
import type { DragonPotsPlan } from './dragonPotsRound';

export interface DragonPotsViewModel {
  readonly phase: DragonPotsPhase;
  readonly lastResult: string;
  readonly win: number;
  readonly currency: string;
  readonly featureName: string;
  readonly plan: DragonPotsPlan | null;
  readonly pots: Readonly<Record<DragonPotsPotColor, number>>;
  readonly jackpot: JackpotView | null;
  readonly holdAndWin: HoldAndWinView | null;
  readonly isFastGame: boolean;
}

/** The readout's share of the playfield's top: label, number and status line. */
export const READOUT_HEIGHT = 96;

export const drawReadout = (context: CanvasRenderingContext2D, frame: Frame, view: DragonPotsViewModel): void => {
  const { playfield, now } = frame;
  const centerX = playfield.x + playfield.width / 2;
  const top = playfield.y + 12;
  const valueSize = Math.max(26, Math.min(44, playfield.width * 0.1));
  const isBroken = view.phase === 'broken';
  drawText(context, 'WIN', centerX, top, { size: 12, weight: 700, color: PALETTE.inkFaint });
  drawText(context, `${view.win.toFixed(2)} ${view.currency}`.trim(), centerX, top + valueSize * 0.82, {
    size: valueSize,
    weight: 800,
    color: isBroken ? PALETTE.coral : view.win > 0 ? PALETTE.vermilion : PALETTE.ink,
  });
  const pulse = view.phase === 'idle' ? 0.55 + 0.45 * Math.sin(now / 320) : 1;
  context.globalAlpha = easeOutBack(clamp01(pulse));
  drawText(context, captionOf(view), centerX, top + valueSize * 1.62, { size: 14, weight: 600, color: isBroken ? PALETTE.coral : PALETTE.inkSoft });
  context.globalAlpha = 1;
};

const captionOf = (view: DragonPotsViewModel): string => {
  switch (view.phase) {
    case 'idle':
      return view.lastResult === '' ? 'Tap to spin' : `${view.lastResult} · tap to spin`;
    case 'spinning':
      return 'Spinning…';
    case 'paying':
      return `Ways pay · +${(view.plan?.baseWin ?? 0).toFixed(2)}`;
    case 'pots':
      return view.featureName === '' ? 'Coins fly to the pots' : `${view.featureName}!`;
    case 'jackpot':
      return `Jackpot pick · ${view.jackpot?.revealed.length ?? 0} tiles`;
    case 'holdAndWin':
      return `Hold & Win · respins ${view.holdAndWin?.respinsLeft ?? 0}`;
    case 'total':
      return 'Round total';
    case 'broken':
      return `Broken round: ${view.lastResult}`;
  }
};
