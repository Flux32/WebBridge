/**
 * Fruit Love Fever on the bridge. `ApplySpinResult` plays the base spin; an unfinished reply opens a bonus:
 * the intro, then per free spin a `RequestStep` and the host's `ApplyBonusStepResult`, with every wild that
 * lands locked in its cell until the bonus ends. The host hears `SpinReady` once per round — after the base
 * spin, or after the last free spin and the bonus total. An unfinished `ApplyGameState` resumes the bonus;
 * one that arrives while a step is awaited re-sends `RequestStep`.
 */
import { BridgeLogger, type FruitLoveFeverBridge } from '@omega/webbridge-js';
import type { FruitLoveFeverGameState, FruitLoveFeverStepResult } from '@omega/webbridge-protocol';
import { MoveQueue } from '../../kit/MoveQueue';
import { FruitLoveFeverRoundError } from './fruitLoveFeverRead';
import { assertStickyWilds, planFruitSpin, wildCellsOf, type BonusProgress, type FruitSpinPlan } from './fruitLoveFeverRound';

export interface FruitLoveFeverMotions {
  /** The reels spin and stop on the plan's board; `locked` cells hold their sticky wild meanwhile. */
  spin(plan: FruitSpinPlan, locked: ReadonlySet<number>): Promise<boolean>;
  /** A resumed bonus: the board stands as the state left it, no spin. */
  place(plan: FruitSpinPlan): void;
  showLines(plan: FruitSpinPlan): Promise<boolean>;
  bonusIntro(bonus: BonusProgress): Promise<boolean>;
  bonusOutro(totalWin: number): Promise<boolean>;
  celebrate(): void;
}

export type FruitLoveFeverPhase = 'idle' | 'spinning' | 'paying' | 'intro' | 'waiting' | 'outro' | 'broken';

export class FruitLoveFeverController {
  public phase: FruitLoveFeverPhase = 'idle';
  public lastResult = '';
  public totalWin = 0;
  public spinWin = 0;
  public currency = '';
  public bonus: BonusProgress | null = null;
  public stickyCells = new Set<number>();
  private isRoundInHand = false;
  private stepWaiter: ((step: FruitLoveFeverStepResult | null) => void) | null = null;
  private readonly queue = new MoveQueue();
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: FruitLoveFeverBridge,
    private readonly motions: FruitLoveFeverMotions,
  ) {
    this.unsubscribers = [
      bridge.spinResultReceived.add((reply) => this.enqueueRound(() => this.playRound(reply))),
      bridge.stepResultReceived.add((step) => this.deliverStep(step)),
      bridge.gameStateReceived.add((state) => this.onGameState(state)),
    ];
  }

  public get isFastGame(): boolean {
    return this.bridge.isFastGameEnabled;
  }

  public destroy(): void {
    this.queue.close();
    this.stepWaiter?.(null);
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private enqueueRound(round: () => Promise<boolean>): void {
    this.isRoundInHand = true;
    this.queue.enqueue(round);
  }

  private async playRound(reply: unknown): Promise<boolean> {
    const plan = this.plan(reply, new Set());
    if (plan === null) return true;
    this.stickyCells = new Set();
    this.bonus = null;
    if (!(await this.playSpin(plan))) return false;
    if (plan.isFinished) return this.finish(plan);
    this.phase = 'intro';
    if (!(await this.motions.bonusIntro(plan.bonus))) return false;
    return this.playBonus();
  }

  /** A bonus in progress after a reload: its board stands, the free spins go on from where it stopped. */
  private resume(state: FruitLoveFeverGameState): Promise<boolean> {
    const plan = this.plan(state, new Set());
    if (plan === null) return Promise.resolve(true);
    if (plan.isFinished) {
      this.isRoundInHand = false;
      return Promise.resolve(true);
    }
    this.apply(plan);
    // The wilds of a free spin are sticky; the base spin's that started the bonus are not.
    this.stickyCells = new Set(plan.bonus.played > 0 ? wildCellsOf(plan) : []);
    this.motions.place(plan);
    return this.playBonus();
  }

  private async playBonus(): Promise<boolean> {
    for (;;) {
      this.phase = 'waiting';
      const step = await this.nextStep();
      if (step === null) return false;
      const plan = this.plan(step, this.stickyCells);
      if (plan === null) return true;
      if (!(await this.playSpin(plan))) return false;
      wildCellsOf(plan).forEach((cell) => this.stickyCells.add(cell));
      if (!plan.isFinished) continue;
      this.phase = 'outro';
      if (!(await this.motions.bonusOutro(plan.totalWin))) return false;
      return this.finish(plan);
    }
  }

  private async playSpin(plan: FruitSpinPlan): Promise<boolean> {
    this.phase = 'spinning';
    if (!(await this.motions.spin(plan, this.stickyCells))) return false;
    this.apply(plan);
    if (plan.lines.length === 0) return true;
    this.phase = 'paying';
    return this.motions.showLines(plan);
  }

  private apply(plan: FruitSpinPlan): void {
    this.totalWin = plan.totalWin;
    this.spinWin = plan.spinWin;
    this.currency = plan.currency;
    this.bonus = plan.bonus;
  }

  private finish(plan: FruitSpinPlan): boolean {
    this.phase = 'idle';
    this.isRoundInHand = false;
    this.lastResult = plan.totalWin > 0 ? `Won ${plan.totalWin.toFixed(2)} ${plan.currency}` : 'No win';
    if (plan.totalWin > 0) this.motions.celebrate();
    this.bridge.notifySpinReady();
    return true;
  }

  /** Waits for the host's answer to `RequestStep`; `null` once the game is destroyed. */
  private nextStep(): Promise<FruitLoveFeverStepResult | null> {
    return new Promise((resolve) => {
      // Set before the request: a host may answer inside `requestStep()` itself.
      this.stepWaiter = resolve;
      this.bridge.requestStep();
    });
  }

  private deliverStep(step: FruitLoveFeverStepResult): void {
    const waiter = this.stepWaiter;
    if (waiter === null) {
      BridgeLogger.warn('[demo fruit-love-fever] ApplyBonusStepResult without a RequestStep: not played');
      return;
    }
    this.stepWaiter = null;
    waiter(step);
  }

  private onGameState(state: FruitLoveFeverGameState): void {
    // A reconnect while a free spin is awaited: the request may be lost, so it goes again.
    if (this.stepWaiter !== null) {
      this.bridge.requestStep();
      return;
    }
    if (state.status === 'none' || state.isFinished || this.isRoundInHand) return;
    this.enqueueRound(() => this.resume(state));
  }

  /**
   * The boundary of a reply: one the scene cannot draw truthfully becomes a visible broken state. No
   * `SpinReady` follows — the round was not shown, so the bar stays locked and the fault stays in sight.
   */
  private plan(reply: unknown, sticky: ReadonlySet<number>): FruitSpinPlan | null {
    try {
      const plan = planFruitSpin(reply);
      assertStickyWilds(sticky, plan);
      return plan;
    } catch (error) {
      if (!(error instanceof FruitLoveFeverRoundError)) throw error;
      BridgeLogger.error(`[demo fruit-love-fever] reply rejected: ${error.message}`);
      this.phase = 'broken';
      this.isRoundInHand = false;
      this.lastResult = error.message;
      return null;
    }
  }
}
