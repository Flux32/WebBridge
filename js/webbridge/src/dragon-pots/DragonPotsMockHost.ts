/**
 * Mock host of Dragon Pots: stands in for the shell and answers the game with replies in the stage
 * backend's shape (`dealDragonPotsRound`). Every play — a spin or a Mighty / Mega / Super buy, charged at its
 * full price — comes back whole as one `ApplySpinResult`; `RequestGameState` answers `{}`, as
 * `get-game-state` does. A rare feature can be forced for the next spin instead of waited for. The round
 * stays busy until the game sends `SpinReady`, as the shell's bet bar does.
 */
import type { DragonPotsBonusBuy, EngineCommand, EngineEvent, WebGameBridge, WebHostBridge } from '@omega/webbridge-protocol';
import { BridgeLogger } from '../core/BridgeLogger';
import { dealDragonPotsRound, type DragonPotsMockOutcome } from './dragonPotsMockRound';

export interface DragonPotsMockHostOptions {
  currency: string;
  /** The bet, in currency units. */
  bet: number;
  random: () => number;
}

const DEFAULTS: DragonPotsMockHostOptions = { currency: 'USD', bet: 1, random: Math.random };

/** Digit keys force what the pots trigger: the key is the server's `bonusTypeIndex` + 1. */
const FORCED_BY_KEY: Readonly<Record<string, DragonPotsMockOutcome>> = {
  Digit1: 'Mighty',
  Digit2: 'Mega',
  Digit3: 'Super',
  Digit4: 'Jackpot',
  Digit5: 'Ultra',
  Digit6: 'Supreme',
  Digit7: 'Ultimate',
  Digit8: 'Lose',
};

export class DragonPotsMockHost implements WebHostBridge {
  private readonly options: DragonPotsMockHostOptions;
  private game: WebGameBridge | null = null;
  /** Busy from the play until the game's `SpinReady`. */
  private isBusy = false;
  private isFastGame = false;

  public constructor(options: Partial<DragonPotsMockHostOptions> = {}) {
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

  /** A spin at the bet; `outcome` makes the pots trigger it (a dev key), else the draw decides. */
  public spin(outcome?: DragonPotsMockOutcome): void {
    this.play(outcome === undefined ? {} : { outcome });
  }

  /** A bought Hold & Win: the play's amount is the full price, `bet × price`. */
  public buyBonus(bonusBuy: DragonPotsBonusBuy): void {
    this.play({ bonusBuy });
  }

  /** `ApplyGameState` as `get-game-state` reports it — always `{}`: a round never outlives its reply. */
  public resync(): void {
    this.send({ type: 'ApplyGameState', payload: JSON.stringify({}) });
  }

  /** The bet bar's fast-game switch. */
  public toggleFastGame(): void {
    this.isFastGame = !this.isFastGame;
    this.send({ type: 'SetFastGame', payload: this.isFastGame });
  }

  /**
   * Space — spin; 1…7 — a spin that triggers Mighty, Mega, Super, Jackpot, Ultra, Supreme, Ultimate; 8 — coins
   * that trigger nothing; B / N / M — buy Mighty / Mega / Super; G — re-send the game state; F — fast game.
   */
  public bindKeys(target: EventTarget = window): () => void {
    const actions: Record<string, () => void> = {
      Space: () => this.emit({ type: 'RequestPlay' }),
      KeyB: () => this.buyBonus('Mighty'),
      KeyN: () => this.buyBonus('Mega'),
      KeyM: () => this.buyBonus('Super'),
      KeyG: () => this.resync(),
      KeyF: () => this.toggleFastGame(),
    };
    const onKey = (event: Event): void => {
      const { code } = event as KeyboardEvent;
      const forced = FORCED_BY_KEY[code];
      if (forced !== undefined) this.spin(forced);
      else actions[code]?.();
    };
    target.addEventListener('keydown', onKey);
    return () => target.removeEventListener('keydown', onKey);
  }

  private play(choice: { outcome?: DragonPotsMockOutcome; bonusBuy?: DragonPotsBonusBuy }): void {
    if (this.isBusy) {
      // The stage server refuses a second play while one is in flight.
      BridgeLogger.warn('[DragonPotsMockHost] play while a round is in play: Active round already exist');
      return;
    }
    const { bet, currency, random } = this.options;
    const reply = dealDragonPotsRound({ bet, currency, random, ...choice });
    this.isBusy = true;
    this.send({ type: 'ApplySpinResult', payload: JSON.stringify(reply) });
  }

  private finishRound(): void {
    if (!this.isBusy) BridgeLogger.warn('[DragonPotsMockHost] SpinReady without a round in play');
    this.isBusy = false;
  }

  /** As the stage backend's `get-game-config`: limits and currency, no bonus prices. */
  private gameConfig(): unknown {
    const { currency } = this.options;
    return {
      betConfig: { minBetAmount: '0.10', maxBetAmount: '10000.00', maxWinAmount: '100000.00', defaultBetAmount: '1.00', betPresets: [], currency },
      currency: { code: currency, type: 'FIAT', displayName: '$', decimalPlaces: 2 },
    };
  }

  private send(command: EngineCommand): void {
    this.game?.receive(command);
  }
}
