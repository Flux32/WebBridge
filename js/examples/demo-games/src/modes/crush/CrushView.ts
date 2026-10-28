/**
 * Crush drawn: a row of coefficient tiles, an orb hopping along it and a block that falls on a lost
 * step. Every move is a motion the controller awaits before it tells the host the step is played out.
 */
import { clamp01, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp } from '../../kit/easing';
import { drawText, fillRoundRect, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import type { CrushMotions, CrushPhase } from './CrushController';
import type { CrushRound } from './crushRound';
import { START_STEP } from './crushRound';

export interface CrushViewModel {
  readonly round: CrushRound;
  readonly phase: CrushPhase;
  readonly lastResult: string;
}

const HOP_MS = 460;
const LAND_MS = 160;
const DROP_MS = 300;
const CRUSH_HOLD_MS = 520;
const REWIND_MS = 520;
const BONUS_MS = 1400;

interface Track {
  readonly tile: number;
  readonly pitch: number;
  readonly centerY: number;
  readonly focusX: number;
}

const trackOf = (playfield: Rect): Track => {
  const tile = Math.max(56, Math.min(128, playfield.width / 4.6, playfield.height * 0.3));
  return {
    tile,
    pitch: tile * 1.28,
    centerY: playfield.y + playfield.height * 0.66,
    focusX: playfield.x + playfield.width * 0.36,
  };
};

export class CrushView implements SceneRenderer, CrushMotions {
  private orbStep = START_STEP;
  private camera = START_STEP;
  private arc = 0;
  private squash = 0;
  private drop = 0;
  private orbPoint = { x: 0, y: 0 };

  public constructor(
    private readonly stage: Stage,
    private readonly model: () => CrushViewModel,
  ) {}

  public hop(toStep: number): Promise<boolean> {
    const from = this.orbStep;
    const cameraFrom = this.camera;
    return this.stage.animator
      .play(HOP_MS, (p) => {
        this.orbStep = lerp(from, toStep, easeInOutCubic(p));
        this.camera = lerp(cameraFrom, toStep, easeOutCubic(p));
        this.arc = Math.sin(Math.PI * p);
      })
      .then((isPlayed) => isPlayed && this.land());
  }

  public crush(): Promise<boolean> {
    return this.hop(this.model().round.step).then(async (isPlayed) => {
      if (!isPlayed) return false;
      const hasDropped = await this.stage.animator.play(DROP_MS, (p) => (this.drop = easeInCubic(p)));
      if (!hasDropped) return false;
      this.stage.shake();
      this.stage.particles.burst({ ...this.orbPoint, colors: [PALETTE.coral, PALETTE.amber], count: 28, speed: 420 }, performance.now());
      return this.stage.animator.wait(CRUSH_HOLD_MS);
    });
  }

  public rewind(): Promise<boolean> {
    const from = this.orbStep;
    const cameraFrom = this.camera;
    const dropFrom = this.drop;
    return this.stage.animator.play(REWIND_MS, (p) => {
      const eased = easeInOutCubic(p);
      this.orbStep = lerp(from, START_STEP, eased);
      this.camera = lerp(cameraFrom, START_STEP, eased);
      this.drop = dropFrom * (1 - clamp01(p * 2));
      this.arc = 0;
    });
  }

  public bonus(): Promise<boolean> {
    return this.stage.animator.play(BONUS_MS, (p) => {
      if (p > 0 && Math.round(p * 1000) % 250 < 20) this.celebrate();
    });
  }

  public celebrate(): void {
    this.stage.celebrate(this.orbPoint.x, this.orbPoint.y, [PALETTE.mint, PALETTE.amber, PALETTE.sky, PALETTE.violet]);
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const { round, phase, lastResult } = this.model();
    const track = trackOf(frame.playfield);
    this.drawTiles(context, frame, track, round);
    this.drawOrb(context, track);
    this.drawBlock(context, track);
    this.drawReadout(context, frame, { round, phase, lastResult });
  }

  public isAnimating(): boolean {
    return this.model().phase === 'idle';
  }

  private land(): Promise<boolean> {
    return this.stage.animator.play(LAND_MS, (p) => (this.squash = Math.sin(Math.PI * p) * 0.22));
  }

  private tileX(track: Track, step: number): number {
    return track.focusX + (step - this.camera) * track.pitch;
  }

  private drawTiles(context: CanvasRenderingContext2D, frame: Frame, track: Track, round: CrushRound): void {
    const first = Math.max(START_STEP, Math.floor(this.camera) - 3);
    const last = Math.min(round.steps.length - 1, Math.ceil(this.camera) + 6);
    const size = track.tile;
    for (let step = first; step <= last; step += 1) {
      const x = this.tileX(track, step);
      if (x < frame.playfield.x - size || x > frame.viewport.width + size) continue;
      const rect = { x: x - size / 2, y: track.centerY - size / 2, width: size, height: size };
      const isPassed = step <= round.step;
      const isNext = step === round.step + 1;
      fillRoundRect(context, rect, isPassed ? withAlpha(PALETTE.mint, 0.18) : PALETTE.panel);
      if (isPassed) strokeRoundRect(context, rect, withAlpha(PALETTE.mint, 0.7), 1.5);
      if (isNext) strokeRoundRect(context, rect, PALETTE.coral, 2.5);
      const label = step === START_STEP ? 'START' : `x${(round.steps[step] ?? 0).toFixed(2)}`;
      drawText(context, label, x, track.centerY - size * 0.04, {
        size: size * (step === START_STEP ? 0.17 : 0.22),
        weight: 800,
        color: isPassed ? PALETTE.mint : PALETTE.ink,
      });
      if (step >= 0) drawText(context, `STEP ${step + 1}`, x, track.centerY + size * 0.26, { size: size * 0.11, color: PALETTE.inkFaint });
    }
  }

  private drawOrb(context: CanvasRenderingContext2D, track: Track): void {
    const radius = track.tile * 0.2;
    const x = this.tileX(track, this.orbStep);
    const groundY = track.centerY - track.tile / 2 - radius;
    const y = groundY - this.arc * track.tile * 0.85;
    this.orbPoint = { x, y };
    context.fillStyle = 'rgba(0, 0, 0, 0.28)';
    context.beginPath();
    context.ellipse(x, groundY + radius + 2, radius * (1 - this.arc * 0.4), radius * 0.28, 0, 0, Math.PI * 2);
    context.fill();
    const flatten = Math.max(this.squash, this.drop * 0.72);
    context.save();
    context.translate(x, y + radius * flatten);
    context.scale(1 + flatten * 0.5, 1 - flatten);
    const gradient = context.createRadialGradient(-radius * 0.35, -radius * 0.35, radius * 0.1, 0, 0, radius);
    gradient.addColorStop(0, PALETTE.amber);
    gradient.addColorStop(1, PALETTE.coral);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private drawBlock(context: CanvasRenderingContext2D, track: Track): void {
    if (this.drop <= 0) return;
    const width = track.tile * 0.9;
    const height = track.tile * 0.62;
    const restY = track.centerY - track.tile / 2 - height;
    const y = lerp(restY - track.tile * 3, restY, this.drop);
    const rect = { x: this.orbPoint.x - width / 2, y, width, height };
    context.globalAlpha = clamp01(this.drop * 3);
    fillRoundRect(context, rect, PALETTE.dusk, 10);
    strokeRoundRect(context, rect, PALETTE.coral, 2.5, 10);
    context.globalAlpha = 1;
  }

  private drawReadout(context: CanvasRenderingContext2D, frame: Frame, view: CrushViewModel): void {
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
  }
}

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
