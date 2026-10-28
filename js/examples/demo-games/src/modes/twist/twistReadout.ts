/** The twist readout: the board's multiplier, the caps label above it, the status line under it. */
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawText } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame } from '../../kit/Stage';
import type { TwistPhase } from './TwistController';
import type { SeriesCount } from './twistSeries';
import { progressCoefficient, type TwistProgress } from './twistTable';

export interface TwistViewModel {
  readonly phase: TwistPhase;
  readonly progress: TwistProgress;
  readonly lastResult: string;
  readonly series: SeriesCount | null;
}

const ALERT_PHASES: ReadonlySet<TwistPhase> = new Set(['lost', 'broken']);

export const drawTwistReadout = (context: CanvasRenderingContext2D, frame: Frame, view: TwistViewModel): void => {
  const { playfield, now } = frame;
  const centerX = playfield.x + playfield.width / 2;
  const top = playfield.y + 14;
  const valueSize = Math.max(30, Math.min(56, playfield.width * 0.11));
  const coefficient = progressCoefficient(view.progress);
  const isAlert = ALERT_PHASES.has(view.phase);
  drawText(context, 'MULTIPLIER', centerX, top, { size: 12, weight: 700, color: PALETTE.inkFaint });
  drawText(context, `x${coefficient.toFixed(2)}`, centerX, top + valueSize * 0.85, {
    size: valueSize,
    weight: 800,
    color: isAlert ? PALETTE.coral : coefficient > 0 ? PALETTE.mint : PALETTE.ink,
  });
  const isWaiting = view.phase === 'idle' || view.phase === 'playing';
  context.globalAlpha = isWaiting ? easeOutBack(clamp01(0.55 + 0.45 * Math.sin(now / 320))) : 1;
  drawText(context, captionOf(view), centerX, top + valueSize * 1.7, {
    size: 14,
    weight: 600,
    color: isAlert ? PALETTE.coral : PALETTE.inkSoft,
  });
  context.globalAlpha = 1;
};

const captionOf = ({ phase, lastResult, series }: TwistViewModel): string => {
  switch (phase) {
    case 'idle':
      return lastResult === '' ? 'Tap to spin' : `${lastResult} · tap to spin`;
    case 'playing':
      return 'Tap to spin again · or cash out';
    case 'spinning':
      return 'Spinning…';
    case 'lost':
      return 'Death!';
    case 'bonus':
      if (series === null) return 'Free spins';
      return series.completed === 0 ? `${series.total} free spins coming` : `Free spin ${series.completed} of ${series.total}`;
    case 'bonusEnded':
      return 'Series played · the host settles it';
    case 'broken':
      return `Broken: ${lastResult}`;
  }
};
