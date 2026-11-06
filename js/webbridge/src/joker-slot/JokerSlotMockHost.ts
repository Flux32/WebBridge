/**
 * Mock host of Joker Slot: stands in for the shell and answers the game with replies in the stage backend's
 * shape (`dealJokerSlotRound`). Every play — a spin or an x75 / x200 buy, charged at its full price — comes
 * back whole as one `ApplySpinResult`; `RequestGameState` answers `{ status: 'none' }`, as `get-game-state`
 * does. A rare feature can be forced for the next spin instead of waited for. The round stays busy until the
 * game sends `SpinReady`, as the shell's bet bar does.
 */
import type { EngineCommand, EngineEvent, JokerSlotBonusBuy, WebGameBridge, WebHostBridge } from '@omega/webbridge-protocol';
import { BridgeLogger } from '../core/BridgeLogger';
import { dealJokerSlotRound, type JokerSlotMockOutcome } from './jokerSlotMockRound';

export interface JokerSlotMockHostOptions {
  currency: string;
  /** The bet, in currency units. */
  bet: number;
  random: () => number;
}

const DEFAULTS: JokerSlotMockHostOptions = { currency: 'USD', bet: 1, random: Math.random };

export class JokerSlotMockHost implements WebHostBridge {
  private readonly options: JokerSlotMockHostOptions;
  private game: WebGameBridge | null = null;
  /** Busy from the play until the game's `SpinReady`. */
  private isBusy = false;
  private isFastGame = false;

  public constructor(options: Partial<JokerSlotMockHostOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
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
      case 'RequestFastGame':
        this.send({ type: 'SetFastGame', payload: this.isFastGame });
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

  /** A spin at the bet; `outcome` forces a base-game feature (a dev key), else the draw decides. */
  public spin(outcome?: JokerSlotMockOutcome): void {
    this.play(outcome === undefined ? {} : { outcome });
  }

  /** A bought bonus: the play's amount is the full price, `bet × 75` or `bet × 200`. */
  public buyBonus(bonusBuy: JokerSlotBonusBuy): void {
    this.play({ bonusBuy });
  }

  /** `ApplyGameState` as `get-game-state` reports it: a round never outlives its reply. */
  public resync(): void {
    this.send({ type: 'ApplyGameState', payload: JSON.stringify({ status: 'none' }) });
  }

  /** The bet bar's fast-game switch. */
  public toggleFastGame(): void {
    this.isFastGame = !this.isFastGame;
    this.send({ type: 'SetFastGame', payload: this.isFastGame });
  }

  /**
   * Space — spin; L — a payline; C — a Joker Coin collection; S — a Super Joker; B — the bonus from landed
   * jokers; X / Z — buy x75 / x200; G — re-send the game state; F — fast game.
   */
  public bindKeys(target: EventTarget = window): () => void {
    const actions: Record<string, () => void> = {
      Space: () => this.emit({ type: 'RequestPlay' }),
      KeyL: () => this.spin('lines'),
      KeyC: () => this.spin('collect'),
      KeyS: () => this.spin('superJoker'),
      KeyB: () => this.spin('bonus'),
      KeyX: () => this.buyBonus('x75'),
      KeyZ: () => this.buyBonus('x200'),
      KeyG: () => this.resync(),
      KeyF: () => this.toggleFastGame(),
    };
    const onKey = (event: Event): void => actions[(event as KeyboardEvent).code]?.();
    target.addEventListener('keydown', onKey);
    return () => target.removeEventListener('keydown', onKey);
  }

  private play(choice: { outcome?: JokerSlotMockOutcome; bonusBuy?: JokerSlotBonusBuy }): void {
    if (this.isBusy) {
      // The stage server refuses a second play while one is in flight.
      BridgeLogger.warn('[JokerSlotMockHost] play while a round is in play: Active round already exist');
      return;
    }
    const { bet, currency, random } = this.options;
    const reply = dealJokerSlotRound({ bet, currency, random, ...choice });
    this.isBusy = true;
    this.send({ type: 'ApplySpinResult', payload: JSON.stringify(reply) });
  }

  private finishRound(): void {
    if (!this.isBusy) BridgeLogger.warn('[JokerSlotMockHost] SpinReady without a round in play');
    this.isBusy = false;
  }

  /** As the stage backend's `get-game-config`: limits, currency and the buy multipliers, x300 included. */
  private gameConfig(): unknown {
    const { currency } = this.options;
    return {
      bonusBuyMultiplier: { x75: 75, x200: 200, x300: 300 },
      betConfig: { minBetAmount: '0.10', maxBetAmount: '10000.00', maxWinAmount: '100000.00', defaultBetAmount: '1.00', betPresets: [], currency },
      currency: { code: currency, type: 'FIAT', displayName: '$', decimalPlaces: 2 },
    };
  }

  private send(command: EngineCommand): void {
    this.game?.receive(command);
  }
}
