/** The big number over the ladder, as in every demo game: caps label, the coefficient, a status line. */
import { clamp01 } from '../../kit/easing';
import { drawText } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame } from '../../kit/Stage';
import type { JumperScene } from './jumperScene';

const captionOf = (scene: JumperScene): string => {

  switch (scene.phase) {
    case 'waiting':
      return 'Waiting for the host…';
    case 'idle':
      return scene.note === '' ? 'Tap to play' : `Last round: ${scene.note} · tap to play`;
    case 'open':
      return 'Round open · first jump';
    case 'playing':
      return scene.difficulty === null ? 'Tap to jump on' : `${scene.difficulty} · tap to jump on`;
    case 'fell':
      return `Fell on step ${(scene.collisionStep ?? 0) + 1}`;
    case 'won':
      return 'Top of the ladder!';
    case 'cashed':
      return 'Cashed out';
    case 'bonus':
      return scene.note;
  }
};

export const drawReadout = (context: CanvasRenderingContext2D, frame: Frame, scene: JumperScene): void => {
  const { playfield, now } = frame;
  const centerX = playfield.x + playfield.width / 2;
  const top = playfield.y + 10;
  const valueSize = Math.max(30, Math.min(56, playfield.width * 0.11));
  const isFell = scene.phase === 'fell';
  drawText(context, scene.phase === 'bonus' ? 'FREE GAME' : 'MULTIPLIER', centerX, top, {
    size: 12,
    weight: 700,
    color: PALETTE.inkFaint,
  });
  const value = scene.coefficient === null ? 'x1.00' : `x${scene.coefficient.toFixed(2)}`;
  drawText(context, value, centerX, top + valueSize * 0.85, {
    size: valueSize,
    weight: 800,
    color: isFell ? PALETTE.coral : PALETTE.ink,
  });
  const pulse = scene.phase === 'idle' ? 0.55 + 0.45 * Math.sin(now / 320) : 1;
  context.globalAlpha = clamp01(pulse);
  drawText(context, captionOf(scene), centerX, top + valueSize * 1.7, { size: 14, weight: 600, color: PALETTE.inkSoft });
  context.globalAlpha = 1;
};
