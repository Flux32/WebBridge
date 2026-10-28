/**
 * Slot Coin drawn: three reels four symbols tall under the round's multiplier. Coins of a collection light up,
 * fly into the trigger cell, and the cells that paid stay lit until the next spin.
 */
import { easeInOutCubic, lerp } from '../../kit/easing';
import { fillRoundRect, roundRectPath, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import type { SlotCoinMotions } from './SlotCoinController';
import { coinLabel, drawCoin, drawSymbol, drawWinCell } from './slotCoinGlyphs';
import { cellCenter, reelGridOf, SlotCoinReels, SPIN_MS, type ReelCell, type ReelGrid } from './slotCoinReels';
import type { SlotCoinBoardPlan, SlotCoinCollection } from './slotCoinRound';
import { drawReadout, type SlotCoinViewModel } from './slotCoinReadout';
import type { SlotCoinSymbol } from './slotCoinSymbols';

const GLOW_MS = 360;
const FLIGHT_MS = 560;
const POP_MS = 220;
const READOUT_HEIGHT = 128;

export class SlotCoinView implements SceneRenderer, SlotCoinMotions {
  private readonly reels = new SlotCoinReels();
  private grid: ReelGrid = reelGridOf({ x: 0, y: 0, width: 0, height: 0 });
  private litCells = new Set<number>();
  private collection: SlotCoinCollection | null = null;
  private trigger = -1;
  private glow = 0;
  private flight = 0;
  private pop = 0;

  public constructor(
    private readonly stage: Stage,
    private readonly model: () => SlotCoinViewModel,
  ) {}

  public async spin(board: SlotCoinBoardPlan): Promise<boolean> {
    this.litCells = new Set();
    this.collection = null;
    this.trigger = -1;
    this.reels.prepare(board.cells);
    const isPlayed = await this.stage.animator.play(SPIN_MS, (p) => this.reels.advance(p * SPIN_MS));
    if (isPlayed) this.reels.settle();
    return isPlayed;
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

  public celebrate(): void {
    const { frame } = this.grid;
    this.stage.celebrate(frame.x + frame.width / 2, frame.y + frame.height * 0.4, [PALETTE.amber, PALETTE.mint, PALETTE.pink]);
  }

  public isAnimating(): boolean {
    return this.model().phase === 'idle';
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const view = this.model();
    const { playfield } = frame;
    const reelArea: Rect = { ...playfield, y: playfield.y + READOUT_HEIGHT, height: playfield.height - READOUT_HEIGHT };
    this.grid = reelGridOf(reelArea);
    this.drawReels(context);
    this.drawFlight(context);
    drawReadout(context, frame, view);
  }

  private drawReels(context: CanvasRenderingContext2D): void {
    const { frame, cell } = this.grid;
    fillRoundRect(context, frame, PALETTE.dusk, 18);
    strokeRoundRect(context, frame, withAlpha(PALETTE.amber, 0.35), 1.5, 18);
    context.save();
    roundRectPath(context, frame, 18);
    context.clip();
    this.reels.draw(context, this.grid, (symbol, cell) => this.drawCell(context, symbol, cell));
    context.restore();
    for (const index of this.litCells) {
      const center = cellCenter(this.grid, index);
      drawWinCell(context, { x: center.x - cell / 2, y: center.y - cell / 2, width: cell, height: cell });
    }
  }

  private drawCell(context: CanvasRenderingContext2D, symbol: SlotCoinSymbol, { x, y, boardIndex, isBlurred }: ReelCell): void {
    const { cell } = this.grid;
    fillRoundRect(context, { x: x - cell / 2, y: y - cell / 2, width: cell, height: cell }, PALETTE.panel, 12);
    const isLit = this.litCells.has(boardIndex);
    const isFlownAway = this.flight > 0 && isLit && boardIndex !== this.trigger;
    const scale = 1 + (isLit ? this.glow * 0.1 : 0) + (boardIndex === this.trigger ? this.pop * 0.2 : 0);
    context.globalAlpha = isBlurred ? 0.55 : isFlownAway ? 0.25 : 1;
    drawSymbol(context, symbol, x, y, cell * scale);
    context.globalAlpha = 1;
  }

  /** Coins on their way from their cells into the trigger. */
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
