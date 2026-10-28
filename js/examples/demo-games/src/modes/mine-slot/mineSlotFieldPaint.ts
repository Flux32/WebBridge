/**
 * The block field and the chest row drawn: each block in its tier's colour, cracked by the damage it has
 * taken; a broken block leaves a dark hole. Chests stay shut until the column above them is broken through.
 */
import { drawGlow, drawText, fillRoundRect, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import { FIELD_CELLS, FIELD_COLUMNS, type MineField } from './mineSlotField';
import { blockRect, chestRect, type MineLayout } from './mineSlotLayout';
import type { BlockTier } from './mineSlotSymbols';

interface BlockLook {
  readonly fill: string;
  readonly line: string;
  readonly tone: string;
  readonly hasOre: boolean;
}

const lookOf = (tone: string, hasOre: boolean, fill = withAlpha(tone, 0.3)): BlockLook => ({
  fill,
  line: withAlpha(tone, 0.75),
  tone,
  hasOre,
});

/** Built once: the field is drawn every frame without building colour strings. */
export const BLOCK_LOOKS: Readonly<Record<BlockTier, BlockLook>> = {
  dirt: lookOf(PALETTE.copper, false, withAlpha(PALETTE.copper, 0.2)),
  stone: lookOf(PALETTE.ink, false, withAlpha(PALETTE.ink, 0.16)),
  redstone: lookOf(PALETTE.coral, true),
  gold: lookOf(PALETTE.amber, true),
  crystal: lookOf(PALETTE.sky, true),
  obsidian: lookOf(PALETTE.violet, true, PALETTE.night),
};

const HOLE = withAlpha(PALETTE.night, 0.55);
const SOCKET = withAlpha(PALETTE.ink, 0.08);
const CRACK = withAlpha(PALETTE.night, 0.8);
const CHEST_SHUT = withAlpha(PALETTE.amber, 0.45);
const CHEST_OPEN = withAlpha(PALETTE.amber, 0.24);
const CHEST_GLOW = withAlpha(PALETTE.amber, 0.45);

/** Three crack lines in block units, revealed one per third of the block's durability. */
const CRACKS: readonly (readonly number[])[] = [
  [0.18, 0.1, 0.34, 0.45, 0.26, 0.9],
  [0.7, 0.05, 0.6, 0.4, 0.82, 0.62, 0.74, 0.95],
  [0.05, 0.6, 0.38, 0.52, 0.56, 0.72, 0.95, 0.58],
];

const drawCracks = (context: CanvasRenderingContext2D, rect: Rect, wear: number): void => {
  const count = Math.ceil(wear * CRACKS.length);
  context.strokeStyle = CRACK;
  context.lineWidth = 1.5;
  context.lineJoin = 'round';
  for (let index = 0; index < count; index += 1) {
    const line = CRACKS[index] ?? [];
    context.beginPath();
    for (let point = 0; point + 1 < line.length; point += 2) {
      context.lineTo(rect.x + (line[point] ?? 0) * rect.width, rect.y + (line[point + 1] ?? 0) * rect.height);
    }
    context.stroke();
  }
};

const drawOre = (context: CanvasRenderingContext2D, rect: Rect, tone: string): void => {
  const speck = Math.max(3, rect.height * 0.16);
  context.fillStyle = tone;
  context.fillRect(rect.x + rect.width * 0.24, rect.y + rect.height * 0.3, speck, speck);
  context.fillRect(rect.x + rect.width * 0.62, rect.y + rect.height * 0.52, speck * 0.8, speck * 0.8);
};

/** One block as the field holds it: whole, cracked, or a hole once broken. */
export const drawBlock = (context: CanvasRenderingContext2D, field: MineField, rect: Rect, cell: number): void => {
  const block = field.blockAt(cell);
  if (block === undefined || field.isBroken(cell)) return fillRoundRect(context, rect, HOLE, 8);
  const look = BLOCK_LOOKS[block.tier];
  fillRoundRect(context, rect, PALETTE.panel, 8);
  fillRoundRect(context, rect, look.fill, 8);
  strokeRoundRect(context, rect, look.line, 1.5, 8);
  if (look.hasOre) drawOre(context, rect, look.tone);
  const wear = field.wearOf(cell);
  if (wear > 0) drawCracks(context, rect, wear);
};

/** The field; before the first reply only empty sockets, the shape of the mine without its rock. */
export const drawField = (context: CanvasRenderingContext2D, layout: MineLayout, field: MineField | null, shake: Shake): void => {
  for (let cell = 0; cell < FIELD_CELLS; cell += 1) {
    const rect = blockRect(layout, cell);
    if (field === null) {
      fillRoundRect(context, rect, SOCKET, 8);
      continue;
    }
    const dx = shake.cells.includes(cell) ? Math.sin(shake.amount * Math.PI * 6) * 3 * shake.amount : 0;
    drawBlock(context, field, dx === 0 ? rect : { ...rect, x: rect.x + dx }, cell);
  }
};

export interface Shake {
  cells: readonly number[];
  amount: number;
}

/** The chest row: shut chests, and opened ones glowing with their multiplier; `opening` pops in. */
export const drawChests = (context: CanvasRenderingContext2D, layout: MineLayout, opened: ReadonlyMap<number, number>, opening: ChestPop): void => {
  for (let column = 0; column < FIELD_COLUMNS; column += 1) {
    const rect = chestRect(layout, column);
    const coeff = column === opening.column ? opening.coeff : opened.get(column);
    const scale = column === opening.column ? opening.scale : 1;
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    if (coeff === undefined) {
      fillRoundRect(context, rect, PALETTE.dusk, 8);
      strokeRoundRect(context, rect, CHEST_SHUT, 1.5, 8);
      context.fillStyle = CHEST_SHUT;
      context.fillRect(rect.x + 4, rect.y + rect.height * 0.38, rect.width - 8, 1.5);
      continue;
    }
    drawGlow(context, centerX, centerY, rect.width * 0.8 * scale, CHEST_GLOW);
    fillRoundRect(context, rect, CHEST_OPEN, 8);
    strokeRoundRect(context, rect, PALETTE.amber, 2, 8);
    drawText(context, `×${coeff}`, centerX, centerY + 1, { size: rect.height * 0.46 * scale, weight: 900, color: PALETTE.amber });
  }
};

export interface ChestPop {
  column: number;
  coeff: number;
  scale: number;
}
