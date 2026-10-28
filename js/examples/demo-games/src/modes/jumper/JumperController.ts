/**
 * Jumper on the bridge (RoadFrontent ADR-0008). `play` opens the round and gets no `SpinReady`; a `step` is
 * a jump — accelerator chain and fall included — reported with `SpinReady` once it has played out; `payout`
 * closes the round and waits for `RestartRound`, which the scene answers with a reset and `SpinReady`, as
 * every closed round does. A bought bonus plays its free games itself (`playJumperBonus`).
 */
import { BridgeLogger, type JumperBridge, type RestartRequest } from '@omega/webbridge-js';
import type { JumperMove } from '@omega/webbridge-protocol';
import { MoveQueue } from '../../kit/MoveQueue';
import type { JumperBonus, JumperRound } from './jumperModel';
import { JumperReadError, readDifficulty, readJumperBonus, readJumperLadders, readJumperMove, readJumperRound } from './jumperRead';
import { jumpWaypoints, START_STEP } from './jumperRoute';
import { JumperScene, type JumperPhase } from './jumperScene';
import { playJumperBonus, type JumperMotions } from './playJumperBonus';

export type { JumperMotions } from './playJumperBonus';

const IDLE_NOTE = '';

const RESTORED_PHASES: Readonly<Record<JumperRound['status'], JumperPhase>> = {
  none: 'idle',
  'in-game': 'playing',
  win: 'cashed',
  lose: 'fell',
};

export class JumperController {
  public readonly scene = new JumperScene();
  private readonly queue = new MoveQueue();
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: JumperBridge,
    private readonly motions: JumperMotions,
  ) {
    this.unsubscribers = [
      bridge.gameConfigReceived.add((config) => this.read(() => (this.scene.ladders = readJumperLadders(config)))),
      bridge.difficultyChanged.add((difficulty) => this.read(() => (this.scene.difficulty = readDifficulty(difficulty)))),
      bridge.gameStateReceived.add((state) => this.enqueue(() => readJumperRound(state), (round) => this.restore(round))),
      bridge.moveReceived.add((move) => this.enqueue(() => readJumperMove(move), (read) => this.playMove(read))),
      bridge.restartRequested.add((request) => this.queue.enqueue(() => this.restart(request))),
      bridge.bonusStartRequested.add((bonus) => this.enqueue(() => readJumperBonus(bonus), (read) => this.playBonus(read))),
    ];
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  /** Reads a host payload at the edge: one that cannot be read is logged and shown, never half-played. */
  private read<T>(reader: () => T): T | null {
    try {
      return reader();
    } catch (error) {
      if (!(error instanceof JumperReadError)) throw error;
      BridgeLogger.error(error.message);
      this.scene.note = 'The host sent a move the game cannot read';
      return null;
    }
  }

  private enqueue<T>(reader: () => T, play: (value: T) => Promise<boolean> | boolean): void {
    const value = this.read(reader);
    if (value === null) return;
    this.queue.enqueue(async () => play(value));
  }

  private restore(round: JumperRound): boolean {
    this.scene.difficulty = round.difficulty;
    if (round.status === 'none') {
      this.scene.reset(IDLE_NOTE);
      this.motions.place(START_STEP);
      return true;
    }
    this.scene.showRound(round);
    this.scene.phase = RESTORED_PHASES[round.status];
    this.motions.place(round.status === 'lose' ? (round.collisionStep ?? round.landingStep) : round.landingStep);
    return true;
  }

  private playMove({ move, round }: { move: JumperMove; round: JumperRound }): Promise<boolean> | boolean {
    if (move === 'step') return this.playJump(round);
    this.scene.showRound(round);
    if (move === 'payout') {
      this.scene.phase = 'cashed';
      this.motions.celebrate();
      return true;
    }
    this.scene.phase = 'open';
    this.scene.note = IDLE_NOTE;
    this.motions.place(START_STEP);
    return true;
  }

  private async playJump(round: JumperRound): Promise<boolean> {
    this.scene.slots = round.slots;
    this.scene.phase = 'playing';
    if (!(await this.motions.jump(jumpWaypoints(round), 'round'))) return false;
    if (round.status === 'lose') {
      this.scene.collisionStep = round.collisionStep;
      this.scene.phase = 'fell';
      if (!(await this.motions.fall())) return false;
    } else {
      this.scene.showRound(round);
      if (round.status === 'win') this.wonTop();
    }
    this.bridge.notifySpinReady();
    return true;
  }

  private wonTop(): void {
    this.scene.phase = 'won';
    this.motions.celebrate();
  }

  private async restart(request: RestartRequest): Promise<boolean> {
    const isPlayed = await this.motions.rewind();
    if (!isPlayed) return false;
    this.scene.reset([request.reason, request.amount].filter((part) => part !== '').join(' '));
    this.bridge.notifySpinReady();
    return true;
  }

  private playBonus(bonus: JumperBonus): Promise<boolean> {
    return playJumperBonus({ bridge: this.bridge, motions: this.motions, scene: this.scene }, bonus);
  }
}
