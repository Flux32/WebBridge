/**
 * Crush on the bridge: every step is played out before the host hears `SpinReady`. A lost step gets no
 * `RestartRound` from the host — the engine resets the scene itself, then reports. A won round and a
 * cash out do get one, and the scene answers it the same way: reset, then `SpinReady`.
 */
import { BridgeLogger, type CrushBridge, type RestartRequest } from '@omega/webbridge-js';
import type { StepResultPayload } from '@omega/webbridge-protocol';
import { MoveQueue } from '../../kit/MoveQueue';
import { CrushRound, toLadder } from './crushRound';

export interface CrushMotions {
  hop(toStep: number): Promise<boolean>;
  crush(): Promise<boolean>;
  rewind(): Promise<boolean>;
  bonus(): Promise<boolean>;
  celebrate(): void;
}

/** The ladder the shell itself falls back to before the server's config arrives. */
const LADDER_BEFORE_CONFIG = [1.03, 1.08, 1.13, 1.19, 1.25, 1.32, 1.39, 1.47, 1.55, 1.64];

export type CrushPhase = 'idle' | 'playing' | 'crushed' | 'won' | 'bonus';

export class CrushController {
  public readonly round = new CrushRound(LADDER_BEFORE_CONFIG);
  public phase: CrushPhase = 'idle';
  public lastResult = '';
  private readonly queue = new MoveQueue();
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: CrushBridge,
    private readonly motions: CrushMotions,
  ) {
    this.unsubscribers = [
      bridge.coefficientsReceived.add((ladder) => this.applyLadder(ladder)),
      bridge.gameConfigReceived.add((config) => this.applyLadder(config.coefficients)),
      bridge.gameStateReceived.add((state) => this.restore(state)),
      bridge.stepResultReceived.add((result) => this.queue.enqueue(() => this.playStep(result))),
      bridge.restartRequested.add((request) => this.queue.enqueue(() => this.restart(request))),
      bridge.bonusStartRequested.add(() => this.queue.enqueue(() => this.playBonus())),
    ];
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private applyLadder(values: readonly unknown[]): void {
    const ladder = toLadder(values);
    if (ladder === null) {
      BridgeLogger.error(`[demo crush] the ladder is not a list of numbers: ${JSON.stringify(values)}`);
      return;
    }
    if (ladder.length > 0) this.round.setLadder(ladder);
  }

  private restore(state: unknown): void {
    const lineNumber = (state as { lineNumber?: unknown } | null)?.lineNumber;
    if (typeof lineNumber !== 'number') return;
    this.round.restore(lineNumber);
    this.phase = lineNumber >= 0 ? 'playing' : 'idle';
  }

  private async playStep(result: StepResultPayload): Promise<boolean> {
    const outcome = this.round.applyStep(result);
    this.phase = 'playing';
    if (outcome === 'crush') return this.playCrush();
    if (!(await this.motions.hop(this.round.step))) return false;
    if (outcome === 'top') {
      this.phase = 'won';
      this.motions.celebrate();
    }
    this.bridge.notifySpinReady();
    return true;
  }

  private async playCrush(): Promise<boolean> {
    this.phase = 'crushed';
    if (!(await this.motions.crush())) return false;
    this.lastResult = `Crushed on step ${this.round.step + 1}`;
    if (!(await this.rewind())) return false;
    this.bridge.notifySpinReady();
    return true;
  }

  private async restart(request: RestartRequest): Promise<boolean> {
    this.lastResult = request.amount === '' ? '' : `${request.reason} ${request.amount}`.trim();
    if (!(await this.rewind())) return false;
    this.bridge.notifySpinReady();
    return true;
  }

  private async rewind(): Promise<boolean> {
    const isPlayed = await this.motions.rewind();
    this.round.reset();
    this.phase = 'idle';
    return isPlayed;
  }

  private async playBonus(): Promise<boolean> {
    this.phase = 'bonus';
    this.bridge.notifyBonusActive();
    if (!(await this.motions.bonus())) return false;
    this.bridge.notifyBonusEnded();
    this.bridge.clearBonusAutoPlayProgress();
    this.bridge.notifyBonusCleared();
    this.phase = 'idle';
    return true;
  }
}
