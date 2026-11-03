/**
 * What the view draws around and over the reels: the three pots with their fill, the jackpot pick's tile
 * grid, the Hold & Win board and the banners that close a feature and the round.
 */
import { DRAGON_POTS_JACKPOT_TIERS, DRAGON_POTS_POT_COLORS, type DragonPotsJackpotTile, type DragonPotsPotColor } from '@omega/webbridge-protocol';
import { clamp01, easeOutBack } from '../../kit/easing';
import { drawGlow, drawText, fillRoundRect, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import { POT_TICKS, type HoldAndWinView, type JackpotView } from './DragonPotsController';
import { POT_TONES } from './dragonPotsGlyphs';
import { boardCellCenter, cellRectAt, type DragonLayout } from './dragonPotsLayout';

/** The pick board, `JACKPOT_BOARD_TILES` tiles. */
const JACKPOT_COLUMNS = 4;
const JACKPOT_ROWS = 3;
/** Where the n-th picked tile sits on the board, so the picks wander over it as a player's would. */
const PICK_ORDER = [5, 2, 9, 0, 7, 11, 3, 8, 1, 10, 4, 6] as const;
const TIER_TONES: Readonly<Record<DragonPotsJackpotTile, string>> = { 1: PALETTE.mint, 2: PALETTE.sky, 3: PALETTE.violet, 4: PALETTE.amber, 5: PALETTE.vermilion };
const SHADE = withAlpha(PALETTE.night, 0.66);

export interface Banner {
  readonly title: string;
  readonly value: string;
  /** 0…1 through the banner's life: it pops in, holds, then fades. */
  progress: number;
}

/** A pot's pulse while it bursts (1 = at rest). */
export type PotPulse = Partial<Record<DragonPotsPotColor, number>>;

export const drawPots = (context: CanvasRenderingContext2D, layout: DragonLayout, levels: Readonly<Record<DragonPotsPotColor, number>>, pulse: PotPulse): void => {
  for (const color of DRAGON_POTS_POT_COLORS) {
    const tone = POT_TONES[color];
    const rect = layout.pots[color];
    const scale = pulse[color] ?? 1;
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const pot: Rect = { x: center.x - (rect.width / 2) * scale, y: center.y - (rect.height / 2) * scale, width: rect.width * scale, height: rect.height * scale };
    if (pulse[color] !== undefined) drawGlow(context, center.x, center.y, rect.width, withAlpha(tone, 0.5));
    fillRoundRect(context, pot, PALETTE.panel, 18);
    const fill = levels[color] / POT_TICKS;
    fillRoundRect(context, { ...pot, y: pot.y + pot.height * (1 - fill), height: pot.height * fill }, withAlpha(tone, 0.55), 18);
    strokeRoundRect(context, pot, tone, 2.5, 18);
    drawText(context, color.toUpperCase(), center.x, pot.y + pot.height - 14, { size: 11, weight: 800, color: PALETTE.ink });
  }
};

const tileRect = (board: Rect, slot: number): Rect => {
  const gap = 8;
  const width = (board.width - gap * (JACKPOT_COLUMNS + 1)) / JACKPOT_COLUMNS;
  const height = (board.height - gap * (JACKPOT_ROWS + 1)) / JACKPOT_ROWS;
  return { x: board.x + gap + (slot % JACKPOT_COLUMNS) * (width + gap), y: board.y + gap + Math.floor(slot / JACKPOT_COLUMNS) * (height + gap), width, height };
};

/** The pick: hidden tiles, the revealed ones by tier; `flip` turns the newest one over (0…1). */
export const drawJackpot = (context: CanvasRenderingContext2D, board: Rect, jackpot: JackpotView, flip: number): void => {
  fillRoundRect(context, board, SHADE, 16);
  PICK_ORDER.forEach((slot, pick) => {
    const rect = tileRect(board, slot);
    const tile = jackpot.revealed[pick];
    const isNewest = pick === jackpot.revealed.length - 1;
    const width = isNewest ? rect.width * Math.abs(1 - 2 * flip) : rect.width;
    const shown: Rect = { ...rect, x: rect.x + (rect.width - width) / 2, width };
    const isFaceUp = tile !== undefined && (!isNewest || flip >= 0.5);
    if (!isFaceUp) {
      fillRoundRect(context, shown, PALETTE.panel, 12);
      drawText(context, '?', rect.x + rect.width / 2, rect.y + rect.height / 2, { size: rect.height * 0.4, weight: 900, color: PALETTE.inkFaint });
      return;
    }
    const tone = TIER_TONES[tile];
    const isWon = jackpot.won === tile;
    if (isWon) drawGlow(context, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width * 0.8, withAlpha(tone, 0.5));
    fillRoundRect(context, shown, withAlpha(tone, isWon ? 0.5 : 0.24), 12);
    strokeRoundRect(context, shown, tone, isWon ? 3 : 1.5, 12);
    const name = DRAGON_POTS_JACKPOT_TIERS[tile].name;
    drawText(context, name, rect.x + rect.width / 2, rect.y + rect.height / 2, { size: Math.min(15, rect.width * 0.2), weight: 900, color: PALETTE.ink });
  });
};

/** The Hold & Win board: coins with their value in bets; `pop` grows the newest coin in, `flash` lights the rest. */
export const drawHoldAndWin = (
  context: CanvasRenderingContext2D,
  layout: DragonLayout,
  board: HoldAndWinView,
  effects: { readonly newest: number; readonly pop: number; readonly flash: number; readonly shimmer: number },
): void => {
  fillRoundRect(context, layout.board, PALETTE.dusk, 16);
  strokeRoundRect(context, layout.board, withAlpha(PALETTE.amber, 0.45), 1.5, 16);
  for (let cell = 0; cell < board.rows * board.columns; cell += 1) {
    const center = boardCellCenter(layout, cell);
    const rect = cellRectAt(layout, center);
    const coeff = board.coins.get(cell);
    if (coeff === undefined) {
      fillRoundRect(context, rect, withAlpha(PALETTE.panel, 0.6 + 0.4 * effects.shimmer), 12);
      continue;
    }
    const scale = cell === effects.newest ? easeOutBack(clamp01(effects.pop)) : 1;
    if (effects.flash > 0) drawGlow(context, center.x, center.y, layout.cell * 0.8, withAlpha(PALETTE.amber, 0.5 * effects.flash));
    context.beginPath();
    context.arc(center.x, center.y, layout.cell * 0.42 * scale, 0, Math.PI * 2);
    context.fillStyle = PALETTE.amber;
    context.fill();
    drawText(context, `×${coeff}`, center.x, center.y, { size: Math.max(1, layout.cell * 0.24 * scale), weight: 900, color: PALETTE.night });
  }
};

export const drawBanner = (context: CanvasRenderingContext2D, area: Rect, banner: Banner | null): void => {
  if (banner === null) return;
  const fadeOut = clamp01((1 - banner.progress) / 0.2);
  const scale = easeOutBack(clamp01(banner.progress / 0.3));
  context.globalAlpha = fadeOut;
  fillRoundRect(context, area, SHADE, 16);
  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  drawGlow(context, centerX, centerY, area.width * 0.4, withAlpha(PALETTE.vermilion, 0.35));
  drawText(context, banner.title, centerX, centerY - area.height * 0.18, { size: 15, weight: 800, color: PALETTE.amber });
  drawText(context, banner.value, centerX, centerY + area.height * 0.06, { size: Math.max(1, Math.min(52, area.height * 0.26) * scale), weight: 900, color: PALETTE.ink });
  context.globalAlpha = 1;
};
