/**
 * Slot Coin on the bridge: one `ApplySpinResult` is the whole round. Its boards play in order — reels stop, the
 * coins fly to the trigger — and only after the last one does the host hear the single `SpinReady`.
 */
import { BridgeLogger, type SlotCoinBridge } from '@omega/webbridge-js';
import type { SlotCoinSpinResult } from '@omega/webbridge-protocol';
import { MoveQueue } from '../../kit/MoveQueue';
import {
  planSlotCoinRound,
  SlotCoinRoundError,
  type SlotCoinBoardPlan,
  type SlotCoinCollection,
  type SlotCoinRoundPlan,
} from './slotCoinRound';

export interface SlotCoinMotions {
  spin(board: SlotCoinBoardPlan): Promise<boolean>;
  collect(collection: SlotCoinCollection): Promise<boolean>;
  celebrate(): void;
}

export type SlotCoinPhase = 'idle' | 'spinning' | 'collecting' | 'broken';

export class SlotCoinController {
  public phase: SlotCoinPhase = 'idle';
  public lastResult = '';
  /** The round's multiplier so far: collected coins add up as they land. */
  public multiplier = 0;
  public boardNumber = 0;
  public boardCount = 0;
  private readonly queue = new MoveQueue();
  private readonly unsubscribe: () => void;

  public constructor(
    private readonly bridge: SlotCoinBridge,
    private readonly motions: SlotCoinMotions,
  ) {
    this.unsubscribe = bridge.spinResultReceived.add((result) => this.queue.enqueue(() => this.playRound(result)));
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribe();
  }

  private async playRound(result: SlotCoinSpinResult): Promise<boolean> {
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

  private async playBoard(board: SlotCoinBoardPlan): Promise<boolean> {
    this.phase = 'spinning';
    if (!(await this.motions.spin(board))) return false;
    if (board.collection === null) return true;
    this.phase = 'collecting';
    if (!(await this.motions.collect(board.collection))) return false;
    this.multiplier += board.collection.coins.reduce((sum, coin) => sum + coin.coeff, 0);
    return true;
  }

  private finish(plan: SlotCoinRoundPlan): void {
    this.phase = 'idle';
    this.multiplier = plan.coeff;
    this.lastResult = plan.isWin ? `Won ${plan.winText}` : 'No win';
    if (plan.isWin) this.motions.celebrate();
  }

  /**
   * The boundary of a round: a payload the scene cannot draw truthfully becomes a visible broken state.
   * No `SpinReady` follows — the round was not shown, so the bar stays locked and the fault stays in sight.
   */
  private plan(result: SlotCoinSpinResult): SlotCoinRoundPlan | null {
    try {
      return planSlotCoinRound(result);
    } catch (error) {
      if (!(error instanceof SlotCoinRoundError)) throw error;
      BridgeLogger.error(`[demo slot-coin] ApplySpinResult rejected: ${error.message}`);
      this.phase = 'broken';
      this.lastResult = error.message;
      return null;
    }
  }
}
