/**
 * Mine Slot drawn: the reels on top, the block field under them in the same columns, chests at the bottom.
 * A pickaxe leaves its reel cell, falls down its column and hits block after block; a dynamite falls and
 * blasts. Every move is a motion the controller awaits before it tells the host the round is played out.
 */
import { easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp } from '../../kit/easing';
import { fillRoundRect, withAlpha } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import type { MineSlotMotions } from './MineSlotController';
import { drawBlast, drawShards, drawStriker, landingOf, payoutLabel, type Blast, type Shards, type Striker } from './mineSlotEffects';
import { BLOCK_LOOKS, drawChests, drawField, type ChestPop, type Shake } from './mineSlotFieldPaint';
import { PICKAXE_BLOW_ANGLE, PICKAXE_REST_ANGLE } from './mineSlotGlyphs';
import { blockRect, boardCellCenter, chestRect, layoutOf, type MineLayout } from './mineSlotLayout';
import { drawReadout, READOUT_HEIGHT, type MineSlotViewModel } from './mineSlotReadout';
import { MineSlotReels, SPIN_MS } from './mineSlotReels';
import type { MineSlotBlockHit, MineSlotChestOpening, MineSlotRoundPlan, MineSlotStrike } from './mineSlotRound';

const IMPACT_MS = 160;
const SHATTER_MS = 420;
const RETIRE_MS = 180;
const CHEST_MS = 520;
const FIELD_BED = withAlpha(PALETTE.night, 0.45);

export class MineSlotView implements SceneRenderer, MineSlotMotions {
  private readonly reels = new MineSlotReels();
  private layout: MineLayout = layoutOf({ x: 0, y: 0, width: 0, height: 0 });
  private readonly usedCells = new Set<number>();
  private striker: Striker | null = null;
  private shards: Shards | null = null;
  private readonly shake: Shake = { cells: [], amount: 0 };
  private readonly blast: Blast = { x: 0, y: 0, progress: 0 };
  private readonly chestPop: ChestPop = { column: -1, coeff: 0, scale: 1 };

  public constructor(
    private readonly stage: Stage,
    private readonly model: () => MineSlotViewModel,
  ) {}

  public async spin(round: MineSlotRoundPlan): Promise<boolean> {
    this.usedCells.clear();
    this.reels.prepare(round.board);
    const isPlayed = await this.stage.animator.play(SPIN_MS, (p) => this.reels.advance(p * SPIN_MS));
    if (isPlayed) this.reels.settle();
    return isPlayed;
  }

  public async strike(strike: MineSlotStrike, hits: readonly MineSlotBlockHit[]): Promise<boolean> {
    const striker = this.striker?.strike === strike ? this.striker : this.launch(strike);
    const from = { x: striker.x, y: striker.y };
    const to = landingOf(this.layout, this.model().field, strike, hits);
    const fallMs = Math.min(520, 200 + Math.hypot(to.x - from.x, to.y - from.y) * 0.9);
    const hasLanded = await this.stage.animator.play(fallMs, (p) => {
      striker.x = lerp(from.x, to.x, easeInOutCubic(p));
      striker.y = lerp(from.y, to.y, easeInCubic(p));
      striker.angle = lerp(PICKAXE_REST_ANGLE, PICKAXE_BLOW_ANGLE, easeInOutCubic(p));
    });
    return hasLanded && this.impact(striker, hits);
  }

  public shatter(broken: readonly MineSlotBlockHit[]): Promise<boolean> {
    const { field } = this.model();
    for (const hit of broken) {
      const block = field?.blockAt(hit.cell);
      const rect = blockRect(this.layout, hit.cell);
      const colors = [block === undefined ? PALETTE.ink : BLOCK_LOOKS[block.tier].tone];
      this.stage.particles.burst({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, colors, count: 10, speed: 260 }, performance.now());
    }
    const shards: Shards = { hits: broken, labels: broken.map(payoutLabel), progress: 0 };
    this.shards = shards;
    return this.stage.animator.play(SHATTER_MS, (p) => (shards.progress = p)).finally(() => (this.shards = null));
  }

  public retire(strike: MineSlotStrike): Promise<boolean> {
    const { striker } = this;
    if (striker?.strike !== strike) return Promise.resolve(true);
    const fromAlpha = striker.alpha;
    return this.stage.animator.play(RETIRE_MS, (p) => (striker.alpha = fromAlpha * (1 - p))).finally(() => (this.striker = null));
  }

  public openChest(chest: MineSlotChestOpening): Promise<boolean> {
    Object.assign(this.chestPop, { column: chest.column, coeff: chest.coeff, scale: 0 });
    const rect = chestRect(this.layout, chest.column);
    const burst = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, colors: [PALETTE.amber, PALETTE.copper], count: 18, speed: 380 };
    this.stage.particles.burst(burst, performance.now());
    return this.stage.animator.play(CHEST_MS, (p) => (this.chestPop.scale = easeOutBack(p))).finally(() => (this.chestPop.column = -1));
  }

  public celebrate(): void {
    const { field } = this.layout;
    this.stage.celebrate(field.x + field.width / 2, field.y + field.height * 0.3, [PALETTE.copper, PALETTE.amber, PALETTE.mint]);
  }

  public isAnimating(): boolean {
    return this.model().phase === 'idle';
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const view = this.model();
    const { playfield } = frame;
    this.layout = layoutOf({ ...playfield, y: playfield.y + READOUT_HEIGHT, height: playfield.height - READOUT_HEIGHT });
    this.reels.drawWindow(context, this.layout, this.usedCells);
    fillRoundRect(context, this.layout.field, FIELD_BED, 14);
    drawField(context, this.layout, view.field, this.shake);
    drawChests(context, this.layout, view.openedChests, this.chestPop);
    drawShards(context, this.layout, view.field, this.shards);
    drawBlast(context, this.layout, this.blast);
    drawStriker(context, this.striker, this.layout.cell * 0.86);
    drawReadout(context, frame, view);
  }

  private launch(strike: MineSlotStrike): Striker {
    this.usedCells.add(strike.boardIndex);
    const { x, y } = boardCellCenter(this.layout, strike.boardIndex);
    this.striker = { strike, x, y, angle: PICKAXE_REST_ANGLE, alpha: 1 };
    return this.striker;
  }

  /** The blow: the struck blocks shake; a pickaxe recoils, a dynamite goes off. */
  private impact(striker: Striker, hits: readonly MineSlotBlockHit[]): Promise<boolean> {
    this.shake.cells = hits.map((hit) => hit.cell);
    const isBlast = striker.strike.kind === 'dynamite';
    if (isBlast) this.detonate(striker);
    const restY = striker.y;
    return this.stage.animator.play(IMPACT_MS, (p) => {
      this.shake.amount = 1 - p;
      if (isBlast) this.blast.progress = p;
      striker.angle = lerp(PICKAXE_BLOW_ANGLE, PICKAXE_REST_ANGLE, easeOutCubic(p));
      striker.y = restY - Math.sin(Math.PI * p) * this.layout.cell * 0.12;
    });
  }

  private detonate(striker: Striker): void {
    striker.alpha = 0;
    Object.assign(this.blast, { x: striker.x, y: striker.y, progress: 0 });
    const burst = { x: striker.x, y: striker.y, colors: [PALETTE.coral, PALETTE.amber], count: 24, speed: 420 };
    this.stage.particles.burst(burst, performance.now());
  }
}
