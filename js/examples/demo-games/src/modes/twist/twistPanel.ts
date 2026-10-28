/**
 * The progress panel: one row of cells per sector, each cell labelled with the coefficient it reaches and
 * the last one with the bonus star. The shown fill is a float per sector, so a move between two boards is
 * one lerp: cells pop in as it grows and break off as it shrinks.
 */
import { clamp01, easeOutBack, lerp } from '../../kit/easing';
import { drawGlow, drawText, fillRoundRect, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import { TOTEM_COLORS } from './twistGlyphs';
import { SECTOR_COEFFICIENTS, sectorCellCount, TWIST_SECTORS, type TwistProgress, type TwistSector } from './twistTable';

const LABEL_WIDTH = 54;
const ROW_GAP = 8;
const CELL_GAP = 4;
const LONGEST_ROW = Math.max(...TWIST_SECTORS.map(sectorCellCount));

export const PANEL_ROW_HEIGHT = 36;
export const PANEL_HEIGHT = PANEL_ROW_HEIGHT * TWIST_SECTORS.length + ROW_GAP * (TWIST_SECTORS.length - 1);

const cellLabel = (sector: TwistSector, cell: number): string => {
  const coefficient = SECTOR_COEFFICIENTS[sector][cell];
  return coefficient === undefined ? '★' : `${coefficient}`;
};

export class TwistPanel {
  private readonly shown: Record<TwistSector, number> = { fire: 0, earth: 0, water: 0 };
  private readonly from: Record<TwistSector, number> = { fire: 0, earth: 0, water: 0 };
  private readonly to: Record<TwistSector, number> = { fire: 0, earth: 0, water: 0 };
  /** 0…1 while a wipe drops the cells; they fall as well as fade. */
  public drop = 0;

  public aim(progress: TwistProgress): void {
    for (const sector of TWIST_SECTORS) {
      this.from[sector] = this.shown[sector];
      this.to[sector] = progress[sector];
    }
  }

  public advance(progress: number): void {
    for (const sector of TWIST_SECTORS) {
      const isGrowing = this.to[sector] > this.from[sector];
      const eased = isGrowing ? easeOutBack(progress) : progress;
      this.shown[sector] = lerp(this.from[sector], this.to[sector], eased);
    }
  }

  public draw(context: CanvasRenderingContext2D, area: Rect): void {
    const cellWidth = (area.width - LABEL_WIDTH - CELL_GAP * (LONGEST_ROW - 1)) / LONGEST_ROW;
    TWIST_SECTORS.forEach((sector, row) => {
      const y = area.y + row * (PANEL_ROW_HEIGHT + ROW_GAP);
      const color = TOTEM_COLORS[sector];
      drawText(context, sector.toUpperCase(), area.x, y + PANEL_ROW_HEIGHT / 2, { size: 11, weight: 800, align: 'left', color });
      for (let cell = 0; cell < sectorCellCount(sector); cell += 1) {
        const rect = { x: area.x + LABEL_WIDTH + cell * (cellWidth + CELL_GAP), y, width: cellWidth, height: PANEL_ROW_HEIGHT };
        this.drawCell(context, rect, { sector, cell, color });
      }
    });
  }

  private drawCell(context: CanvasRenderingContext2D, rect: Rect, place: { sector: TwistSector; cell: number; color: string }): void {
    const { sector, cell, color } = place;
    const fill = clamp01(this.shown[sector] - cell);
    const isBonus = cell === sectorCellCount(sector) - 1;
    fillRoundRect(context, rect, PALETTE.panel, 9);
    if (isBonus) strokeRoundRect(context, rect, withAlpha(color, 0.45), 1.5, 9);
    if (fill > 0) this.drawFill(context, rect, color, fill);
    drawText(context, cellLabel(sector, cell), rect.x + rect.width / 2, rect.y + rect.height / 2 + 0.5, {
      size: Math.min(12, rect.width * 0.32),
      weight: 800,
      color: fill > 0.5 ? PALETTE.night : PALETTE.inkFaint,
    });
  }

  private drawFill(context: CanvasRenderingContext2D, rect: Rect, color: string, fill: number): void {
    const scale = 0.6 + 0.4 * fill;
    const fall = this.drop * rect.height * 1.4;
    const inner = {
      x: rect.x + (rect.width * (1 - scale)) / 2,
      y: rect.y + (rect.height * (1 - scale)) / 2 + fall,
      width: rect.width * scale,
      height: rect.height * scale,
    };
    context.globalAlpha = fill * (1 - this.drop);
    if (fill >= 1) drawGlow(context, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, withAlpha(color, 0.25));
    fillRoundRect(context, inner, color, 9);
    context.globalAlpha = 1;
  }

  /** After a wipe the board is empty and the dropped cells are gone. */
  public clear(): void {
    for (const sector of TWIST_SECTORS) this.shown[sector] = 0;
    this.drop = 0;
  }
}
