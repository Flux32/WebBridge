/**
 * Canvas 2D picture of the scene: a window of the ladder that follows the player, the slots, the
 * player and a HUD with the coefficient. Sizes are in CSS pixels; the surface scales for the DPR.
 */
import type { JumperSlot, JumperSlotState } from '@omega/webbridge-protocol';
import type { JumperScene } from '../scene/JumperScene';
import type { MotionFrame } from '../scene/PlayerMotion';
import { START_STEP } from '../scene/routes';

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** Rows of the ladder in view; the camera keeps the player in the lower third. */
const VISIBLE_ROWS = 9;
const ROWS_BELOW_PLAYER = 2.5;
/** The top of the canvas is the HUD, the bottom is left to the shell's bet bar. */
const HUD_SHARE = 0.16;
const BET_BAR_SHARE = 0.26;

const COLORS = {
  background: '#10131a',
  platform: '#3a4560',
  platformReached: '#5b7bd5',
  text: '#c9d1e0',
  textDim: '#6c768c',
  player: '#ffd54f',
  collision: '#ff5252',
} as const;

const SLOT_STYLE: Readonly<Record<JumperSlotState, { fill: string; label: string }>> = {
  HIDDEN: { fill: '#4a5068', label: '?' },
  NONE: { fill: '#2b3040', label: '·' },
  TRAMPOLINE: { fill: '#43a047', label: 'T' },
  JETPACK: { fill: '#fb8c00', label: 'J' },
  ROCKET: { fill: '#e53935', label: 'R' },
};

interface Layout {
  readonly rowHeight: number;
  readonly centerX: number;
  readonly platformWidth: number;
  /** Canvas y of a (fractional) step. */
  rowY(step: number): number;
}

const layoutOf = (viewport: Viewport, cameraStep: number): Layout => {
  const top = viewport.height * HUD_SHARE;
  const bottom = viewport.height * (1 - BET_BAR_SHARE);
  const rowHeight = (bottom - top) / VISIBLE_ROWS;
  const baseStep = cameraStep - ROWS_BELOW_PLAYER;
  return {
    rowHeight,
    centerX: viewport.width / 2,
    platformWidth: Math.min(viewport.width * 0.42, 260),
    rowY: (step) => bottom - (step - baseStep) * rowHeight,
  };
};

/**
 * A slot the player has not reached yet stays a question mark mid-jump, even when the move's
 * payload has already revealed it.
 */
const visibleSlotState = (slot: JumperSlot, position: number): JumperSlotState =>
  slot.step <= position + 0.5 ? slot.state : 'HIDDEN';

const drawPlatform = (context: CanvasRenderingContext2D, layout: Layout, step: number, coefficient: string) => {
  const y = layout.rowY(step);
  const halfWidth = layout.platformWidth / 2;
  context.fillStyle = COLORS.platform;
  context.fillRect(layout.centerX - halfWidth, y - 4, layout.platformWidth, 8);
  context.fillStyle = COLORS.textDim;
  context.textAlign = 'right';
  context.fillText(String(step), layout.centerX - halfWidth - 10, y);
  context.textAlign = 'left';
  context.fillStyle = COLORS.text;
  context.fillText(`x${coefficient}`, layout.centerX + halfWidth + 10, y);
};

const drawSlot = (context: CanvasRenderingContext2D, layout: Layout, slot: JumperSlot, position: number) => {
  const style = SLOT_STYLE[visibleSlotState(slot, position)];
  const x = layout.centerX - layout.platformWidth / 2 + 18;
  const y = layout.rowY(slot.step) - 14;
  context.fillStyle = style.fill;
  context.beginPath();
  context.arc(x, y, 11, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = COLORS.text;
  context.textAlign = 'center';
  context.fillText(style.label, x, y + 1);
};

const drawCollision = (context: CanvasRenderingContext2D, layout: Layout, step: number) => {
  const x = layout.centerX + layout.platformWidth / 2 - 18;
  const y = layout.rowY(step) - 14;
  context.strokeStyle = COLORS.collision;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x - 8, y - 8);
  context.lineTo(x + 8, y + 8);
  context.moveTo(x + 8, y - 8);
  context.lineTo(x - 8, y + 8);
  context.stroke();
};

const drawPlayer = (context: CanvasRenderingContext2D, layout: Layout, frame: MotionFrame) => {
  const radius = Math.min(14, layout.rowHeight * 0.3);
  const lift = frame.hop * layout.rowHeight * 0.7;
  const drop = frame.fall * layout.rowHeight * 3;
  context.globalAlpha = 1 - frame.fall * 0.7;
  context.fillStyle = COLORS.player;
  context.beginPath();
  context.arc(layout.centerX, layout.rowY(frame.position) - radius - 4 - lift + drop, radius, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
};

const drawLadder = (context: CanvasRenderingContext2D, layout: Layout, scene: JumperScene, frame: MotionFrame) => {
  const ladder = scene.ladder;
  if (ladder === null) return;

  const first = Math.max(0, Math.floor(frame.position - ROWS_BELOW_PLAYER - 1));
  const last = Math.min(ladder.coefficients.length - 1, Math.ceil(frame.position + VISIBLE_ROWS));
  context.font = '13px system-ui, sans-serif';
  context.textBaseline = 'middle';
  ladder.coefficients
    .slice(first, last + 1)
    .forEach((coefficient, index) => drawPlatform(context, layout, first + index, coefficient));
  scene.slots.forEach((slot) => drawSlot(context, layout, slot, frame.position));
  if (scene.collisionStep !== null) drawCollision(context, layout, scene.collisionStep);
  if (frame.position <= START_STEP + ROWS_BELOW_PLAYER) {
    context.fillStyle = COLORS.textDim;
    context.textAlign = 'center';
    context.fillText('START', layout.centerX, layout.rowY(START_STEP) + 12);
  }
};

const drawHud = (context: CanvasRenderingContext2D, viewport: Viewport, scene: JumperScene) => {
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.fillStyle = COLORS.player;
  context.font = 'bold 28px system-ui, sans-serif';
  context.fillText(`x${scene.coeff}`, viewport.width / 2, viewport.height * HUD_SHARE * 0.55);
  context.fillStyle = COLORS.text;
  context.font = '13px system-ui, sans-serif';
  const difficulty = scene.difficulty ?? '…';
  context.fillText(`${difficulty} · ${scene.caption}`, viewport.width / 2, viewport.height * HUD_SHARE * 0.85);
};

export const drawScene = (
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  scene: JumperScene,
  frame: MotionFrame,
  now: number,
): void => {
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.save();
  context.translate(scene.shakeOffset(now), 0);
  const layout = layoutOf(viewport, Math.max(frame.position, START_STEP + ROWS_BELOW_PLAYER - 1));
  context.save();
  context.beginPath();
  const playfieldTop = viewport.height * HUD_SHARE;
  const playfieldBottom = viewport.height * (1 - BET_BAR_SHARE) + layout.rowHeight;
  context.rect(-viewport.width, playfieldTop, viewport.width * 3, playfieldBottom - playfieldTop);
  context.clip();
  drawLadder(context, layout, scene, frame);
  drawPlayer(context, layout, frame);
  context.restore();
  drawHud(context, viewport, scene);
  context.restore();
};
