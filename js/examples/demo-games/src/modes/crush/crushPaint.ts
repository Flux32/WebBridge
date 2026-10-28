/** Crush's static drawing: the row of coefficient tiles and the readout above it. */
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawText, fillRoundRect, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame } from '../../kit/Stage';
import type { CrushViewModel } from './CrushView';
import { START_STEP } from './crushRound';

export interface Track {
  readonly tile: number;
  readonly pitch: number;
  readonly centerY: number;
  readonly focusX: number;
}

export const trackOf = (playfield: Rect): Track => {
  const tile = Math.max(56, Math.min(128, playfield.width / 4.6, playfield.height * 0.3));
  return {
    tile,
    pitch: tile * 1.28,
    centerY: playfield.y + playfield.height * 0.66,
    focusX: playfield.x + playfield.width * 0.36,
  };
};

export interface TileRow {
  readonly track: Track;
  /** The step the row is centred on, fractional while it scrolls. */
  readonly camera: number;
  readonly view: CrushViewModel;
}

export const tileX = (track: Track, camera: number, step: number): number => track.focusX + (step - camera) * track.pitch;

export const drawTiles = (context: CanvasRenderingContext2D, frame: Frame, { track, camera, view }: TileRow): void => {
  const { round } = view;
  const isCrushed = view.phase === 'crushed';
  const first = Math.max(START_STEP, Math.floor(camera) - 3);
  const last = Math.min(round.steps.length - 1, Math.ceil(camera) + 6);
  const size = track.tile;
  for (let step = first; step <= last; step += 1) {
    const x = tileX(track, camera, step);
    if (x < frame.playfield.x - size || x > frame.viewport.width + size) continue;
    const rect = { x: x - size / 2, y: track.centerY - size / 2, width: size, height: size };
    const isFatal = isCrushed && step === round.step;
    const isPassed = step <= round.step && !isFatal;
    const isNext = step === round.step + 1 && !isCrushed;
    const tone = isFatal ? PALETTE.coral : PALETTE.mint;
    fillRoundRect(context, rect, isPassed || isFatal ? withAlpha(tone, 0.18) : PALETTE.panel);
    if (isPassed || isFatal) strokeRoundRect(context, rect, withAlpha(tone, 0.7), 1.5);
    if (isNext) strokeRoundRect(context, rect, PALETTE.coral, 2.5);
    const label = step === START_STEP ? 'START' : `x${(round.steps[step] ?? 0).toFixed(2)}`;
    drawText(context, label, x, track.centerY - size * 0.04, {
      size: size * (step === START_STEP ? 0.17 : 0.22),
      weight: 800,
      color: isPassed || isFatal ? tone : PALETTE.ink,
    });
    if (step >= 0) drawText(context, `STEP ${step + 1}`, x, track.centerY + size * 0.26, { size: size * 0.11, color: PALETTE.inkFaint });
  }
};

export const drawReadout = (context: CanvasRenderingContext2D, frame: Frame, view: CrushViewModel): void => {
  const { playfield, now } = frame;
  const centerX = playfield.x + playfield.width / 2;
  const top = playfield.y + playfield.height * 0.16;
  const coefficient = view.round.coefficient;
  const valueSize = Math.max(30, Math.min(64, playfield.width * 0.11));
  drawText(context, 'MULTIPLIER', centerX, top, { size: 12, weight: 700, color: PALETTE.inkFaint });
  drawText(context, coefficient === null ? 'x1.00' : `x${coefficient.toFixed(2)}`, centerX, top + valueSize * 0.85, {
    size: valueSize,
    weight: 800,
    color: view.phase === 'crushed' ? PALETTE.coral : PALETTE.ink,
  });
  const pulse = view.phase === 'idle' ? 0.55 + 0.45 * Math.sin(now / 320) : 1;
  context.globalAlpha = easeOutBack(clamp01(pulse));
  drawText(context, captionOf(view), centerX, top + valueSize * 1.7, { size: 14, weight: 600, color: PALETTE.inkSoft });
  context.globalAlpha = 1;
};

const captionOf = ({ round, phase, lastResult }: CrushViewModel): string => {
  switch (phase) {
    case 'idle':
      return lastResult === '' ? 'Tap to play' : `Last round: ${lastResult} · tap to play`;
    case 'playing':
      return `Step ${round.step + 1} of ${round.steps.length} · tap to step on`;
    case 'crushed':
      return 'Crushed!';
    case 'won':
      return 'Top of the ladder!';
    case 'bonus':
      return 'Bonus series';
  }
};
