/**
 * Slot on the bridge: one `ApplySpinResult` is the whole round. Its boards play in order — reels stop, the
 * coins fly to the trigger — and only after the last one does the host hear the single `SpinReady`.
 */
import { BridgeLogger, type SlotBridge } from '@omega/webbridge-js';
import type { SlotSpinResult } from '@omega/webbridge-protocol';
import { MoveQueue } from '../../kit/MoveQueue';
import {
  planSlotRound,
  SlotRoundError,
  type SlotBoardPlan,
  type SlotCollection,
  type SlotRoundPlan,
} from './slotRound';

export interface SlotMotions {
  spin(board: SlotBoardPlan): Promise<boolean>;
  collect(collection: SlotCollection): Promise<boolean>;
  celebrate(): void;
}

export type SlotPhase = 'idle' | 'spinning' | 'collecting' | 'broken';

export class SlotController {
  public phase: SlotPhase = 'idle';
  public lastResult = '';
  /** The round's multiplier so far: collected coins add up as they land. */
  public multiplier = 0;
  public boardNumber = 0;
  public boardCount = 0;
  private readonly queue = new MoveQueue();
  private readonly unsubscribe: () => void;

  public constructor(
    private readonly bridge: SlotBridge,
    private readonly motions: SlotMotions,
  ) {
    this.unsubscribe = bridge.spinResultReceived.add((result) => this.queue.enqueue(() => this.playRound(result)));
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribe();
  }

  private async playRound(result: SlotSpinResult): Promise<boolean> {
    const plan = this.plan(result);
    if (plan === null) return true;
    this.multiplier = 0;
    this.boardCount = plan.boards.length;
    for (const [index, board] of plan.boards.entries()) {
      this.boardNumber = index + 1;
      if (!(await this.playBoard(board))) return false;
    }
    this.finish(plan);
    this.bridge.notifySpinReady();
    return true;
  }

  private async playBoard(board: SlotBoardPlan): Promise<boolean> {
    this.phase = 'spinning';
    if (!(await this.motions.spin(board))) return false;
    if (board.collection === null) return true;
    this.phase = 'collecting';
    if (!(await this.motions.collect(board.collection))) return false;
    this.multiplier += board.collection.coins.reduce((sum, coin) => sum + coin.coeff, 0);
    return true;
  }

  private finish(plan: SlotRoundPlan): void {
    this.phase = 'idle';
    this.multiplier = plan.coeff;
    this.lastResult = plan.isWin ? `Won ${plan.winText}` : 'No win';
    if (plan.isWin) this.motions.celebrate();
  }

  /**
   * The boundary of a round: a payload the scene cannot draw truthfully becomes a visible broken state.
   * No `SpinReady` follows — the round was not shown, so the bar stays locked and the fault stays in sight.
   */
  private plan(result: SlotSpinResult): SlotRoundPlan | null {
    try {
      return planSlotRound(result);
    } catch (error) {
      if (!(error instanceof SlotRoundError)) throw error;
      BridgeLogger.error(`[demo slot] ApplySpinResult rejected: ${error.message}`);
      this.phase = 'broken';
      this.lastResult = error.message;
      return null;
    }
  }
}
