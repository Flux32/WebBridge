/**
 * Twist on the bridge. A spin is reported (`SpinReady`) once the totems landed and the board shows the new
 * progress. A part cash out is a bare `ApplyGameState`: the board shrinks, nothing is reported. A full cash
 * out and the end of a bought series come back as `RestartRound`: clear the board, then `SpinReady`. Free
 * spins of a series are never reported one by one: `BonusProgressSave` per spin, then the mandatory
 * `BonusEnded`.
 */
import { BridgeLogger, type RestartRequest, type TwistBonusSeries, type TwistBridge } from '@omega/webbridge-js';
import { MoveQueue } from '../../kit/MoveQueue';
import { IntroLatch } from './IntroLatch';
import { playFreeSpins, type SeriesCount } from './twistSeries';
import {
  boardAfter,
  readSeriesTotal,
  readTwistBonusRound,
  readTwistSpin,
  readTwistState,
  totemsOf,
  TwistStateError,
  type TotemTriple,
  type TwistSpin,
} from './twistSpin';
import { EMPTY_PROGRESS, TWIST_SECTORS, type TwistProgress } from './twistTable';

export interface TwistMotions {
  spin(totems: TotemTriple): Promise<boolean>;
  /** Moves the board to `progress`, growing or shrinking its sectors. */
  fill(progress: TwistProgress): Promise<boolean>;
  /** Death: every cell breaks off, with a shake. */
  wipe(): Promise<boolean>;
  /** The breath between two free spins. */
  pause(): Promise<boolean>;
  celebrate(): void;
}

export type TwistPhase = 'idle' | 'playing' | 'spinning' | 'lost' | 'bonus' | 'bonusEnded' | 'broken';

const RESTART_LABELS: Readonly<Record<string, string>> = { cashout: 'Cashed out', bonus: 'Free spins paid' };

/** `RestartRound 'cashout|$3.90'` → `Cashed out $3.90`; an empty amount is a restart without a result. */
const resultOf = ({ reason, amount }: RestartRequest): string =>
  amount === '' ? '' : `${RESTART_LABELS[reason] ?? reason} ${amount}`.trim();

const isEmpty = (progress: TwistProgress): boolean => TWIST_SECTORS.every((sector) => progress[sector] === 0);

export class TwistController {
  public phase: TwistPhase = 'idle';
  public progress: TwistProgress = EMPTY_PROGRESS;
  public lastResult = '';
  public series: SeriesCount | null = null;
  private readonly queue = new MoveQueue();
  private readonly intro = new IntroLatch();
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: TwistBridge,
    private readonly motions: TwistMotions,
  ) {
    this.unsubscribers = [
      bridge.gameStateReceived.add((state) => this.queue.enqueue(() => this.syncState(state))),
      bridge.spinResultReceived.add((spin) => this.queue.enqueue(() => this.playSpin(spin))),
      bridge.restartRequested.add((request) => this.queue.enqueue(() => this.restart(request))),
      bridge.bonusStartRequested.add((series) => this.queue.enqueue(() => this.playSeries(series))),
      bridge.freeGamesIntroFinished.add(() => this.intro.open()),
    ];
  }

  public destroy(): void {
    this.queue.close();
    this.intro.close();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private async syncState(raw: unknown): Promise<boolean> {
    const progress = this.read('ApplyGameState', () => readTwistState(raw));
    if (progress === null) return true;
    if (this.phase !== 'bonusEnded') this.phase = isEmpty(progress) ? 'idle' : 'playing';
    return this.show(progress);
  }

  private async playSpin(raw: unknown): Promise<boolean> {
    const spin = this.read('ApplySpinResult', () => readTwistSpin(raw));
    if (spin === null) return true;
    this.phase = 'spinning';
    if (!(await this.motions.spin(totemsOf(spin.outcome)))) return false;
    if (!(await this.land(spin))) return false;
    this.bridge.notifySpinReady();
    return true;
  }

  private async land(spin: TwistSpin): Promise<boolean> {
    if (spin.outcome === 'death') {
      this.phase = 'lost';
      this.progress = EMPTY_PROGRESS;
      const isPlayed = await this.motions.wipe();
      this.lastResult = 'Death took the board';
      this.phase = 'idle';
      return isPlayed;
    }
    const board = boardAfter(spin);
    this.phase = isEmpty(board) ? 'idle' : 'playing';
    if (spin.hasBonus) this.motions.celebrate();
    return this.show(board);
  }

  private async restart(request: RestartRequest): Promise<boolean> {
    this.lastResult = resultOf(request);
    if (this.series !== null) this.motions.celebrate();
    this.series = null;
    if (!(await this.show(EMPTY_PROGRESS))) return false;
    this.phase = 'idle';
    this.bridge.notifySpinReady();
    return true;
  }

  private async playSeries(series: TwistBonusSeries): Promise<boolean> {
    const rounds = this.read('StartBonus', () => series.spins.map(readTwistBonusRound));
    const total = this.read('StartBonus', () => readSeriesTotal(series.totalRounds, series.spins.length));
    if (rounds === null || total === null) return true;
    this.phase = 'bonus';
    this.series = { completed: 0, total };
    const isPlayed = await playFreeSpins(rounds, this.series, {
      bridge: this.bridge,
      intro: this.intro,
      spin: (round) => this.motions.spin(totemsOf(round.outcome)),
      show: (progress) => this.show(progress),
      pause: () => this.motions.pause(),
    });
    if (isPlayed) this.phase = 'bonusEnded';
    return isPlayed;
  }

  private show(progress: TwistProgress): Promise<boolean> {
    this.progress = progress;
    return this.motions.fill(progress);
  }

  /** The boundary of a command: a payload the scene cannot show truthfully becomes a visible broken state. */
  private read<T>(command: string, parse: () => T): T | null {
    try {
      return parse();
    } catch (error) {
      if (!(error instanceof TwistStateError)) throw error;
      BridgeLogger.error(`[demo twist] ${command} rejected: ${error.message}`);
      this.phase = 'broken';
      this.lastResult = error.message;
      return null;
    }
  }
}
