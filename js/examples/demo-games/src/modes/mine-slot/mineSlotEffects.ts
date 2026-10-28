/**
 * What moves over the field while it is mined: the striker falling from its reel cell, the shards of broken
 * blocks with their payout popping up, and the dynamite's blast ring.
 */
import { clamp01, easeOutBack, lerp } from '../../kit/easing';
import { drawText, fillRoundRect, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import { FIELD_DEPTH, type MineField } from './mineSlotField';
import { BLOCK_LOOKS } from './mineSlotFieldPaint';
import { drawDynamite, drawPickaxe } from './mineSlotGlyphs';
import { blockRect, chestRect, type MineLayout } from './mineSlotLayout';
import type { MineSlotBlockHit, MineSlotStrike } from './mineSlotRound';

export interface Striker {
  readonly strike: MineSlotStrike;
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where a striker lands: on its own column's block of the volley, else on the column's top block, else the chest. */
export const landingOf = (layout: MineLayout, field: MineField | null, strike: MineSlotStrike, hits: readonly MineSlotBlockHit[]): Point => {
  const own = hits.find((hit) => Math.floor(hit.cell / FIELD_DEPTH) === strike.column) ?? hits[0];
  const cell = own?.cell ?? field?.topOf(strike.column) ?? null;
  const lift = strike.kind === 'pickaxe' ? layout.cell * 0.22 : 0;
  if (cell === null) {
    const chest = chestRect(layout, strike.column);
    return { x: chest.x + chest.width / 2, y: chest.y - lift };
  }
  const rect = blockRect(layout, cell);
  return { x: rect.x + rect.width / 2, y: rect.y + (strike.kind === 'pickaxe' ? 0 : rect.height / 2) - lift };
};

export const drawStriker = (context: CanvasRenderingContext2D, striker: Striker | null, size: number): void => {
  if (striker === null || striker.alpha <= 0) return;
  const { symbol } = striker.strike;
  context.globalAlpha = striker.alpha;
  if (symbol.kind === 'pickaxe') drawPickaxe(context, symbol.tier, striker.x, striker.y, size, striker.angle);
  else drawDynamite(context, striker.x, striker.y, size);
  context.globalAlpha = 1;
};

/** Broken blocks crumbling, each with the label it pops (`''` for a block that pays nothing). */
export interface Shards {
  readonly hits: readonly MineSlotBlockHit[];
  readonly labels: readonly string[];
  progress: number;
}

export const payoutLabel = (hit: MineSlotBlockHit): string => {
  if (hit.payout !== null) return `+${hit.payout.toFixed(2)}`;
  return hit.coeff === null ? '' : `+x${hit.coeff}`;
};

export const drawShards = (context: CanvasRenderingContext2D, layout: MineLayout, field: MineField | null, shards: Shards | null): void => {
  if (shards === null || field === null) return;
  const { progress } = shards;
  shards.hits.forEach((hit, index) => {
    const rect = blockRect(layout, hit.cell);
    const block = field.blockAt(hit.cell);
    const shrink = 1 - progress * 0.45;
    if (block !== undefined) {
      context.globalAlpha = 1 - progress;
      const width = rect.width * shrink;
      const height = rect.height * shrink;
      const ghost = { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
      fillRoundRect(context, ghost, BLOCK_LOOKS[block.tier].line, 8);
    }
    const label = shards.labels[index] ?? '';
    if (label === '') return;
    context.globalAlpha = clamp01((1 - progress) * 2.5);
    const size = layout.cell * 0.34 * easeOutBack(clamp01(progress * 3));
    drawText(context, label, rect.x + rect.width / 2, rect.y - progress * layout.cell * 0.7, { size, weight: 900, color: PALETTE.amber });
  });
  context.globalAlpha = 1;
};

export interface Blast {
  x: number;
  y: number;
  /** 0 before the dynamite goes off, then the ring grows to 1. */
  progress: number;
}

const BLAST_RING = withAlpha(PALETTE.amber, 0.9);

export const drawBlast = (context: CanvasRenderingContext2D, layout: MineLayout, blast: Blast): void => {
  if (blast.progress <= 0 || blast.progress >= 1) return;
  context.globalAlpha = 1 - blast.progress;
  context.strokeStyle = BLAST_RING;
  context.lineWidth = lerp(8, 1, blast.progress);
  context.beginPath();
  context.arc(blast.x, blast.y, layout.cell * lerp(0.3, 1.6, blast.progress), 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
};
