/**
 * Plinko Aztec on the bridge. A drop (`ApplyDropResult`) plays every ball, then the wheel when a ball hit
 * the spin slot, then — when the wheel started one — the bonus game: each tap asks the host for a step
 * (`RequestStep`) and its balls (`ApplyBonusStepResult`) play the same way. The host hears `DropFinished`
 * once per drop, after all of that has played out: that is when the bet bar unlocks.
 */
import { BridgeLogger, type PlinkoAztecBridge } from '@omega/webbridge-js';
import { MoveQueue } from '../../kit/MoveQueue';
import { PlinkoPayloadError, readRecord, readText } from '../plinko/payload';
import type { Slot } from '../plinko/slotLine';
import type { AztecPhase, AztecSelection } from './aztecReadout';
import { aztecLineOf, readAztecDrop, readBonus, type AztecBonus, type AztecDrop } from './aztecRound';
import { wheelSpinOf, type WheelSpin } from './wheel';

export interface AztecMotions {
  /** Drops a ball into each slot, staggered; resolves once the last one has landed. */
  drop(slots: readonly number[]): Promise<boolean>;
  spinWheel(spin: WheelSpin): Promise<boolean>;
  celebrate(): void;
}

interface PlayableDrop {
  readonly drop: AztecDrop;
  readonly wheel: WheelSpin | null;
}

export class PlinkoAztecController {
  public phase: AztecPhase = 'idle';
  public line: readonly Slot[] = [];
  public currency = '';
  public lastDrop: AztecDrop | null = null;
  public bonus: AztecBonus | null = null;
  public ballsInPlay = 0;
  public error: string | null = null;
  /** A drop whose bonus game is still running: its `DropFinished` waits for the bonus to end. */
  private isDropUnreported = false;
  private readonly queue = new MoveQueue();
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: PlinkoAztecBridge,
    private readonly motions: AztecMotions,
  ) {
    this.unsubscribers = [
      bridge.gameConfigReceived.add((config) => this.read(() => this.applyConfig(config))),
      bridge.gameStateReceived.add((state) => this.read(() => this.restore(readBonus(state)))),
      bridge.dropResultReceived.add((state) => this.queue.enqueue(() => this.playDrop(state))),
      bridge.stepResultReceived.add((state) => this.queue.enqueue(() => this.playStep(state))),
    ];
  }

  public get selection(): AztecSelection {
    return { ballsAmount: this.bridge.currentBallsAmount, betPerBall: this.bridge.currentBetPerBall };
  }

  /** In the bonus game a tap is the next step, asked once until it lands; otherwise it is the Play button. */
  public onTap(): void {
    if (this.phase === 'bonus-step') return;
    if (this.phase !== 'bonus') {
      this.bridge.requestPlay();
      return;
    }
    this.phase = 'bonus-step';
    this.bridge.requestStep();
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private applyConfig(config: unknown): void {
    this.line = aztecLineOf(config);
    this.currency = readText(readRecord(readRecord(config, 'config').betConfig, 'config.betConfig'), 'currency');
  }

  /** A bonus game the server still runs after a reload: the player steps on through it. */
  private restore(bonus: AztecBonus | null): void {
    if (bonus === null || this.phase !== 'idle') return;
    this.bonus = bonus;
    this.phase = 'bonus';
  }

  private async playDrop(state: unknown): Promise<boolean> {
    const playable = this.read(() => this.playableOf(state));
    if (playable === null) return true;
    const { drop, wheel } = playable;
    this.isDropUnreported = true;
    if (!(await this.dropBalls(drop, 'dropping'))) return false;
    if (wheel !== null) {
      this.phase = 'wheel';
      if (!(await this.motions.spinWheel(wheel))) return false;
    }
    return drop.bonus === null ? this.finish(drop) : this.enterBonus(drop.bonus);
  }

  private async playStep(state: unknown): Promise<boolean> {
    const playable = this.read(() => this.playableOf(state));
    if (playable === null) return true;
    const { drop } = playable;
    if (!(await this.dropBalls(drop, 'bonus-step'))) return false;
    return drop.bonus === null ? this.finish(drop) : this.enterBonus(drop.bonus);
  }

  private dropBalls(drop: AztecDrop, phase: AztecPhase): Promise<boolean> {
    this.phase = phase;
    this.ballsInPlay = drop.slots.length;
    return this.motions.drop(drop.slots);
  }

  private enterBonus(bonus: AztecBonus): boolean {
    this.bonus = bonus;
    this.phase = 'bonus';
    return true;
  }

  private finish(drop: AztecDrop): boolean {
    const isBig = drop.freeSpin !== null || this.bonus !== null || drop.slots.some((slot) => this.line[slot]?.tone === 'hot');
    this.phase = 'idle';
    this.bonus = null;
    this.lastDrop = drop;
    if (isBig) this.motions.celebrate();
    if (this.isDropUnreported) this.bridge.notifyDropFinished();
    this.isDropUnreported = false;
    return true;
  }

  private playableOf(state: unknown): PlayableDrop {
    const drop = readAztecDrop(state, this.line);
    return { drop, wheel: drop.freeSpin === null ? null : wheelSpinOf(drop.freeSpin) };
  }

  /** The boundary for the host's raw JSON: a broken payload becomes the error the scene shows. */
  private read<T>(read: () => T): T | null {
    try {
      const value = read();
      this.error = null;
      return value;
    } catch (error) {
      if (!(error instanceof PlinkoPayloadError)) throw error;
      BridgeLogger.error(`[demo-games] plinko-aztec: ${error.message}`);
      this.error = error.message;
      return null;
    }
  }
}
