/**
 * The wheel drawn: the ring under a pointer, the countdown around the hub while bets are open, a spin that
 * slows to the cell, and the winning colour popping in the hub. The controller awaits the motions.
 */
import { clamp01, easeOutBack, easeOutCubic, lerp } from '../../kit/easing';
import { drawGlow, drawText, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import { cellAtPointer, landingRotation, spinTarget, WHEEL_CELLS, WHEEL_MULTIPLIERS, type WheelColor } from './wheelCells';
import type { WheelMotions, WheelPhase, WheelSpinPlan } from './WheelController';
import { CELL_TONES, drawCountdownArc, drawLegend, drawPointer, drawWinningCell, RING_INNER, WheelRing } from './wheelPaint';
import type { WheelRoundState } from './wheelRound';
import { captionOf } from './wheelCaption';

export interface WheelViewModel {
  readonly round: WheelRoundState | null;
  readonly phase: WheelPhase;
  readonly winner: WheelColor | null;
  readonly barTopShare: number | null;
}

const REVEAL_MS = 620;
const BAR_GAP = 12;
/** Room under the ring for the status line and the legend. */
const FOOTER = 58;
const MAX_RADIUS = 210;

interface WheelLayout {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** The playfield, cut further by the wheel bar: the kit's safe area knows only the road-style bar metrics. */
const areaOf = (frame: Frame, barTopShare: number | null): Rect => {
  const { playfield, viewport } = frame;
  const bottom = barTopShare === null ? playfield.y + playfield.height : viewport.height * (1 - barTopShare) - BAR_GAP;
  return { ...playfield, height: Math.max(0, bottom - playfield.y) };
};

const layoutOf = (area: Rect): WheelLayout => {
  const radius = Math.round(Math.max(40, Math.min(MAX_RADIUS, area.width / 2 - 4, (area.height - FOOTER) / 2 - 10)));
  return { x: area.x + area.width / 2, y: area.y + 14 + radius, radius };
};

export class WheelView implements SceneRenderer, WheelMotions {
  private rotation = 0;
  private pop = 1;
  private readonly ring = new WheelRing();
  private countdown: { serial: number; totalMs: number } | null = null;
  private pointerPoint = { x: 0, y: 0 };

  public constructor(
    private readonly stage: Stage,
    private readonly model: () => WheelViewModel,
  ) {}

  public spin(plan: WheelSpinPlan): Promise<boolean> {
    const from = this.rotation;
    const to = spinTarget(from, landingRotation(plan.cellIndex, plan.inCellOffset), plan.turns);
    return this.stage.animator.play(plan.durationMs, (p) => (this.rotation = lerp(from, to, easeOutCubic(p))));
  }

  public reveal(color: WheelColor): Promise<boolean> {
    this.stage.celebrate(this.pointerPoint.x, this.pointerPoint.y, [CELL_TONES[color], PALETTE.violet, PALETTE.ink]);
    return this.stage.animator.play(REVEAL_MS, (p) => (this.pop = easeOutBack(p)));
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const view = this.model();
    const area = areaOf(frame, view.barTopShare);
    const layout = layoutOf(area);
    this.pointerPoint = { x: layout.x, y: layout.y - layout.radius };
    if (view.winner !== null) {
      drawGlow(context, layout.x, layout.y - layout.radius, layout.radius * 0.6, withAlpha(CELL_TONES[view.winner], 0.55));
    }
    this.ring.draw(context, layout.x, layout.y, layout.radius, this.rotation);
    if (view.winner !== null) drawWinningCell(context, layout, this.rotation, cellAtPointer(this.rotation));
    this.drawHub(context, frame, layout, view);
    drawPointer(context, layout.x, layout.y - layout.radius - 6, 14);
    const footerY = layout.y + layout.radius + 24;
    this.drawStatus(context, frame, { x: layout.x, y: footerY }, view);
    drawLegend(context, layout.x, footerY + 26, view.winner);
  }

  public isAnimating(): boolean {
    const phase = this.model().phase;
    return phase === 'betting' || phase === 'waiting';
  }

  private drawHub(context: CanvasRenderingContext2D, frame: Frame, layout: WheelLayout, view: WheelViewModel): void {
    const hubRadius = layout.radius * RING_INNER - 10;
    context.beginPath();
    context.arc(layout.x, layout.y, hubRadius, 0, Math.PI * 2);
    context.fillStyle = PALETTE.dusk;
    context.fill();
    if (view.phase === 'betting') drawCountdownArc(context, layout.x, layout.y, hubRadius - 8, this.countdownLeft(frame.now, view.round));
    const { label, value, color, scale } = this.hubText(frame.now, view);
    const valueSize = Math.max(26, Math.min(64, hubRadius * 0.62)) * scale;
    drawText(context, label, layout.x, layout.y - hubRadius * 0.36, { size: 12, weight: 700, color: PALETTE.inkFaint });
    drawText(context, value, layout.x, layout.y + hubRadius * 0.1, { size: valueSize, weight: 800, color });
  }

  private hubText(now: number, view: WheelViewModel): { label: string; value: string; color: string; scale: number } {
    if (view.winner !== null) {
      const tone = view.winner === 'BLACK' ? PALETTE.ink : CELL_TONES[view.winner];
      return { label: view.winner, value: `x${WHEEL_MULTIPLIERS[view.winner]}`, color: tone, scale: this.pop };
    }
    if (view.phase === 'betting') return { label: 'NEXT SPIN', value: `${this.secondsLeft(now, view.round)}`, color: PALETTE.ink, scale: 1 };
    if (view.phase === 'spinning' || view.phase === 'landed') {
      const color = WHEEL_CELLS[cellAtPointer(this.rotation)] ?? 'BLACK';
      return { label: 'SPINNING', value: `x${WHEEL_MULTIPLIERS[color]}`, color: PALETTE.inkSoft, scale: 1 };
    }
    return { label: view.phase === 'stopped' ? 'PAUSED' : 'WHEEL', value: '—', color: PALETTE.inkSoft, scale: 1 };
  }

  private secondsLeft(now: number, round: WheelRoundState | null): number {
    if (round?.deadlineAt === null || round === null) return 0;
    return Math.max(0, Math.ceil((round.deadlineAt - now) / 1000));
  }

  /** Share of the betting phase still left; the phase length is the first remainder this round showed. */
  private countdownLeft(now: number, round: WheelRoundState | null): number {
    if (round === null || round.deadlineAt === null) return 0;
    const left = Math.max(0, round.deadlineAt - now);
    if (this.countdown?.serial !== round.serial) this.countdown = { serial: round.serial, totalMs: Math.max(left, 1) };
    return clamp01(left / this.countdown.totalMs);
  }

  private drawStatus(context: CanvasRenderingContext2D, frame: Frame, at: { x: number; y: number }, view: WheelViewModel): void {
    const pulse = view.phase === 'betting' ? 0.55 + 0.45 * Math.sin(frame.now / 320) : 1;
    context.globalAlpha = clamp01(pulse);
    drawText(context, captionOf(view), at.x, at.y, { size: 14, weight: 600, color: PALETTE.inkSoft });
    context.globalAlpha = 1;
  }
}
