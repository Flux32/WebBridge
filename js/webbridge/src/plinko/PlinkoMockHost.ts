/**
 * Заглушка React-стороны для Plinko — аналог `MockHost` из режима Crush под
 * механику броска: отвечает на запросы игры и ведёт бросок сам — выбирает ячейку,
 * считает выплату и держит бет-бар занятым, пока игра не пришлёт `DropFinished`.
 *
 * Игра идёт по НАСТОЯЩЕМУ пути — тот же `__WEB_GAME_BOOT__`, тот же мост, те же
 * команды. Подменяется только собеседник, поэтому мок проверяет интеграцию, а не
 * обходит её. Суммы в ответах ИЛЛЮСТРАТИВНЫЕ: на бою их считает сервер.
 */
import type { EngineCommand, EngineEvent, WebGameBridge, WebHostBridge } from '@omega/webbridge-protocol';

export type PlinkoRisk = 'LOW' | 'MEDIUM' | 'HIGH';

/** Куда мок положит шарик следующего броска: редкий исход — по кнопке, а не ожиданием. */
export type PlinkoMockScenario = 'random' | 'top' | 'bottom';

const RISKS: readonly PlinkoRisk[] = ['LOW', 'MEDIUM', 'HIGH'];

export interface PlinkoMockHostOptions {
  /** Линия ячеек слева направо для каждого риска — как `coefficients` в конфиге бэкенда. */
  coefficients: Record<PlinkoRisk, number[]>;
  risk: PlinkoRisk;
  currency: string;
  decimalPlaces: number;
  betAmount: number;
  balance: number;
  /** Источник случайности; тесты подменяют его, чтобы исход был предсказуем. */
  random: () => number;
}

/** 9 ячеек — доска в 8 рядов штырьков. Коэффициенты иллюстративные. */
const DEFAULTS: PlinkoMockHostOptions = {
  coefficients: {
    LOW: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    MEDIUM: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    HIGH: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  risk: 'LOW',
  currency: 'USD',
  decimalPlaces: 2,
  betAmount: 1,
  balance: 1000,
  random: Math.random,
};

export class PlinkoMockHost implements WebHostBridge {
  private readonly options: PlinkoMockHostOptions;
  private game: WebGameBridge | null = null;

  /** Бросок занят, пока игра не прислала `DropFinished` — так же бет-бар держит Play. */
  private isBusy = false;

  public constructor(options: Partial<PlinkoMockHostOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public get risk(): PlinkoRisk {
    return this.options.risk;
  }

  /** Отдать мока игре, поднятой через `__WEB_GAME_BOOT__`. */
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
      case 'DropFinished':
        this.isBusy = false;
        return;
      // Бросок из самой сцены — то же, что Play: пока шарик летит, мок отказывает, как хост.
      case 'RequestPlay':
        if (this.isBusy) this.send({ type: 'DisabledPlayPressed' });
        else this.drop();
        return;
      default:
        return;
    }
  }

  /** В мок-режиме мост не спрашивает конфиг сам, поэтому хост пушит его по готовности игры. */
  public ready(): void {
    this.sendGameConfig();
    this.sendGameState();
  }

  public setProgress(): void {}

  /** Ставка: один бросок. Пока предыдущий шарик не сел, нажатие игнорируется. */
  public drop(scenario: PlinkoMockScenario = 'random'): void {
    if (this.isBusy) return;

    this.isBusy = true;
    const slots = this.options.coefficients[this.options.risk];
    const resultPosition = this.resolveSlot(slots, scenario);
    const coeff = slots[resultPosition]!;
    const winAmount = coeff * this.options.betAmount;
    const isWin = winAmount > 0;

    this.send({
      type: 'ApplyDropResult',
      payload: JSON.stringify({
        ...this.baseState(),
        status: isWin ? 'win' : 'lose',
        isFinished: true,
        isWin,
        coeff,
        resultPosition,
        risk: this.options.risk,
        winAmount: this.formatAmount(winAmount),
      }),
    });
  }

  /** Следующий риск по кругу — на бэке риск выбирает игрок в бет-баре. */
  public cycleRisk(): void {
    const next = (RISKS.indexOf(this.options.risk) + 1) % RISKS.length;
    this.options.risk = RISKS[next]!;
  }

  /** Пробел — бросок, T — в верхнюю ячейку, B — в нижнюю, R — сменить риск. */
  public bindKeys(target: EventTarget = window): () => void {
    const onKeyDown = (event: Event): void => {
      const key = (event as KeyboardEvent).code;
      if (key === 'Space') this.drop();
      else if (key === 'KeyT') this.drop('top');
      else if (key === 'KeyB') this.drop('bottom');
      else if (key === 'KeyR') this.cycleRisk();
      else return;

      event.preventDefault();
    };

    target.addEventListener('keydown', onKeyDown);
    return () => target.removeEventListener('keydown', onKeyDown);
  }

  /**
   * Случайная ячейка — как на доске: каждый ряд штырьков отклоняет шарик влево или
   * вправо, поэтому крайние ячейки выпадают реже всего, как и на бою.
   */
  private resolveSlot(slots: readonly number[], scenario: PlinkoMockScenario): number {
    if (scenario === 'top') return slots.indexOf(Math.max(...slots));
    if (scenario === 'bottom') return slots.indexOf(Math.min(...slots));

    let position = 0;
    for (let row = 0; row < slots.length - 1; row++) {
      if (this.options.random() < 0.5) position++;
    }
    return position;
  }

  private sendGameConfig(): void {
    const { currency, betAmount, balance, coefficients } = this.options;
    this.send({
      type: 'ApplyGameConfig',
      payload: JSON.stringify({
        currency,
        minBetAmount: betAmount,
        maxBetAmount: betAmount * 100,
        balance,
        coefficients,
      }),
    });
  }

  private sendGameState(): void {
    this.send({
      type: 'ApplyGameState',
      payload: JSON.stringify({ ...this.baseState(), status: 'none', isFinished: true, isWin: false }),
    });
  }

  private baseState(): Record<string, unknown> {
    const { currency, decimalPlaces, betAmount } = this.options;
    const amount = this.formatAmount(betAmount);
    return { bet: { amount, currency, decimalPlaces }, betAmount: amount, currency };
  }

  private formatAmount(value: number): string {
    return value.toFixed(this.options.decimalPlaces);
  }

  private send(command: EngineCommand): void {
    this.game?.receive(command);
  }
}
