/**
 * The fortune wheel over the board: it fades in, spins a few turns onto the sector the server chose, pops
 * that sector's label in its hub and fades out. The whole show is one motion the controller awaits.
 */
import { clamp01, easeOutBack, easeOutCubic } from '../../kit/easing';
import { drawGlow, drawText, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Stage } from '../../kit/Stage';
import { wheelAngleOf, type WheelSpin } from './wheel';

const FADE_MS = 260;
const SPIN_MS = 2600;
const REVEAL_MS = 420;
const HOLD_MS = 700;
const TURNS = 4;
const BONUS_LABEL = 'BONUS';

export class WheelOverlay {
  private spin: WheelSpin | null = null;
  private angle = 0;
  private presence = 0;
  private reveal = 0;
  private readonly dimColor = withAlpha(PALETTE.night, 0.9);
  private readonly bonusFill = withAlpha(PALETTE.amber, 0.32);
  private centerX = 0;
  private centerY = 0;

  public constructor(
    private readonly stage: Stage,
    private readonly accent: string,
  ) {}

  public async play(spin: WheelSpin): Promise<boolean> {
    const { animator } = this.stage;
    this.spin = spin;
    this.angle = 0;
    this.reveal = 0;
    const finalAngle = wheelAngleOf(spin.target, spin.sectors.length, TURNS);
    if (!(await animator.play(FADE_MS, (p) => (this.presence = easeOutCubic(p))))) return false;
    if (!(await animator.play(SPIN_MS, (p) => (this.angle = finalAngle * easeOutCubic(p))))) return false;
    this.stage.celebrate(this.centerX, this.centerY, [this.accent, PALETTE.amber, PALETTE.violet]);
    if (!(await animator.play(REVEAL_MS, (p) => (this.reveal = p)))) return false;
    if (!(await animator.wait(HOLD_MS))) return false;
    const isPlayed = await animator.play(FADE_MS, (p) => (this.presence = 1 - easeOutCubic(p)));
    this.spin = null;
    return isPlayed;
  }

  public draw(context: CanvasRenderingContext2D, area: Rect): void {
    const spin = this.spin;
    if (spin === null || this.presence <= 0) return;
    const radius = Math.min(area.width, area.height) * 0.38;
    const x = area.x + area.width / 2;
    const y = area.y + area.height / 2;
    this.centerX = x;
    this.centerY = y;
    context.globalAlpha = this.presence;
    drawGlow(context, x, y, radius * 1.7, this.dimColor);
    this.drawSectors(context, spin, x, y, radius);
    this.drawHub(context, spin, x, y, radius);
    this.drawPointer(context, x, y - radius);
    context.globalAlpha = 1;
  }

  private drawSectors(context: CanvasRenderingContext2D, spin: WheelSpin, x: number, y: number, radius: number): void {
    const width = (Math.PI * 2) / spin.sectors.length;
    spin.sectors.forEach((label, index) => {
      const start = -Math.PI / 2 + this.angle + index * width;
      context.fillStyle = label === BONUS_LABEL ? this.bonusFill : index % 2 === 0 ? PALETTE.panel : PALETTE.dusk;
      context.beginPath();
      context.moveTo(x, y);
      context.arc(x, y, radius, start, start + width);
      context.closePath();
      context.fill();
      context.save();
      context.translate(x, y);
      context.rotate(start + width / 2);
      drawText(context, label, radius * 0.66, 0, { size: Math.max(10, radius * 0.13), weight: 800, color: PALETTE.ink });
      context.restore();
    });
    context.strokeStyle = this.accent;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();
  }

  private drawHub(context: CanvasRenderingContext2D, spin: WheelSpin, x: number, y: number, radius: number): void {
    const hub = radius * 0.3;
    context.fillStyle = PALETTE.night;
    context.beginPath();
    context.arc(x, y, hub, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = this.accent;
    context.lineWidth = 2;
    context.stroke();
    const isRevealed = this.reveal > 0;
    const label = isRevealed ? (spin.sectors[spin.target] ?? '') : 'SPIN';
    const scale = isRevealed ? easeOutBack(clamp01(this.reveal)) : 1;
    drawText(context, label, x, y + 1, { size: Math.max(1, hub * 0.5 * scale), weight: 800, color: isRevealed ? PALETTE.amber : PALETTE.inkSoft });
  }

  private drawPointer(context: CanvasRenderingContext2D, x: number, top: number): void {
    context.fillStyle = this.accent;
    context.beginPath();
    context.moveTo(x - 9, top - 12);
    context.lineTo(x + 9, top - 12);
    context.lineTo(x, top + 6);
    context.closePath();
    context.fill();
  }
}
