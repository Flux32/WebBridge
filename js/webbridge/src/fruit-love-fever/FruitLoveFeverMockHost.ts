/**
 * Mock host of Fruit Love Fever: stands in for the shell and answers the game with replies in the dev
 * backend's shape (`FruitLoveFeverMockRound`). A play comes back as `ApplySpinResult`; a bonus — three
 * scatters or a bought x75 / x200 — then answers every `RequestStep` with the next free spin as
 * `ApplyBonusStepResult`. `RequestGameState` answers the last reply of an unfinished round, as
 * `get-game-state` does, so a reload resumes the bonus. The round stays busy until the game sends
 * `SpinReady`, as the shell's bet bar does.
 */
import type {
  EngineCommand,
  EngineEvent,
  FruitLoveFeverBonusBuy,
  FruitLoveFeverGameState,
  WebGameBridge,
  WebHostBridge,
} from '@omega/webbridge-protocol';
import { BridgeLogger } from '../core/BridgeLogger';
import { FruitLoveFeverMockRound } from './fruitLoveFeverMockRound';

/** Prices in bets of the buys; a local copy, as the round keeps it (see `fruitLoveFeverMockRound`). */
const BONUS_PRICES: Readonly<Record<FruitLoveFeverBonusBuy, number>> = { x75: 75, x200: 200 };

export interface FruitLoveFeverMockHostOptions {
  currency: string;
  betAmount: number;
  random: () => number;
}

const DEFAULTS: FruitLoveFeverMockHostOptions = { currency: 'USD', betAmount: 1, random: Math.random };

export class FruitLoveFeverMockHost implements WebHostBridge {
  private readonly options: FruitLoveFeverMockHostOptions;
  private game: WebGameBridge | null = null;
  private round: FruitLoveFeverMockRound | null = null;
  /** Busy from the play until the game's `SpinReady`, free spins included. */
  private isBusy = false;

  public constructor(options: Partial<FruitLoveFeverMockHostOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** A bonus game has free spins left to play. */
  public get isBonusActive(): boolean {
    return this.round !== null && !this.round.isFinished;
  }

  public attach(game: WebGameBridge): void {
    this.game = game;
  }

  public emit(event: EngineEvent): void {
    switch (event.type) {
      case 'RequestGameConfig':
        this.send({ type: 'ApplyGameConfig', payload: JSON.stringify(this.gameConfig()) });
        return;
      case 'RequestGameState':
        this.resync();
        return;
      case 'RequestStep':
        this.step();
        return;
      case 'SpinReady':
        this.finishRound();
        return;
      case 'RequestPlay':
        if (this.isBusy) this.send({ type: 'DisabledPlayPressed' });
        else this.spin();
        return;
      default:
        return;
    }
  }

  public ready(): void {}

  public setProgress(): void {}

  /** A plain spin at the bet; three scatters turn it into a bonus game. */
  public spin(): void {
    this.play();
  }

  /** A bought bonus game: the play's amount is the full price, `betAmount × price`. */
  public buyBonus(bonusBuy: FruitLoveFeverBonusBuy): void {
    this.play(bonusBuy);
  }

  /** `ApplyGameState` with the session as `get-game-state` reports it — what a reload or a reconnect gets. */
  public resync(): void {
    this.send({ type: 'ApplyGameState', payload: JSON.stringify(this.gameState()) });
  }

  /** Space — spin, B — buy x75, H — buy x200, G — re-send the game state (a reconnect). */
  public bindKeys(target: EventTarget = window): () => void {
    const actions: Record<string, () => void> = {
      Space: () => this.emit({ type: 'RequestPlay' }),
      KeyB: () => this.buyBonus('x75'),
      KeyH: () => this.buyBonus('x200'),
      KeyG: () => this.resync(),
    };
    const onKey = (event: Event): void => actions[(event as KeyboardEvent).code]?.();
    target.addEventListener('keydown', onKey);
    return () => target.removeEventListener('keydown', onKey);
  }

  private play(bonusBuy?: FruitLoveFeverBonusBuy): void {
    if (this.isBusy) return;
    const { betAmount, currency, random } = this.options;
    const amount = bonusBuy === undefined ? betAmount : betAmount * BONUS_PRICES[bonusBuy];
    this.round = new FruitLoveFeverMockRound({ amount, currency, random, ...(bonusBuy === undefined ? {} : { bonusBuy }) });
    this.isBusy = true;
    this.send({ type: 'ApplySpinResult', payload: JSON.stringify(this.round.lastReply) });
  }

  /** The next free spin; without a bonus in play the server refuses ("Active round not found"). */
  private step(): void {
    if (this.round === null || this.round.isFinished) {
      BridgeLogger.warn('[FruitLoveFeverMockHost] RequestStep without a bonus in play: Active round not found');
      return;
    }
    this.send({ type: 'ApplyBonusStepResult', payload: JSON.stringify(this.round.nextStep()) });
  }

  private finishRound(): void {
    if (this.isBonusActive) BridgeLogger.warn('[FruitLoveFeverMockHost] SpinReady while the bonus has free spins left');
    this.isBusy = false;
  }

  private gameState(): FruitLoveFeverGameState {
    return this.round !== null && !this.round.isFinished ? this.round.lastReply : { status: 'none' };
  }

  /** As the dev backend's `get-game-config`: limits and currency, no bonus prices. */
  private gameConfig(): unknown {
    const { currency } = this.options;
    return {
      betConfig: { minBetAmount: '0.12', maxBetAmount: '10000.00', maxWinAmount: '100000.00', defaultBetAmount: '1.00', betPresets: [], currency },
      currency: { code: currency, type: 'FIAT', displayName: '$', decimalPlaces: 2 },
    };
  }

  private send(command: EngineCommand): void {
    this.game?.receive(command);
  }
}
