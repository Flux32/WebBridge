/**
 * Stand-in for the shell and the dev backend of a jumper game. It answers the
 * game's requests, plays a jump per Play (the first one opens the round), keeps
 * the bar locked until the engine reports `SpinReady`, cashes out and sells the
 * bonus. `JumperMockRound` and `settleJumperBonus` build the server's replies.
 *
 * The game runs on its REAL path — the same `__WEB_GAME_BOOT__`, bridge and
 * commands — only its counterpart is swapped, so the mock tests the integration
 * instead of bypassing it.
 */
import type {
  EngineCommand,
  EngineEvent,
  JumperDifficulty,
  JumperGameConfigPayload,
  JumperLadder,
  JumperMove,
  JumperRoundState,
  WebGameBridge,
  WebHostBridge,
} from '@omega/webbridge-protocol';
import { settleJumperBonus } from './jumperMockBonus';
import { DEFAULT_JUMPER_MOCK_OPTIONS, type JumperMockHostOptions } from './jumperMockOptions';
import { drawCount, drawSlotLayout } from './jumperMockRandom';
import { idleJumperState, JumperMockRound } from './JumperMockRound';

export type { JumperMockHostOptions, JumperMockRange, JumperSlotContent } from './jumperMockOptions';

export class JumperMockHost implements WebHostBridge {
  private readonly options: JumperMockHostOptions;
  private game: WebGameBridge | null = null;
  private currentDifficulty: JumperDifficulty;
  private round: JumperMockRound | null = null;
  /** A jump is in flight until the engine reports `SpinReady` — the shell's bar holds Play as long. */
  private isJumpInFlight = false;
  /** The restart a closing jump owes the engine once it has played the jump out. */
  private pendingRestart: string | null = null;
  private isBonusRunning = false;

  public constructor(options: Partial<JumperMockHostOptions> = {}) {
    this.options = { ...DEFAULT_JUMPER_MOCK_OPTIONS, ...options };
    this.currentDifficulty = this.options.difficulty;
    // Fail fast: a difficulty without a ladder would only break on the first Play.
    this.ladderOf(this.currentDifficulty);
  }

  public get difficulty(): JumperDifficulty {
    return this.currentDifficulty;
  }

  public get isBonusActive(): boolean {
    return this.isBonusRunning;
  }

  public attach(game: WebGameBridge): void {
    this.game = game;
  }

  public emit(event: EngineEvent): void {
    switch (event.type) {
      case 'RequestGameConfig':
        this.sendGameConfig();
        return;
      case 'RequestGameState':
        this.sendGameState();
        return;
      case 'RequestWhiteLabel':
        this.send({ type: 'ApplyWhiteLabel', payload: false });
        return;
      case 'RequestFastGame':
        this.send({ type: 'SetFastGame', payload: false });
        return;
      case 'RequestPlay':
        this.play();
        return;
      case 'SpinReady':
        this.finishJump();
        return;
      case 'BonusEnded':
        this.isBonusRunning = false;
        return;
      default:
        return;
    }
  }

  /** As the shell once the engine has loaded: difficulty first, then the ladders and the session. */
  public ready(): void {
    this.send({ type: 'SetJumperDifficulty', payload: this.currentDifficulty });
    this.sendGameConfig();
    this.sendGameState();
  }

  public setProgress(): void {}

  /**
   * Play: the first one opens the round (`play`) and jumps to step 0, later ones
   * jump to `landingStep + 1`. While the bar is locked the shell answers
   * `DisabledPlayPressed` instead.
   */
  public play(): void {
    if (this.isBarLocked()) {
      this.send({ type: 'DisabledPlayPressed' });
      return;
    }

    const round = this.round ?? this.openRound();
    const state = round.jump(this.options.random() < this.options.loseChance);
    this.isJumpInFlight = true;
    this.sendMove('step', state);
    if (state.status === 'in-game') return;

    this.round = null;
    this.pendingRestart = state.status === 'lose' ? 'lose|' : `win|${this.displayAmount(state)}`;
  }

