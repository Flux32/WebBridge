/**
 * The peg board both plinko modes play on: a triangle of pegs, the slot chips under it and the balls in
 * the air. Pegs flash when a ball hits them; a slot pops (`easeOutBack`) when a ball lands in it and stays
 * lit until the next drop.
 */
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawGlow, drawText, fillRoundRect, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Stage } from '../../kit/Stage';
import { BallDrops } from './BallDrops';
import { boardLayoutOf, pegX, pegY, slotX, type BoardLayout } from './boardLayout';
import type { Slot, SlotTone } from './slotLine';

const PEG_FLASH_MS = 280;
const SLOT_POP_MS = 420;
const PEG_COLOR = 'rgba(243, 244, 251, 0.42)';

interface ToneStyle {
  readonly fill: string;
  readonly ink: string;
}

const toneStylesOf = (accent: string): Readonly<Record<SlotTone, ToneStyle>> => ({
  faint: { fill: PALETTE.panel, ink: PALETTE.inkSoft },
  accent: { fill: withAlpha(accent, 0.2), ink: accent },
  hot: { fill: withAlpha(PALETTE.amber, 0.22), ink: PALETTE.amber },
  spin: { fill: withAlpha(PALETTE.violet, 0.26), ink: PALETTE.violet },
});

export class PegBoard {
  private readonly balls: BallDrops;
  private readonly toneStyles: Readonly<Record<SlotTone, ToneStyle>>;
  private readonly flashColor: string;
  private layout: BoardLayout | null = null;

  public constructor(
    stage: Stage,
    accent: string,
    private readonly slots: () => readonly Slot[],
  ) {
    this.balls = new BallDrops(stage);
    this.toneStyles = toneStylesOf(accent);
    this.flashColor = withAlpha(accent, 0.55);
  }

  /** Drops a ball into each slot; resolves once all of them have landed. */
  public drop(slots: readonly number[]): Promise<boolean> {
    return this.balls.drop(this.slots().length - 1, slots);
  }

  /** The centre of a slot chip as last drawn: where a win celebrates. */
  public slotPoint(slot: number): { x: number; y: number } {
    if (this.layout === null) return { x: 0, y: 0 };
    return { x: slotX(this.layout, slot), y: this.layout.slotY + this.layout.slotHeight / 2 };
  }

  public draw(context: CanvasRenderingContext2D, area: Rect, now: number): void {
    const slots = this.slots();
    if (slots.length < 2) return;
    const layout = boardLayoutOf(area, slots.length - 1);
    this.layout = layout;
    this.drawPegs(context, layout, now);
    this.drawSlots(context, layout, slots, now);
    this.balls.draw(context, layout);
  }

  private drawPegs(context: CanvasRenderingContext2D, layout: BoardLayout, now: number): void {
    const hits = this.balls.pegHitTimes;
    context.fillStyle = PEG_COLOR;
    context.beginPath();
    for (let row = 0; row < layout.rows; row += 1) {
      for (let column = 0; column < row + 3; column += 1) {
        const x = pegX(layout, row, column);
        context.moveTo(x + layout.pegRadius, pegY(layout, row));
        context.arc(x, pegY(layout, row), layout.pegRadius, 0, Math.PI * 2);
      }
    }
    context.fill();
    for (let row = 0; row < layout.rows; row += 1) {
      for (let column = 0; column < row + 3; column += 1) {
        const age = now - (hits[row * (layout.rows + 3) + column] ?? 0);
        if (age < 0 || age > PEG_FLASH_MS) continue;
        context.globalAlpha = 1 - age / PEG_FLASH_MS;
        drawGlow(context, pegX(layout, row, column), pegY(layout, row), layout.pitch * 0.5, this.flashColor);
      }
    }
    context.globalAlpha = 1;
  }

  private drawSlots(context: CanvasRenderingContext2D, layout: BoardLayout, slots: readonly Slot[], now: number): void {
    const landings = this.balls.landingTimes;
    const width = layout.pitch * 0.9;
    slots.forEach((slot, index) => {
      const landedAt = landings[index] ?? 0;
      const pop = landedAt === 0 ? 1 : easeOutBack(clamp01((now - landedAt) / SLOT_POP_MS));
      const scale = landedAt === 0 ? 1 : 1.18 - 0.18 * pop;
      const style = this.toneStyles[slot.tone];
      const x = slotX(layout, index);
      const rect: Rect = {
        x: x - (width * scale) / 2,
        y: layout.slotY + layout.slotHeight * (1 - scale) * 0.5 - (landedAt === 0 ? 0 : layout.slotHeight * 0.12),
        width: width * scale,
        height: layout.slotHeight * scale,
      };
      fillRoundRect(context, rect, style.fill, Math.min(8, layout.pitch * 0.22));
      if (landedAt !== 0) strokeRoundRect(context, rect, style.ink, 1.5, Math.min(8, layout.pitch * 0.22));
      const size = Math.max(7, Math.min(13, (width / Math.max(2, slot.label.length)) * 1.5));
      drawText(context, slot.label, x, rect.y + rect.height / 2 + 0.5, { size, weight: 800, color: style.ink });
    });
  }
}
