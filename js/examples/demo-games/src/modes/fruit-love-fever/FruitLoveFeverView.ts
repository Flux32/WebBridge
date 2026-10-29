/**
 * Fruit Love Fever drawn: the win readout, the free-spin counter, the 5 × 3 reels. Sticky wilds hold their
 * cells while the other reels spin, paying lines are drawn through their cells, and banners open and close
 * the bonus. Every move is a motion the controller awaits; a fast game plays each in less time.
 */
import { fillRoundRect, roundRectPath, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import type { FruitLoveFeverMotions } from './FruitLoveFeverController';
import { drawSymbol } from './fruitLoveFeverGlyphs';
import { cellCenter, layoutOf, type FruitLayout } from './fruitLoveFeverLayout';
import { drawBanner, drawCounter, drawLines, drawLocks, type Banner } from './fruitLoveFeverOverlays';
import { drawReadout, READOUT_HEIGHT, type FruitLoveFeverViewModel } from './fruitLoveFeverReadout';
import { FruitLoveFeverReels, SPIN_MS, type ReelCell } from './fruitLoveFeverReels';
import type { BonusProgress, FruitSpinPlan, WinLinePlan } from './fruitLoveFeverRound';
import type { ReelSymbol } from './fruitLoveFeverSymbols';

const LINES_MS = 900;
const INTRO_MS = 1600;
const OUTRO_MS = 1800;
/** A fast game plays every motion in this share of its time. */
const FAST_PACE = 0.4;
const REEL_LINE = withAlpha(PALETTE.rose, 0.35);

export class FruitLoveFeverView implements SceneRenderer, FruitLoveFeverMotions {
  private readonly reels = new FruitLoveFeverReels();
  private layout: FruitLayout = layoutOf({ x: 0, y: 0, width: 0, height: 0 });
  private lines: readonly WinLinePlan[] = [];
  private linesProgress = 0;
  /** The sticky wilds that hold their cells during a spin, drawn over the scrolling strips. */
  private held: ReadonlyMap<number, ReelSymbol> = new Map();
  private banner: Banner | null = null;

  public constructor(
    private readonly stage: Stage,
    private readonly model: () => FruitLoveFeverViewModel,
  ) {}

  public async spin(plan: FruitSpinPlan, locked: ReadonlySet<number>): Promise<boolean> {
    this.lines = [];
    this.held = new Map([...locked].map((cell) => [cell, plan.board[cell]!]));
    this.reels.prepare(plan.board);
    const isPlayed = await this.stage.animator.play(SPIN_MS * this.pace(), (p) => this.reels.advance(p * SPIN_MS));
    if (isPlayed) this.reels.settle();
    this.held = new Map();
    return isPlayed;
  }

  public place(plan: FruitSpinPlan): void {
    this.lines = [];
    this.reels.place(plan.board);
    this.stage.redraw();
  }

  public showLines(plan: FruitSpinPlan): Promise<boolean> {
    this.lines = plan.lines;
    return this.stage.animator.play(LINES_MS * this.pace(), (p) => (this.linesProgress = p));
  }

  public bonusIntro(bonus: BonusProgress): Promise<boolean> {
    return this.showBanner({ title: 'FREE SPINS', value: `${bonus.total}`, progress: 0 }, INTRO_MS);
  }

  public bonusOutro(totalWin: number): Promise<boolean> {
    const { currency } = this.model();
    return this.showBanner({ title: 'BONUS WIN', value: `${totalWin.toFixed(2)} ${currency}`, progress: 0 }, OUTRO_MS);
  }

  public celebrate(): void {
    const { reels } = this.layout;
    this.stage.celebrate(reels.x + reels.width / 2, reels.y + reels.height * 0.4, [PALETTE.rose, PALETTE.amber, PALETTE.mint]);
  }

  public isAnimating(): boolean {
    return this.model().phase === 'idle';
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const view = this.model();
    const { playfield } = frame;
    const area: Rect = { ...playfield, y: playfield.y + READOUT_HEIGHT, height: playfield.height - READOUT_HEIGHT };
    this.layout = layoutOf(area);
    drawReadout(context, frame, view);
    drawCounter(context, this.layout, view.bonus, view.stickyCells.size);
    this.drawReels(context);
    if (view.bonus !== null) drawLocks(context, this.layout, view.stickyCells);
    drawLines(context, this.layout, this.lines, this.linesProgress);
    drawBanner(context, this.layout.reels, this.banner);
  }

  private drawReels(context: CanvasRenderingContext2D): void {
    const { reels } = this.layout;
    fillRoundRect(context, reels, PALETTE.dusk, 16);
    strokeRoundRect(context, reels, REEL_LINE, 1.5, 16);
    context.save();
    roundRectPath(context, reels, 16);
    context.clip();
    this.reels.draw(this.layout, (symbol, cell) => this.drawCell(context, symbol, cell));
    context.restore();
    for (const [index, symbol] of this.held) {
      const { x, y } = cellCenter(this.layout, index);
      this.drawCell(context, symbol, { x, y, boardIndex: index, isBlurred: false });
    }
  }

  private drawCell(context: CanvasRenderingContext2D, symbol: ReelSymbol, { x, y, isBlurred }: ReelCell): void {
    const { cell } = this.layout;
    fillRoundRect(context, { x: x - cell / 2, y: y - cell / 2, width: cell, height: cell }, PALETTE.panel, 12);
    context.globalAlpha = isBlurred ? 0.55 : 1;
    drawSymbol(context, symbol, x, y, cell * 0.86);
    context.globalAlpha = 1;
  }

  private showBanner(banner: Banner, durationMs: number): Promise<boolean> {
    this.banner = banner;
    return this.stage.animator.play(durationMs * this.pace(), (p) => (banner.progress = p)).finally(() => (this.banner = null));
  }

  private pace(): number {
    return this.model().isFastGame ? FAST_PACE : 1;
  }
}
