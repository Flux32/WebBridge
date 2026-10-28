/**
 * Jumper drawn: a vertical ladder of coefficient platforms that scrolls with the player, accelerator slots
 * beside them, an arc per jump and a fall with a shake on a loss. The controller awaits every motion.
 */
import { clamp01, easeInCubic, easeInOutCubic, easeOutCubic, lerp } from '../../kit/easing';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import { drawReadout } from './jumperReadout';
import { drawLadder, ladderLayout, PLATFORM_SHARE, type LadderFocus, type LadderLayout } from './jumperLadder';
import { drawJumper } from './jumperPaint';
import { START_STEP } from './jumperRoute';
import type { JumperScene } from './jumperScene';
import type { JumperMotions, JumpPace } from './playJumperBonus';

const HOP_MS: Readonly<Record<JumpPace, number>> = { round: 420, bonus: 240 };
/** An accelerator's throw takes longer the farther it goes. */
const MS_PER_EXTRA_STEP = 45;
const LAND_MS = 150;
const FALL_MS = 460;
const FALL_HOLD_MS = 320;
const REWIND_MS = 520;
const PAUSE_MS = 420;

export class JumperView implements SceneRenderer, JumperMotions, LadderFocus {
  public position = START_STEP;
  public camera = START_STEP;
  private lift = 0;
  private squash = 0;
  private drop = 0;
  private playerPoint = { x: 0, y: 0 };

  public constructor(
    private readonly stage: Stage,
    private readonly scene: () => JumperScene,
  ) {}

  public place(step: number): void {
    this.position = step;
    this.camera = step;
    this.lift = 0;
    this.squash = 0;
    this.drop = 0;
    this.stage.redraw();
  }

  public async jump(waypoints: readonly number[], pace: JumpPace): Promise<boolean> {
    for (const to of waypoints) {
      if (!(await this.hop(to, pace))) return false;
    }
    return this.stage.animator.play(LAND_MS, (p) => (this.squash = Math.sin(Math.PI * p) * 0.24));
  }

  public async fall(): Promise<boolean> {
    this.stage.shake();
    this.stage.particles.burst({ ...this.playerPoint, colors: [PALETTE.coral, PALETTE.amber], count: 26, speed: 380 }, performance.now());
    const hasFallen = await this.stage.animator.play(FALL_MS, (p) => (this.drop = easeInCubic(p)));
    return hasFallen && this.stage.animator.wait(FALL_HOLD_MS);
  }

  public rewind(): Promise<boolean> {
    const from = this.position;
    const cameraFrom = this.camera;
    const dropFrom = this.drop;
    return this.stage.animator.play(REWIND_MS, (p) => {
      const eased = easeInOutCubic(p);
      this.position = lerp(from, START_STEP, eased);
      this.camera = lerp(cameraFrom, START_STEP, eased);
      this.drop = dropFrom * (1 - clamp01(p * 2));
    });
  }

  public pause(): Promise<boolean> {
    return this.stage.animator.wait(PAUSE_MS);
  }

  public celebrate(): void {
    this.stage.celebrate(this.playerPoint.x, this.playerPoint.y, [PALETTE.pink, PALETTE.violet, PALETTE.amber, PALETTE.mint]);
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const scene = this.scene();
    drawReadout(context, frame, scene);
    const layout = ladderLayout(frame.playfield, this.camera);
    context.save();
    context.beginPath();
    context.rect(frame.viewport.width * -1, layout.area.y, frame.viewport.width * 3, layout.area.height);
    context.clip();
    drawLadder(context, layout, scene, this);
    this.drawPlayer(context, layout);
    context.restore();
  }

  public isAnimating(): boolean {
    const phase = this.scene().phase;
    return phase === 'idle' || phase === 'waiting';
  }

  private hop(to: number, pace: JumpPace): Promise<boolean> {
    const from = this.position;
    const cameraFrom = this.camera;
    const distance = Math.abs(to - from);
    const height = 0.55 + Math.min(distance, 8) * 0.22;
    return this.stage.animator.play(HOP_MS[pace] + (distance - 1) * MS_PER_EXTRA_STEP, (p) => {
      this.position = lerp(from, to, easeInOutCubic(p));
      this.camera = lerp(cameraFrom, to, easeOutCubic(p));
      this.lift = Math.sin(Math.PI * p) * height;
    });
  }

  private drawPlayer(context: CanvasRenderingContext2D, layout: LadderLayout): void {
    const radius = Math.min(16, layout.rowHeight * 0.22);
    const platformTop = layout.rowY(this.position) - (layout.rowHeight * PLATFORM_SHARE) / 2;
    const x = layout.centerX + this.drop * radius * 1.4;
    const y = platformTop - radius - this.lift * layout.rowHeight + this.drop * layout.rowHeight * 2.4;
    this.playerPoint = { x, y };
    drawJumper(context, { x, y, radius, squash: this.squash, alpha: 1 - this.drop * 0.75 });
  }
}
