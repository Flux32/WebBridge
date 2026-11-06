/**
 * Joker Slot on the bridge: one `ApplySpinResult` is the whole round. The base board stops, its paylines
 * light, the jokers collect; a bonus then swaps in its board and plays every bonus board the same way. Only
 * after the last one does the host hear the single `SpinReady`.
 */
import { BridgeLogger, type JokerSlotBridge } from '@omega/webbridge-js';
import type { JokerSlotSpinResult } from '@omega/webbridge-protocol';
import { MoveQueue } from '../../kit/MoveQueue';
import type { SlotCoinCollection } from '../slot-coin/slotCoinRound';
import type { SlotCoinSymbol } from '../slot-coin/slotCoinSymbols';
import {
  JokerSlotRoundError,
  planJokerSlotRound,
  type JokerSlotBoardPlan,
  type JokerSlotRoundPlan,
  type JokerSlotStep,
  type PlacedSymbol,
} from './jokerSlotRound';

export interface JokerSlotMotions {
  spin(cells: readonly SlotCoinSymbol[]): Promise<boolean>;
  showLine(cells: readonly number[]): Promise<boolean>;
  place(symbols: readonly PlacedSymbol[]): Promise<boolean>;
  swapBoard(cells: readonly SlotCoinSymbol[]): Promise<boolean>;
  collect(collection: SlotCoinCollection): Promise<boolean>;
  boost(triggerIndex: number, multiplier: number): Promise<boolean>;
  celebrate(): void;
}

export type JokerSlotPhase = 'idle' | 'spinning' | 'lines' | 'collecting' | 'bonus' | 'broken';

export class JokerSlotController {
  public phase: JokerSlotPhase = 'idle';
  public lastResult = '';
  /** What the round paid so far, in base bets: lines and collections add up as they play. */
  public total = 0;
  /** Bonus spins left; `null` outside the bonus. */
  public spinsLeft: number | null = null;
  private readonly queue = new MoveQueue();
  private readonly unsubscribe: () => void;

  public constructor(
    private readonly bridge: JokerSlotBridge,
    private readonly motions: JokerSlotMotions,
  ) {
    this.unsubscribe = bridge.spinResultReceived.add((result) => this.queue.enqueue(() => this.playRound(result)));
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribe();
  }

  private async playRound(result: JokerSlotSpinResult): Promise<boolean> {
    const plan = this.plan(result);
    if (plan === null) return true;
    this.total = 0;
    this.spinsLeft = null;
    for (const board of plan.boards) {
      if (!(await this.playBoard(board))) return false;
    }
    this.finish(plan);
    this.bridge.notifySpinReady();
    return true;
  }

  private async playBoard(board: JokerSlotBoardPlan): Promise<boolean> {
    this.phase = this.spinsLeft === null ? 'spinning' : 'bonus';
    if (!(await this.motions.spin(board.cells))) return false;
    for (const step of board.steps) {
      if (!(await this.playStep(step))) return false;
    }
    if (board.spinsLeft !== null) this.spinsLeft = board.spinsLeft;
    return true;
  }

  private async playStep(step: JokerSlotStep): Promise<boolean> {
    switch (step.kind) {
      case 'lines':
        this.phase = 'lines';
        this.total += step.coeff;
        return this.motions.showLine(step.cells);
      case 'place':
        return this.motions.place(step.symbols);
      case 'bonusBoard':
        this.phase = 'bonus';
        this.spinsLeft = 3;
        return this.motions.swapBoard(step.cells);
      case 'collect':
        this.phase = 'collecting';
        if (!(await this.motions.collect(step.collection))) return false;
        this.total += step.collection.coins.reduce((sum, coin) => sum + coin.coeff, 0);
        return true;
      case 'multiplier':
        return this.motions.boost(step.triggerIndex, step.multiplier);
    }
  }

  private finish(plan: JokerSlotRoundPlan): void {
    this.phase = 'idle';
    this.spinsLeft = null;
    this.lastResult = plan.isWin ? `Won ${plan.winText}` : 'No win';
    if (plan.isWin) this.motions.celebrate();
  }

  /**
   * The boundary of a round: a payload the scene cannot draw truthfully becomes a visible broken state.
   * No `SpinReady` follows — the round was not shown, so the bar stays locked and the fault stays in sight.
   */
  private plan(result: JokerSlotSpinResult): JokerSlotRoundPlan | null {
    try {
      return planJokerSlotRound(result);
    } catch (error) {
      if (!(error instanceof JokerSlotRoundError)) throw error;
      BridgeLogger.error(`[demo joker-slot] ApplySpinResult rejected: ${error.message}`);
      this.phase = 'broken';
      this.lastResult = error.message;
      return null;
    }
  }
}
