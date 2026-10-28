/**
 * Mock host of Mine Slot: stands in for the shell and answers the game with illustrative replies in the
 * backend's shape. A spin with three scatters, or a bought bonus, comes back as the base spin plus four free
 * spins on one field. The round stays busy until the game sends `SpinReady`, as the shell's bet bar does.
 */
import type { EngineCommand, EngineEvent, MineSlotSpinResult, WebGameBridge, WebHostBridge } from '@omega/webbridge-protocol';
import { dealBoard, dealBonusBoard, dealField, startsBonus } from './mineSlotMockBoards';
import { playMineSlotRounds } from './mineSlotMockRound';

const FREE_SPINS = 4;

export interface MineSlotMockHostOptions {
  currency: string;
  betAmount: number;
  random: () => number;
}

const DEFAULTS: MineSlotMockHostOptions = { currency: 'USD', betAmount: 1, random: Math.random };

export class MineSlotMockHost implements WebHostBridge {
  private readonly options: MineSlotMockHostOptions;
  private game: WebGameBridge | null = null;
  private isBusy = false;

  public constructor(options: Partial<MineSlotMockHostOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public attach(game: WebGameBridge): void {
    this.game = game;
  }

  public emit(event: EngineEvent): void {
    switch (event.type) {
      case 'RequestGameConfig':
        this.send({ type: 'ApplyGameConfig', payload: JSON.stringify({ currency: this.options.currency }) });
        return;
      case 'RequestGameState':
        this.send({ type: 'ApplyGameState', payload: JSON.stringify({ status: 'none' }) });
        return;
      case 'SpinReady':
        this.isBusy = false;
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

  /** A plain spin; three scatters turn it into a bonus game. */
  public spin(): void {
    if (this.isBusy) return;
    this.deliver(dealBoard(this.options.random));
  }

  /** A bought bonus game: the reply carries the base spin and every free spin. */
  public buyBonus(): void {
    if (this.isBusy) return;
    this.deliver(dealBonusBoard(this.options.random));
  }

  /** Space — spin, B — buy a bonus game. */
  public bindKeys(target: EventTarget = window): () => void {
    const onKey = (event: Event): void => {
      const { code } = event as KeyboardEvent;
      if (code === 'Space') this.emit({ type: 'RequestPlay' });
      else if (code === 'KeyB') this.buyBonus();
    };
    target.addEventListener('keydown', onKey);
    return () => target.removeEventListener('keydown', onKey);
  }

  private deliver(baseBoard: string): void {
    const { random, betAmount, currency } = this.options;
    const freeSpins = startsBonus(baseBoard) ? Array.from({ length: FREE_SPINS }, () => dealBoard(random)) : [];
    const played = playMineSlotRounds({ boards: [baseBoard, ...freeSpins], field: dealField(random), betAmount, random });
    const reply: MineSlotSpinResult = {
      ...played,
      status: played.coeff > 0 ? 'win' : 'lose',
      bet: { amount: betAmount.toFixed(2), currency, decimalPlaces: 2 },
      betAmount: betAmount.toFixed(2),
      currency,
      isFinished: true,
      isWin: played.coeff > 0,
      winAmount: (played.coeff * betAmount).toFixed(2),
    };
    this.isBusy = true;
    this.send({ type: 'ApplySpinResult', payload: JSON.stringify(reply) });
  }

  private send(command: EngineCommand): void {
    this.game?.receive(command);
  }
}