  /** Cash out as the shell does: `CashoutPressed` on the press, then the `payout` reply and the restart. */
  public cashout(): void {
    const round = this.round;
    if (round === null || !round.hasJumped || this.isJumpInFlight) return;

    this.send({ type: 'CashoutPressed' });
    const state = round.payout();
    this.round = null;
    this.sendMove('payout', state);
    this.send({ type: 'RestartRound', payload: `cashout|${this.displayAmount(state)}` });
  }

  /** Buy the bonus between rounds: the server settles the series and the engine plays it out. */
  public buyBonus(): void {
    if (this.isBarLocked() || this.round !== null) return;

    this.isBonusRunning = true;
    this.send({ type: 'StartBonus', payload: settleJumperBonus(this.ladderOf(this.currentDifficulty), this.options) });
  }

  /** The bar's difficulty switch: only between rounds, as on the backend. */
  public setDifficulty(difficulty: JumperDifficulty): void {
    if (this.isBarLocked() || this.round !== null || difficulty === this.currentDifficulty) return;

    this.ladderOf(difficulty); // throws for a difficulty without a ladder
    this.currentDifficulty = difficulty;
    this.send({ type: 'SetJumperDifficulty', payload: difficulty });
  }

  /** Space — play, C — cash out, B — buy the bonus, D — next difficulty. */
  public bindKeys(target: EventTarget = window): () => void {
    const actions: Record<string, () => void> = {
      Space: () => this.play(),
      KeyC: () => this.cashout(),
      KeyB: () => this.buyBonus(),
      KeyD: () => this.setDifficulty(this.nextDifficulty()),
    };
    const onKeyDown = (event: Event): void => {
      const action = actions[(event as KeyboardEvent).code];
      if (action === undefined) return;

      action();
      event.preventDefault();
    };

    target.addEventListener('keydown', onKeyDown);
    return () => target.removeEventListener('keydown', onKeyDown);
  }

  private isBarLocked(): boolean {
    return this.isJumpInFlight || this.isBonusRunning;
  }

  private openRound(): JumperMockRound {
    const { slotCount, slotWeights, random, betAmount, decimalPlaces } = this.options;
    const ladder = this.ladderOf(this.currentDifficulty);
    const layout = drawSlotLayout(ladder, drawCount(slotCount, random), slotWeights, random);
    this.round = new JumperMockRound(ladder, { amount: betAmount, decimalPlaces }, layout);
    this.sendMove('play', this.round.state);
    return this.round;
  }

  /** The engine has played the jump out; a closing one now gets its restart. */
  private finishJump(): void {
    this.isJumpInFlight = false;
    const restart = this.pendingRestart;
    if (restart === null) return;

    this.pendingRestart = null;
    this.send({ type: 'RestartRound', payload: restart });
  }

  private ladderOf(difficulty: JumperDifficulty): JumperLadder {
    const ladder = this.options.ladders.find((entry) => entry.difficulty === difficulty);
    if (ladder === undefined) throw new RangeError(`JumperMockHost: no ladder for ${difficulty}`);
    return ladder;
  }

  /** The next difficulty among the served ladders, in their order. */
  private nextDifficulty(): JumperDifficulty {
    const { ladders } = this.options;
    const index = ladders.findIndex((ladder) => ladder.difficulty === this.currentDifficulty);
    return ladders[(index + 1) % ladders.length]!.difficulty;
  }

  private displayAmount(state: JumperRoundState): string {
    return `${state.winAmount} ${this.options.currency}`;
  }

  private sendMove(move: JumperMove, state: JumperRoundState): void {
    this.send({ type: 'ApplyJumperMove', payload: { ...state, move } });
  }

  private sendGameConfig(): void {
    const config: JumperGameConfigPayload = { ladders: [...this.options.ladders] };
    this.send({ type: 'ApplyGameConfig', payload: JSON.stringify(config) });
  }

  private sendGameState(): void {
    const state = this.round?.state ?? idleJumperState(this.ladderOf(this.currentDifficulty));
    this.send({ type: 'ApplyGameState', payload: JSON.stringify(state) });
  }

  private send(command: EngineCommand): void {
    this.game?.receive(command);
  }
}
