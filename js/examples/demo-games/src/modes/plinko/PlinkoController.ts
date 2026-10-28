/**
 * Plinko on the bridge: the host sends a finished drop (`ApplyDropResult`), the scene drops the ball into
 * its slot, and only once the ball has landed does the host hear `DropFinished` — that unlocks the bet bar.
 * Drops play one after another; the multiplier is shown after the landing, never before.
 */
import { BridgeLogger, type PlinkoBridge } from '@omega/webbridge-js';
import { MoveQueue } from '../../kit/MoveQueue';
import { PlinkoPayloadError } from './payload';
import type { PlinkoPhase } from './plinkoReadout';
import { outcomeOf, PlinkoRound, type PlinkoDrop, type PlinkoOutcome } from './plinkoRound';

export interface PlinkoMotions {
  /** Drops a ball into each slot of the list; resolves once every ball has landed. */
  drop(slots: readonly number[]): Promise<boolean>;
  /** The ball has landed: the slot pops, a win celebrates. */
  land(slot: number, outcome: PlinkoOutcome): void;
}

export class PlinkoController {
  public readonly round = new PlinkoRound();
  public phase: PlinkoPhase = 'idle';
  public lastDrop: PlinkoDrop | null = null;
  public error: string | null = null;
  private readonly queue = new MoveQueue();
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: PlinkoBridge,
    private readonly motions: PlinkoMotions,
  ) {
    this.unsubscribers = [
      bridge.gameConfigReceived.add((config) => this.readPayload(() => this.round.setConfig(config))),
      bridge.dropResultReceived.add((result) => this.queue.enqueue(() => this.playDrop(result))),
    ];
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private async playDrop(result: unknown): Promise<boolean> {
    const drop = this.readPayload(() => this.round.readDrop(result));
    if (drop === null) return true;
    this.phase = 'dropping';
    if (!(await this.motions.drop([drop.slot]))) return false;
    this.phase = 'idle';
    this.lastDrop = drop;
    this.motions.land(drop.slot, outcomeOf(drop.coefficient));
    this.bridge.notifyDropFinished();
    return true;
  }

  /**
   * The boundary for the host's raw JSON: a broken payload becomes the error the scene shows, and no ball
   * drops for it. The bar stays locked then — there is no landing to report.
   */
  private readPayload<T>(read: () => T): T | null {
    try {
      const value = read();
      this.error = null;
      return value;
    } catch (error) {
      if (!(error instanceof PlinkoPayloadError)) throw error;
      BridgeLogger.error(`[demo-games] plinko: ${error.message}`);
      this.error = error.message;
      return null;
    }
  }
}
