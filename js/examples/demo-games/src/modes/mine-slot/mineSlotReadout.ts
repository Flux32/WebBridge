/** The mine-slot readout: the running coefficient over the reels, the caps label above it, the status line under it. */
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawText } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame } from '../../kit/Stage';
import type { MineSlotPhase } from './MineSlotController';
import type { MineField } from './mineSlotField';

export interface MineSlotViewModel {
  readonly phase: MineSlotPhase;
  readonly lastResult: string;
  readonly coefficient: number;
  readonly roundNumber: number;
  readonly roundCount: number;
  readonly field: MineField | null;
  readonly openedChests: ReadonlyMap<number, number>;
}

/** The readout's share of the playfield's top: label, number and status line. */
export const READOUT_HEIGHT = 104;

export const drawReadout = (context: CanvasRenderingContext2D, frame: Frame, view: MineSlotViewModel): void => {
  const { playfield, now } = frame;
  const centerX = playfield.x + playfield.width / 2;
  const top = playfield.y + 14;
  const valueSize = Math.max(28, Math.min(52, playfield.width * 0.1));
  const isBroken = view.phase === 'broken';
  drawText(context, 'COEFFICIENT', centerX, top, { size: 12, weight: 700, color: PALETTE.inkFaint });
  drawText(context, `x${view.coefficient.toFixed(2)}`, centerX, top + valueSize * 0.82, {
    size: valueSize,
    weight: 800,
    color: isBroken ? PALETTE.coral : view.coefficient > 0 ? PALETTE.copper : PALETTE.ink,
  });
  const pulse = view.phase === 'idle' ? 0.55 + 0.45 * Math.sin(now / 320) : 1;
  context.globalAlpha = easeOutBack(clamp01(pulse));
  drawText(context, captionOf(view), centerX, top + valueSize * 1.62, { size: 14, weight: 600, color: isBroken ? PALETTE.coral : PALETTE.inkSoft });
  context.globalAlpha = 1;
};

const roundOf = ({ roundNumber, roundCount }: MineSlotViewModel): string =>
  roundNumber === 1 ? `Base spin · round 1 of ${roundCount}` : `Free spin · round ${roundNumber} of ${roundCount}`;

const captionOf = (view: MineSlotViewModel): string => {
  switch (view.phase) {
    case 'idle':
      return view.lastResult === '' ? 'Tap to spin' : `${view.lastResult} · tap to spin`;
    case 'spinning':
      return view.roundCount > 1 ? roundOf(view) : 'Spinning…';
    case 'mining':
      return view.roundCount > 1 ? roundOf(view) : 'Mining…';
    case 'broken':
      return `Broken round: ${view.lastResult}`;
  }
};
