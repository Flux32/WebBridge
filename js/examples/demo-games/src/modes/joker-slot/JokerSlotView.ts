/**
 * Joker Slot drawn on slot-coin's reels: three reels four symbols tall under what the round paid. A payline
 * lights its cells, placed coins pop in, a bonus board swaps in place, coins fly into the joker that collects
 * them, and a Super Joker shows its multiplier until the next spin.
 */
import { easeInOutCubic, easeOutBack, lerp } from '../../kit/easing';
import { fillRoundRect, roundRectPath, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import { coinLabel, drawCoin, drawWinCell } from '../slot-coin/slotCoinGlyphs';
import { cellCenter, reelGridOf, SlotCoinReels, SPIN_MS, type ReelCell, type ReelGrid } from '../slot-coin/slotCoinReels';
import type { SlotCoinCollection } from '../slot-coin/slotCoinRound';
import type { SlotCoinSymbol } from '../slot-coin/slotCoinSymbols';
import type { JokerSlotMotions } from './JokerSlotController';
import { drawJokerSlotSymbol, drawMultiplierBadge } from './jokerSlotGlyphs';
import { drawReadout, type JokerSlotViewModel } from './jokerSlotReadout';
import type { PlacedSymbol } from './jokerSlotRound';

const LINE_MS = 420;
const PLACE_MS = 320;
const SWAP_MS = 380;
const GLOW_MS = 300;
const FLIGHT_MS = 520;
const POP_MS = 200;
const READOUT_HEIGHT = 128;

export class JokerSlotView implements SceneRenderer, JokerSlotMotions {
  private readonly reels = new SlotCoinReels();
  private grid: ReelGrid = reelGridOf({ x: 0, y: 0, width: 0, height: 0 });
  private cells: SlotCoinSymbol[] = [];
  private litCells = new Set<number>();
  private popCells = new Set<number>();
  private multipliers = new Map<number, number>();
  private collection: SlotCoinCollection | null = null;
  private trigger = -1;
  private glow = 0;
  private flight = 0;
  private pop = 0;

  public constructor(
    private readonly stage: Stage,
    private readonly model: () => JokerSlotViewModel,
  ) {}

  public async spin(cells: readonly SlotCoinSymbol[]): Promise<boolean> {
    this.cells = [...cells];
    this.litCells = new Set();
    this.multipliers = new Map();
    this.trigger = -1;
    this.reels.prepare(cells);
    const isPlayed = await this.stage.animator.play(SPIN_MS, (p) => this.reels.advance(p * SPIN_MS));
    if (isPlayed) this.reels.settle();
    return isPlayed;
  }

  public async showLine(cells: readonly number[]): Promise<boolean> {
    for (const index of cells) this.litCells.add(index);
    return this.stage.animator.play(LINE_MS, (p) => (this.glow = Math.sin(Math.PI * p)));
  }

  public place(symbols: readonly PlacedSymbol[]): Promise<boolean> {
    for (const { index, symbol } of symbols) this.cells[index] = symbol;
    return this.popIn(new Set(symbols.map(({ index }) => index)), PLACE_MS);
  }

  public swapBoard(cells: readonly SlotCoinSymbol[]): Promise<boolean> {
    this.cells = [...cells];
    this.litCells = new Set();
    return this.popIn(new Set(cells.keys()), SWAP_MS);
  }

  public async collect(collection: SlotCoinCollection): Promise<boolean> {
    this.collection = collection;
    this.trigger = collection.triggerIndex;
    this.litCells = new Set([collection.triggerIndex, ...collection.coins.map((coin) => coin.index)]);
    const { animator } = this.stage;
    if (!(await animator.play(GLOW_MS, (p) => (this.glow = Math.sin(Math.PI * p))))) return false;
    if (!(await animator.play(FLIGHT_MS, (p) => (this.flight = easeInOutCubic(p))))) return false;
    this.flight = 0;
    this.collection = null;
    return animator.play(POP_MS, (p) => (this.pop = Math.sin(Math.PI * p)));
  }

  public boost(triggerIndex: number, multiplier: number): Promise<boolean> {
    this.multipliers.set(triggerIndex, multiplier);
    return this.popIn(new Set([triggerIndex]), PLACE_MS);
  }

  public celebrate(): void {
    const { frame } = this.grid;
    this.stage.celebrate(frame.x + frame.width / 2, frame.y + frame.height * 0.4, [PALETTE.magenta, PALETTE.amber, PALETTE.mint]);
  }

  public isAnimating(): boolean {
    return this.model().phase === 'idle';
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const view = this.model();
    const { playfield } = frame;
    const reelArea: Rect = { ...playfield, y: playfield.y + READOUT_HEIGHT, height: playfield.height - READOUT_HEIGHT };
    this.grid = reelGridOf(reelArea);
    this.drawReels(context, view.spinsLeft !== null);
    this.drawFlight(context);
    drawReadout(context, frame, view);
  }

  private async popIn(cells: Set<number>, durationMs: number): Promise<boolean> {
    this.reels.show(this.cells);
    this.popCells = cells;
    const isPlayed = await this.stage.animator.play(durationMs, (p) => (this.pop = easeOutBack(p)));
    this.popCells = new Set();
    this.pop = 0;
    return isPlayed;
  }

  private drawReels(context: CanvasRenderingContext2D, isBonus: boolean): void {
    const { frame, cell } = this.grid;
    fillRoundRect(context, frame, isBonus ? withAlpha(PALETTE.magenta, 0.16) : PALETTE.dusk, 18);
    strokeRoundRect(context, frame, withAlpha(PALETTE.magenta, isBonus ? 0.8 : 0.35), isBonus ? 2.5 : 1.5, 18);
    context.save();
    roundRectPath(context, frame, 18);
    context.clip();
    this.reels.draw(context, this.grid, (symbol, reelCell) => this.drawCell(context, symbol, reelCell));
    context.restore();
    for (const index of this.litCells) {
      const center = cellCenter(this.grid, index);
      drawWinCell(context, { x: center.x - cell / 2, y: center.y - cell / 2, width: cell, height: cell });
    }
    for (const [index, multiplier] of this.multipliers) {
      const center = cellCenter(this.grid, index);
      drawMultiplierBadge(context, multiplier, center.x, center.y, cell);
    }
  }

  private drawCell(context: CanvasRenderingContext2D, symbol: SlotCoinSymbol, { x, y, boardIndex, isBlurred }: ReelCell): void {
    const { cell } = this.grid;
    fillRoundRect(context, { x: x - cell / 2, y: y - cell / 2, width: cell, height: cell }, PALETTE.panel, 12);
    const isLit = this.litCells.has(boardIndex);
    const isFlownAway = this.flight > 0 && isLit && boardIndex !== this.trigger;
    const isPopping = this.popCells.has(boardIndex);
    const scale = isPopping ? lerp(0.4, 1, this.pop) : 1 + (isLit ? this.glow * 0.1 : 0) + (boardIndex === this.trigger ? this.pop * 0.2 : 0);
    context.globalAlpha = isBlurred ? 0.55 : isFlownAway ? 0.25 : 1;
    drawJokerSlotSymbol(context, symbol, x, y, cell * scale);
    context.globalAlpha = 1;
  }

  /** Coins on their way from their cells into the joker. */
  private drawFlight(context: CanvasRenderingContext2D): void {
    if (this.collection === null || this.flight <= 0) return;
    const target = cellCenter(this.grid, this.collection.triggerIndex);
    for (const coin of this.collection.coins) {
      const from = cellCenter(this.grid, coin.index);
      const lift = Math.sin(Math.PI * this.flight) * this.grid.cell * 0.4;
      const size = this.grid.cell * lerp(0.9, 0.6, this.flight);
      drawCoin(context, coinLabel(coin.coeff), lerp(from.x, target.x, this.flight), lerp(from.y, target.y, this.flight) - lift, size);
    }
  }
}
