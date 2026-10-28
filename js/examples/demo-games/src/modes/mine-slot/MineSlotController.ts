/**
 * Mine Slot on the bridge: one `ApplySpinResult` is the whole reply — the base spin and every free spin, on
 * one field. Each round the reels stop, the pickaxes and then the dynamite strike, reached chests open; only
 * after the last round does the host hear the single `SpinReady`.
 */
import { BridgeLogger, type MineSlotBridge } from '@omega/webbridge-js';
import type { MineSlotSpinResult } from '@omega/webbridge-protocol';
import { MoveQueue } from '../../kit/MoveQueue';
import { MineField } from './mineSlotField';
import { MineSlotRoundError } from './mineSlotRead';
import {
  planMineSlotRound,
  type MineSlotBlockHit,
  type MineSlotChestOpening,
  type MineSlotPlan,
  type MineSlotRoundPlan,
  type MineSlotStrike,
} from './mineSlotRound';

export interface MineSlotMotions {
  spin(round: MineSlotRoundPlan): Promise<boolean>;
  /** The striker falls onto `hits`: one block for a pickaxe, the whole blast for a dynamite, none for an empty column. */
  strike(strike: MineSlotStrike, hits: readonly MineSlotBlockHit[]): Promise<boolean>;
  /** Blocks that just broke crumble; the paying ones pop their payout. */
  shatter(broken: readonly MineSlotBlockHit[]): Promise<boolean>;
  /** The striker has dealt all its damage and leaves the field. */
  retire(strike: MineSlotStrike): Promise<boolean>;
  openChest(chest: MineSlotChestOpening): Promise<boolean>;
  celebrate(): void;
}

export type MineSlotPhase = 'idle' | 'spinning' | 'mining' | 'broken';

export class MineSlotController {
  public phase: MineSlotPhase = 'idle';
  public lastResult = '';
  /** `null` until the first reply: the field arrives with it. */
  public field: MineField | null = null;
  public openedChests = new Map<number, number>();
  public roundNumber = 0;
  public roundCount = 0;
  private blockCoeff = 0;
  private chestMultiplier = 1;
  private finalCoeff: number | null = null;
  private readonly queue = new MoveQueue();
  private readonly unsubscribe: () => void;

  public constructor(
    private readonly bridge: MineSlotBridge,
    private readonly motions: MineSlotMotions,
  ) {
    this.unsubscribe = bridge.spinResultReceived.add((result) => this.queue.enqueue(() => this.playReply(result)));
  }

  /** The round's coefficient so far: broken blocks add up, opened chests multiply; the server's once played. */
  public get coefficient(): number {
    return this.finalCoeff ?? this.blockCoeff * this.chestMultiplier;
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribe();
  }

  private async playReply(result: MineSlotSpinResult): Promise<boolean> {
    const plan = this.plan(result);
    if (plan === null) return true;
    this.begin(plan);
    for (const [index, round] of plan.rounds.entries()) {
      this.roundNumber = index + 1;
      if (!(await this.playRound(round))) return false;
    }
    this.finish(plan);
    this.bridge.notifySpinReady();
    return true;
  }

  private begin(plan: MineSlotPlan): void {
    this.field = new MineField(plan.blocks);
    this.openedChests = new Map();
    this.roundCount = plan.rounds.length;
    this.blockCoeff = 0;
    this.chestMultiplier = 1;
    this.finalCoeff = null;
  }

  private async playRound(round: MineSlotRoundPlan): Promise<boolean> {
    this.phase = 'spinning';
    if (!(await this.motions.spin(round))) return false;
    this.phase = 'mining';
    for (const strike of round.strikes) {
      if (!(await this.playStrike(strike))) return false;
    }
    for (const chest of round.chests) {
      if (!(await this.motions.openChest(chest))) return false;
      this.openedChests.set(chest.column, chest.coeff);
      this.chestMultiplier *= chest.coeff;
    }
    return true;
  }

  /** A pickaxe hits its blocks one by one, top down; a dynamite's blast lands on all of them at once. */
  private async playStrike(strike: MineSlotStrike): Promise<boolean> {
    const volleys = strike.kind === 'dynamite' || strike.hits.length === 0 ? [strike.hits] : strike.hits.map((hit) => [hit]);
    for (const hits of volleys) {
      if (!(await this.motions.strike(strike, hits))) return false;
      const broken = hits.filter((hit) => this.field?.hit(hit.cell, hit.damage) === true);
      if (broken.length === 0) continue;
      // Counted as the blocks crumble: the big number jumps with the payout popping out of the field.
      this.blockCoeff += broken.reduce((sum, hit) => sum + (hit.coeff ?? 0), 0);
      if (!(await this.motions.shatter(broken))) return false;
    }
    return this.motions.retire(strike);
  }

  private finish(plan: MineSlotPlan): void {
    this.phase = 'idle';
    this.finalCoeff = plan.coeff;
    this.lastResult = plan.isWin ? `Won ${plan.winText}` : 'No win';
    if (plan.isWin) this.motions.celebrate();
  }

  /**
   * The boundary of a reply: one the scene cannot draw truthfully becomes a visible broken state. No
   * `SpinReady` follows — the round was not shown, so the bar stays locked and the fault stays in sight.
   */
  private plan(result: MineSlotSpinResult): MineSlotPlan | null {
    try {
      return planMineSlotRound(result);
    } catch (error) {
      if (!(error instanceof MineSlotRoundError)) throw error;
      BridgeLogger.error(`[demo mine-slot] ApplySpinResult rejected: ${error.message}`);
      this.phase = 'broken';
      this.lastResult = error.message;
      return null;
    }
  }
}
