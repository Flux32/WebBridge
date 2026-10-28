/**
 * Crush drawn: a row of coefficient tiles, an orb hopping along it and a block that falls on a lost
 * step. Every move is a motion the controller awaits before it tells the host the step is played out.
 */
import { clamp01, easeInCubic, easeInOutCubic, easeOutCubic, lerp } from '../../kit/easing';
import { fillRoundRect, strokeRoundRect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import type { CrushMotions, CrushPhase } from './CrushController';
import { drawReadout, drawTiles, tileX, trackOf, type Track } from './crushPaint';
import { START_STEP, type CrushRound } from './crushRound';

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
    const view = this.model();
    const track = trackOf(frame.playfield);
    drawTiles(context, frame, { track, camera: this.camera, view });
    this.drawOrb(context, track);
    this.drawBlock(context, track);
    drawReadout(context, frame, view);
  }

  public isAnimating(): boolean {
    return this.model().phase === 'idle';
  }

  private land(): Promise<boolean> {
    return this.stage.animator.play(LAND_MS, (p) => (this.squash = Math.sin(Math.PI * p) * 0.22));
  }

  private drawOrb(context: CanvasRenderingContext2D, track: Track): void {
    const radius = track.tile * 0.2;
    const x = tileX(track, this.camera, this.orbStep);
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
}
