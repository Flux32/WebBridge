/**
 * Dev-only stand-in for the shell and the wheel's round scheduler: WAIT_GAME 5 s → IN_GAME 4 s →
 * FINISH_GAME 3 s on a random cell, as the shell forwards them — every phase sent twice, the result
 * without its cell, as the real host's later snapshots do. The bridge package has no wheel mock.
 */
import type { EngineCommand, EngineEvent, WebGameBridge, WebHostBridge } from '@omega/webbridge-protocol';
import { CELL_COUNT, WHEEL_CELLS } from './wheelCells';
import type { WheelStatus } from './wheelRound';

const PHASE_MS: Readonly<Record<Exclude<WheelStatus, 'STOPPED'>, number>> = {
  WAIT_GAME: 5000,
  IN_GAME: 4000,
  FINISH_GAME: 3000,
};
const NEXT_PHASE = { WAIT_GAME: 'IN_GAME', IN_GAME: 'FINISH_GAME', FINISH_GAME: 'WAIT_GAME' } as const;
/** A duplicate snapshot mid-phase: the shell resends the round on every change of its own state. */
const DUPLICATE_AFTER_MS = 700;
/** Where the shell's mobile wheel bar ends, as a share of the canvas from the bottom. */
const BAR_TOP_SHARE = 0.36;

type ScheduledStatus = keyof typeof PHASE_MS;

export class WheelMockHost implements WebHostBridge {
  private game: WebGameBridge | null = null;
  private roundNumber = 0;
  private cellIndex = 0;
  private inCellOffset = 0.5;
  private status: ScheduledStatus = 'WAIT_GAME';
  private phaseEndsAt = 0;
  private isStopped = false;
  private readonly timerIds = new Set<number>();

  public attach(game: WebGameBridge): void {
    this.game = game;
  }

  public ready(): void {
    this.sendBarMetrics();
    this.enter('WAIT_GAME');
  }

  public setProgress(): void {}

  public emit(event: EngineEvent): void {
    if (event.type === 'RequestBetBarViewportMetrics') this.sendBarMetrics();
    if (event.type === 'RequestPlay' && this.status !== 'WAIT_GAME') this.send({ type: 'DisabledPlayPressed' });
  }

  /** S — stop or resume the rounds (`STOPPED`). */
  public bindKeys(target: EventTarget = window): () => void {
    const onKeyDown = (event: Event): void => {
      if ((event as KeyboardEvent).code !== 'KeyS') return;
      this.toggleStopped();
      event.preventDefault();
    };
    target.addEventListener('keydown', onKeyDown);
    return () => target.removeEventListener('keydown', onKeyDown);
  }

  private toggleStopped(): void {
    this.isStopped = !this.isStopped;
    this.clearTimers();
    if (this.isStopped) this.sendRound('STOPPED');
    else this.enter('WAIT_GAME');
  }

  private enter(status: ScheduledStatus): void {
    if (status === 'WAIT_GAME') this.drawRound();
    this.status = status;
    this.phaseEndsAt = Date.now() + PHASE_MS[status];
    this.sendRound(status);
    this.later(DUPLICATE_AFTER_MS, () => this.sendRound(status));
    this.later(PHASE_MS[status], () => this.enter(NEXT_PHASE[status]));
  }

  private drawRound(): void {
    this.roundNumber += 1;
    this.cellIndex = Math.floor(Math.random() * CELL_COUNT);
    this.inCellOffset = Math.round((0.1 + Math.random() * 0.8) * 100) / 100;
  }

  private sendRound(status: WheelStatus): void {
    const isSpun = status === 'IN_GAME' || status === 'FINISH_GAME';
    const message = {
      status,
      roundId: String(this.roundNumber),
      msToNextPhase: status === 'STOPPED' ? null : Math.max(0, this.phaseEndsAt - Date.now()),
      winnerColor: status === 'FINISH_GAME' ? (WHEEL_CELLS[this.cellIndex] ?? null) : null,
      cellIndex: status === 'IN_GAME' ? this.cellIndex : null,
      inCellOffset: isSpun ? this.inCellOffset : null,
    };
    this.send({ type: 'ApplyRound', payload: JSON.stringify(message) });
  }

  private sendBarMetrics(): void {
    const metrics = { widthViewport: 1, betBarTopViewport: BAR_TOP_SHARE, historyTopViewport: 0.3, betBarScale: 0.5 };
    this.send({ type: 'SetWheelBetBarMetrics', payload: JSON.stringify(metrics) });
  }

  private later(delayMs: number, action: () => void): void {
    const timerId = window.setTimeout(() => {
      this.timerIds.delete(timerId);
      action();
    }, delayMs);
    this.timerIds.add(timerId);
  }

  private clearTimers(): void {
    this.timerIds.forEach((timerId) => window.clearTimeout(timerId));
    this.timerIds.clear();
  }

  private send(command: EngineCommand): void {
    this.game?.receive(command);
  }
}
