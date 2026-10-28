/**
 * The plinko modes' readout in the shared style: a caps label, the big number under it and a status line.
 * Both plinko modes put it at the top of the playfield and lay the board out under it.
 */
import { drawText, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';

export interface Readout {
  readonly label: string;
  readonly value: string;
  readonly caption: string;
}

export interface ReadoutStyle {
  readonly valueColor: string;
  /** The status line pulses while the scene waits for the player. */
  readonly isWaiting: boolean;
}

const LABEL_GAP = 30;

export const readoutSizeOf = (playfield: Rect): number => Math.max(28, Math.min(52, playfield.width * 0.1));

/** Where the readout ends: the board starts below it. */
export const readoutBottomOf = (playfield: Rect): number => playfield.y + LABEL_GAP + readoutSizeOf(playfield) * 1.9;

export const drawReadout = (
  context: CanvasRenderingContext2D,
  playfield: Rect,
  now: number,
  view: Readout & ReadoutStyle,
): void => {
  const centerX = playfield.x + playfield.width / 2;
  const top = playfield.y + LABEL_GAP;
  const valueSize = readoutSizeOf(playfield);
  drawText(context, view.label, centerX, top, { size: 12, weight: 700, color: PALETTE.inkFaint });
  drawText(context, view.value, centerX, top + valueSize * 0.8, { size: valueSize, weight: 800, color: view.valueColor });
  const pulse = view.isWaiting ? 0.55 + 0.45 * Math.sin(now / 320) : 1;
  context.globalAlpha = pulse;
  drawText(context, view.caption, centerX, top + valueSize * 1.55, { size: 14, weight: 600, color: PALETTE.inkSoft });
  context.globalAlpha = 1;
};
