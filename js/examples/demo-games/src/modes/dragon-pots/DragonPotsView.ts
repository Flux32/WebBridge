/**
 * Dragon Pots drawn: the win readout, the three pots, the 5 × 3 reels — or, in a feature, the jackpot pick
 * over them and the Hold & Win board in their place. Coins fly from their cells into their pots, triggered
 * pots burst, banners close the features and the round. Every move is a motion the controller awaits; a
 * fast game plays each in less time.
 */
import { DRAGON_POTS_JACKPOT_TIERS, type DragonPotsPotColor } from '@omega/webbridge-protocol';
import { easeInOutCubic, lerp } from '../../kit/easing';
import { fillRoundRect, roundRectPath, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import type { DragonPotsMotions } from './DragonPotsController';
import type { HoldAndWinCoin, HoldAndWinPlan, JackpotPlan } from './dragonPotsFeatures';
import { drawPotCoin, drawSymbol, POT_TONES } from './dragonPotsGlyphs';
import { cellRectAt, layoutOf, potCenter, reelCellCenter, type DragonLayout } from './dragonPotsLayout';
import { drawBanner, drawHoldAndWin, drawJackpot, drawPots, type Banner, type PotPulse } from './dragonPotsOverlays';
import { drawReadout, READOUT_HEIGHT, type DragonPotsViewModel } from './dragonPotsReadout';
import { DragonPotsReels, SPIN_MS, type ReelCell } from './dragonPotsReels';
import { REEL_ROWS, type CoinDrop, type DragonPotsPlan, type WayPlan } from './dragonPotsRound';
import type { SymbolKind } from './dragonPotsSymbols';

const WAYS_MS = 600;
const DROP_MS = 520;
const BURST_MS = 560;
const JACKPOT_OPEN_MS = 280;
const TILE_MS = 200;
const JACKPOT_WIN_MS = 850;
const HOLD_AND_WIN_OPEN_MS = 550;
const RESPIN_MS = 170;
const LAND_MS = 260;
const HOLD_AND_WIN_CLOSE_MS = 750;
const TOTAL_MS = 950;
/** A fast game plays every motion in this share of its time. */
const FAST_PACE = 0.4;
const WAY_LINE = PALETTE.amber;

interface Flight {
  readonly coins: readonly CoinDrop[];
  progress: number;
}

export class DragonPotsView implements SceneRenderer, DragonPotsMotions {
  private readonly reels = new DragonPotsReels();
  private layout: DragonLayout = layoutOf({ x: 0, y: 0, width: 0, height: 0 }, REEL_ROWS);
  private reelLayout: DragonLayout = this.layout;
  private coinsByCell = new Map<number, CoinDrop>();
  private readonly flownCells = new Set<number>();
  private ways: readonly WayPlan[] = [];
  private waysProgress = 0;
  private flight: Flight | null = null;
  private pulse: PotPulse = {};
  private flip = 1;
  private readonly landing = { newest: -1, pop: 1, flash: 0, shimmer: 0 };
  private banner: Banner | null = null;

  public constructor(
    private readonly stage: Stage,
    private readonly model: () => DragonPotsViewModel,
  ) {}

  public async spin(plan: DragonPotsPlan): Promise<boolean> {
    this.ways = [];
    this.flownCells.clear();
    this.coinsByCell = new Map(plan.coins.map((coin) => [coin.cell, coin]));
    this.reels.prepare(plan.board);
    const isPlayed = await this.play(SPIN_MS, (p) => this.reels.advance(p * SPIN_MS));
    if (isPlayed) this.reels.settle();
    return isPlayed;
  }

  public showWays(ways: readonly WayPlan[]): Promise<boolean> {
    this.ways = ways;
    return this.play(WAYS_MS, (p) => (this.waysProgress = p));
  }

  public dropCoins(coins: readonly CoinDrop[]): Promise<boolean> {
    const flight: Flight = { coins, progress: 0 };
    this.flight = flight;
    coins.forEach((coin) => this.flownCells.add(coin.cell));
    return this.play(DROP_MS, (p) => (flight.progress = p)).finally(() => (this.flight = null));
  }

  public burstPots(pots: readonly DragonPotsPotColor[]): Promise<boolean> {
    for (const pot of pots) {
      const { x, y } = potCenter(this.layout, pot);
      this.stage.particles.burst({ x, y, colors: [POT_TONES[pot], PALETTE.amber], count: 22, speed: 420 }, performance.now());
    }
    return this.play(BURST_MS, (p) => (this.pulse = Object.fromEntries(pots.map((pot) => [pot, 1 + 0.16 * Math.sin(Math.PI * p)])))).finally(
      () => (this.pulse = {}),
    );
  }

  public openJackpot(): Promise<boolean> {
    this.flip = 1;
    return this.play(JACKPOT_OPEN_MS, () => undefined);
  }

  public revealTile(): Promise<boolean> {
    return this.play(TILE_MS, (p) => (this.flip = p));
  }

  public winJackpot(jackpot: JackpotPlan): Promise<boolean> {
    const doubled = jackpot.isDouble ? ' ×2' : '';
    const title = `${DRAGON_POTS_JACKPOT_TIERS[jackpot.won].name} JACKPOT ×${jackpot.coeff}${doubled}`;
    return this.showBanner({ title, value: `+${jackpot.winAmount.toFixed(2)}`, progress: 0 }, JACKPOT_WIN_MS);
  }

  public openHoldAndWin(plan: HoldAndWinPlan): Promise<boolean> {
    Object.assign(this.landing, { newest: -1, pop: 1, flash: 0 });
    return this.showBanner({ title: 'HOLD & WIN', value: plan.boardSize, progress: 0 }, HOLD_AND_WIN_OPEN_MS);
  }

  public respin(): Promise<boolean> {
    return this.play(RESPIN_MS, (p) => (this.landing.shimmer = Math.sin(Math.PI * p)));
  }

  public landCoin(coin: HoldAndWinCoin): Promise<boolean> {
    this.landing.newest = coin.cell;
    return this.play(LAND_MS, (p) => {
      this.landing.pop = p / 0.6;
      this.landing.flash = p < 0.6 ? 0 : Math.sin((Math.PI * (p - 0.6)) / 0.4);
    });
  }

  public closeHoldAndWin(winAmount: number): Promise<boolean> {
    return this.showBanner({ title: 'HOLD & WIN PAYS', value: `+${winAmount.toFixed(2)}`, progress: 0 }, HOLD_AND_WIN_CLOSE_MS);
  }

  public showTotal(totalWin: number): Promise<boolean> {
    const { currency } = this.model();
    return this.showBanner({ title: 'TOTAL WIN', value: `${totalWin.toFixed(2)} ${currency}`, progress: 0 }, TOTAL_MS);
  }

  public celebrate(): void {
    const { board } = this.layout;
    this.stage.celebrate(board.x + board.width / 2, board.y + board.height * 0.4, [PALETTE.vermilion, PALETTE.amber, PALETTE.mint]);
  }

  public isAnimating(): boolean {
    return this.model().phase === 'idle';
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const view = this.model();
    const { playfield } = frame;
    const area: Rect = { ...playfield, y: playfield.y + READOUT_HEIGHT, height: playfield.height - READOUT_HEIGHT };
    this.reelLayout = layoutOf(area, REEL_ROWS);
    this.layout = view.holdAndWin === null ? this.reelLayout : layoutOf(area, view.holdAndWin.rows);
    drawReadout(context, frame, view);
    drawPots(context, this.layout, view.pots, this.pulse);
    if (view.holdAndWin === null) this.drawReels(context);
    else drawHoldAndWin(context, this.layout, view.holdAndWin, this.landing);
    if (view.jackpot !== null) drawJackpot(context, this.reelLayout.board, view.jackpot, this.flip);
    this.drawFlight(context);
    drawBanner(context, this.layout.board, this.banner);
  }

  private drawReels(context: CanvasRenderingContext2D): void {
    const { board } = this.layout;
    fillRoundRect(context, board, PALETTE.dusk, 16);
    strokeRoundRect(context, board, withAlpha(PALETTE.vermilion, 0.35), 1.5, 16);
    context.save();
    roundRectPath(context, board, 16);
    context.clip();
    this.reels.draw(this.layout, (kind, cell) => this.drawCell(context, kind, cell));
    context.restore();
    this.drawWays(context);
  }

  private drawCell(context: CanvasRenderingContext2D, kind: SymbolKind, { x, y, boardIndex, isBlurred }: ReelCell): void {
    const { cell } = this.layout;
    fillRoundRect(context, cellRectAt(this.layout, { x, y }), PALETTE.panel, 12);
    if (this.flownCells.has(boardIndex)) return;
    context.globalAlpha = isBlurred ? 0.55 : 1;
    const coin = this.coinsByCell.get(boardIndex);
    if (kind !== 'coin') drawSymbol(context, kind, x, y, cell * 0.86);
    else if (coin !== undefined) drawPotCoin(context, coin.color, coin.isGold, x, y, cell * 0.9);
    context.globalAlpha = 1;
  }

  private drawWays(context: CanvasRenderingContext2D): void {
    if (this.ways.length === 0) return;
    context.globalAlpha = Math.min(1, this.waysProgress * 3);
    for (const way of this.ways) {
      for (const index of way.cells) strokeRoundRect(context, cellRectAt(this.layout, reelCellCenter(this.layout, index)), WAY_LINE, 3, 12);
    }
    context.globalAlpha = 1;
  }

  private drawFlight(context: CanvasRenderingContext2D): void {
    if (this.flight === null) return;
    const t = easeInOutCubic(this.flight.progress);
    for (const coin of this.flight.coins) {
      const from = reelCellCenter(this.reelLayout, coin.cell);
      const to = potCenter(this.layout, coin.color);
      const lift = Math.sin(Math.PI * t) * this.layout.cell * 0.6;
      drawPotCoin(context, coin.color, coin.isGold, lerp(from.x, to.x, t), lerp(from.y, to.y, t) - lift, this.layout.cell * lerp(0.9, 0.6, t));
    }
  }

  private showBanner(banner: Banner, durationMs: number): Promise<boolean> {
    this.banner = banner;
    return this.play(durationMs, (p) => (banner.progress = p)).finally(() => (this.banner = null));
  }

  private play(durationMs: number, onFrame: (progress: number) => void): Promise<boolean> {
    return this.stage.animator.play(durationMs * (this.model().isFastGame ? FAST_PACE : 1), onFrame);
  }
}
