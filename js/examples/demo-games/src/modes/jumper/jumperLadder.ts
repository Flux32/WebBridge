/**
 * The ladder under the readout: a window of platforms that follows the camera, the player's row kept in
 * the lower part of it, with the round's accelerator slots beside the platforms.
 */
import { drawText, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import { drawPlatform, drawSlot, type PlatformTone } from './jumperPaint';
import { START_STEP } from './jumperRoute';
import type { JumperScene } from './jumperScene';

/** A platform's thickness as a share of its row. */
export const PLATFORM_SHARE = 0.38;
/** Rows of the ladder under the player's row. */
const ROWS_BELOW = 1.4;
const READOUT_HEIGHT = 112;

export interface LadderLayout {
  readonly area: Rect;
  readonly centerX: number;
  readonly rowHeight: number;
  readonly platformWidth: number;
  rowY(step: number): number;
}

/** Where the player is on the ladder: `camera` scrolls it, `position` is the (fractional) step stood on. */
export interface LadderFocus {
  readonly camera: number;
  readonly position: number;
}

export const ladderLayout = (playfield: Rect, camera: number): LadderLayout => {
  const area = { ...playfield, y: playfield.y + READOUT_HEIGHT, height: Math.max(0, playfield.height - READOUT_HEIGHT) };
  const rowHeight = Math.max(40, Math.min(66, area.height / 6.2));
  const anchorY = area.y + area.height - rowHeight * ROWS_BELOW;
  return {
    area,
    centerX: area.x + area.width / 2,
    rowHeight,
    platformWidth: Math.min(200, area.width * 0.5),
    rowY: (step) => anchorY - (step - camera) * rowHeight,
  };
};

const toneOf = (step: number, scene: JumperScene, position: number): PlatformTone => {
  if (scene.collisionStep === step && scene.phase === 'fell') return 'fatal';
  if (step <= Math.round(position) && step !== START_STEP) return 'passed';
  const isWaiting = scene.phase === 'open' || scene.phase === 'playing';
  return isWaiting && step === Math.round(position) + 1 ? 'next' : 'ahead';
};

const drawStepNumber = (context: CanvasRenderingContext2D, layout: LadderLayout, step: number, y: number): void => {
  const x = layout.centerX - layout.platformWidth / 2 - 14;
  drawText(context, `${step + 1}`, x, y, { size: 11, weight: 600, align: 'right', color: PALETTE.inkFaint });
};

/** A slot the player has not reached yet stays a question mark mid-jump, though the move revealed it. */
const drawSlots = (context: CanvasRenderingContext2D, layout: LadderLayout, scene: JumperScene, position: number): void => {
  const x = layout.centerX + layout.platformWidth / 2 + 24;
  const size = Math.min(13, layout.rowHeight * 0.22);
  for (const slot of scene.slots) {
    drawSlot(context, slot.step <= position + 0.5 ? slot.state : 'HIDDEN', x, layout.rowY(slot.step), size);
  }
};

export const drawLadder = (context: CanvasRenderingContext2D, layout: LadderLayout, scene: JumperScene, focus: LadderFocus): void => {
  const first = Math.max(START_STEP, Math.floor(focus.camera - ROWS_BELOW - 1));
  const last = Math.min(scene.ladder.length - 1, Math.ceil(focus.camera + layout.area.height / layout.rowHeight));
  const height = layout.rowHeight * PLATFORM_SHARE;
  for (let step = first; step <= last; step += 1) {
    const y = layout.rowY(step);
    const label = step === START_STEP ? 'START' : `x${(scene.ladder[step] ?? 0).toFixed(2)}`;
    const tone = toneOf(step, scene, focus.position);
    drawPlatform(context, { x: layout.centerX, y, width: layout.platformWidth, height, label, tone });
    if (step >= 0) drawStepNumber(context, layout, step, y);
  }
  drawSlots(context, layout, scene, focus.position);
};
