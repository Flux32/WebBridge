/**
 * The wheel on the bridge. Rounds are the server's: the host forwards each change as `ApplyRound`, and
 * the wheel spins on `IN_GAME`, then — once it has landed AND `FINISH_GAME` has arrived — plays the reveal
 * and reports `RoundShown`, exactly once per round. The host opens the result window on it, so it must not
 * come before the wheel has stopped. The wheel's bar ignores `SpinReady`; the wheel never sends it.
 */
import { BridgeLogger, type WheelBridge } from '@omega/webbridge-js';
import type { WheelBetBarMetricsPayload } from '@omega/webbridge-protocol';
import { MoveQueue } from '../../kit/MoveQueue';
import { CENTER_OFFSET, WHEEL_CELLS, type WheelColor } from './wheelCells';
import { applyWheelSnapshot, readWheelSnapshot, targetCellOf, WheelSnapshotError, type WheelRoundState } from './wheelRound';

export interface WheelSpinPlan {
  readonly cellIndex: number;
  readonly inCellOffset: number;
  readonly durationMs: number;
  /** Full turns before the stop; 0 — a snap to a result the page opened on. */
  readonly turns: number;
}

export interface WheelMotions {
  spin(plan: WheelSpinPlan): Promise<boolean>;
  reveal(color: WheelColor): Promise<boolean>;
}

export type WheelPhase = 'waiting' | 'betting' | 'spinning' | 'landed' | 'result' | 'stopped';

/** The spin when the host names no time left; also the floor for a page opened late in the spin. */
const DEFAULT_SPIN_MS = 4000;
const MIN_SPIN_MS = 600;
const SNAP_MS = 700;
const MS_PER_TURN = 900;
const MAX_TURNS = 6;

const spinDuration = (round: WheelRoundState, now: number): number =>
  round.deadlineAt === null ? DEFAULT_SPIN_MS : Math.max(MIN_SPIN_MS, round.deadlineAt - now);

const spinPlanOf = (round: WheelRoundState, cellIndex: number, now: number): WheelSpinPlan => {
  const inCellOffset = round.inCellOffset ?? CENTER_OFFSET;
  if (round.status !== 'IN_GAME') return { cellIndex, inCellOffset, durationMs: SNAP_MS, turns: 0 };
  const durationMs = spinDuration(round, now);
  return { cellIndex, inCellOffset, durationMs, turns: Math.min(MAX_TURNS, Math.max(1, Math.floor(durationMs / MS_PER_TURN))) };
};

export class WheelController {
  public round: WheelRoundState | null = null;
  /** Where the bar's top edge is, as a share of the canvas from its bottom; null until the host says. */
  public barTopShare: number | null = null;
  private spunSerial = 0;
  private landedSerial = 0;
  private finishedSerial = 0;
  private shownSerial = 0;
  private readonly queue = new MoveQueue();
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: WheelBridge,
    private readonly motions: WheelMotions,
    private readonly clock: () => number = () => performance.now(),
  ) {
    this.unsubscribers = [
      bridge.roundReceived.add((raw) => this.applyRound(raw)),
      bridge.betBarMetricsReceived.add((metrics) => this.applyBarMetrics(metrics)),
    ];
  }

  public get phase(): WheelPhase {
    const round = this.round;
    if (round === null) return 'waiting';
    if (round.status === 'STOPPED') return 'stopped';
    if (round.status === 'WAIT_GAME') return 'betting';
    if (this.shownSerial === round.serial) return 'result';
    return this.landedSerial === round.serial ? 'landed' : 'spinning';
  }

  /** The winning colour, once the reveal has started: never before the wheel has stopped. */
  public get winner(): WheelColor | null {
    const round = this.round;
    if (round === null || this.shownSerial !== round.serial) return null;
    return round.winnerColor ?? WHEEL_CELLS[targetCellOf(round) ?? -1] ?? null;
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private applyRound(raw: unknown): void {
    try {
      this.round = applyWheelSnapshot(this.round, readWheelSnapshot(raw), this.clock());
    } catch (error) {
      if (!(error instanceof WheelSnapshotError)) throw error;
      BridgeLogger.error(error.message);
      return;
    }
    this.scheduleSpin(this.round);
    this.scheduleReveal(this.round);
  }

  private applyBarMetrics(metrics: WheelBetBarMetricsPayload): void {
    const raw: unknown = metrics.betBarTopViewport;
    const share = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof share !== 'number' || !Number.isFinite(share)) {
      BridgeLogger.error(`[demo wheel] SetWheelBetBarMetrics has an invalid betBarTopViewport: ${String(raw)}`);
      return;
    }
    this.barTopShare = Math.min(1, Math.max(0, share));
  }

  private scheduleSpin(round: WheelRoundState): void {
    if (round.status !== 'IN_GAME' && round.status !== 'FINISH_GAME') return;
    if (this.spunSerial === round.serial) return;
    const cellIndex = targetCellOf(round);
    if (cellIndex === null) return;
    this.spunSerial = round.serial;
    const plan = spinPlanOf(round, cellIndex, this.clock());
    this.queue.enqueue(() => this.spin(round.serial, plan));
  }

  private async spin(serial: number, plan: WheelSpinPlan): Promise<boolean> {
    if (!(await this.motions.spin(plan))) return false;
    this.landedSerial = serial;
    return true;
  }

  private scheduleReveal(round: WheelRoundState): void {
    if (round.status !== 'FINISH_GAME' || this.finishedSerial === round.serial) return;
    this.finishedSerial = round.serial;
    this.queue.enqueue(() => this.reveal(round.serial));
  }

  private async reveal(serial: number): Promise<boolean> {
    if (this.round?.serial !== serial) return true;
    if (this.landedSerial !== serial) {
      BridgeLogger.error('[demo wheel] FINISH_GAME names neither the cell nor the colour: nothing to show');
      return true;
    }
    this.shownSerial = serial;
    const winner = this.winner;
    if (winner !== null && !(await this.motions.reveal(winner))) return false;
    this.bridge.notifyRoundShown();
    return true;
  }
}
