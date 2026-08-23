/**
 * Заглушка React-стороны для локальной разработки — аналог мок-режима
 * C#-пакета (`Tools → WebBridge → Enable Mock`). Отвечает на запросы движка
 * и ведёт раунд сам: раздаёт лесенку, решает исход шага, закрывает раунд.
 *
 * Смысл в том, что игра при этом идёт по НАСТОЯЩЕМУ пути — тот же
 * `__PHASER_BOOT__`, тот же мост, те же команды. Подменяется только
 * собеседник, поэтому мок проверяет интеграцию, а не обходит её.
 */
import type {
  EngineEvent,
  PhaserGameBridge,
  PhaserHostBridge,
} from '@omega/webbridge-protocol';

export interface MockHostOptions {
  /** Лесенка раунда. Игра обычно передаёт свою — по числу шагов в сцене. */
  coefficients: number[];
  /** Вероятность проигрыша на шаге. */
  loseChance: number;
  /** Валюта в ответах — движок показывает её как есть. */
  currency: string;
}

const DEFAULTS: MockHostOptions = {
  coefficients: [1.5, 2, 3, 5, 8, 13, 21, 34],
  loseChance: 0.2,
  currency: 'USD',
};

export class MockHost implements PhaserHostBridge {
  private readonly options: MockHostOptions;
  private game: PhaserGameBridge | null = null;

  // Шаг занят, пока движок не доиграл анимацию и не прислал SpinReady —
  // ровно так же бет-бар React блокирует кнопку между шагами.
  private isBusy = false;
  private isRoundOver = false;

  public constructor(options: Partial<MockHostOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Отдать мока игре, поднятой через `__PHASER_BOOT__`. */
  public attach(game: PhaserGameBridge): void {
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
      // Движок доиграл шаг и готов к следующему. После проигрыша сцена
      // пересобирает раунд сама и присылает этот же сигнал — поэтому здесь же
      // снимается и закрытость раунда, иначе мок остался бы думать, что ставку
      // делать нельзя, хотя куча уже стоит целой.
      case 'SpinReady':
        this.isBusy = false;
        this.isRoundOver = false;
        return;
      default:
        return;
    }
  }

  public ready(): void {
    this.sendGameConfig();
    this.sendGameState();
  }

  public setProgress(): void {}

  /**
   * Ставка: один шаг раунда. Исход бросается здесь — на месте бэка, а не в
   * сцене. Пока предыдущий шаг доигрывается, нажатие игнорируется.
   */
  public step(): void {
    if (this.isBusy || this.isRoundOver) return;

    this.isBusy = true;
    const isWin = Math.random() >= this.options.loseChance;
    if (!isWin) this.isRoundOver = true;

    this.send({
      type: 'ApplyStepResult',
      payload: { isWinMain: isWin, coinsTriggered: false, coinsCollected: [] },
    });
  }

  /** Кэшаут: React закрывает раунд и просит собрать сцену заново. */
  public cashout(): void {
    this.restart('cashout');
  }

  /**
   * Пересобрать раунд принудительно. В обычном ходе дел этого не требуется:
   * после проигрыша движок пересобирает сцену сам и отпускает мок через
   * SpinReady. Нужно, когда раунд надо оборвать посреди лесенки.
   */
  public restart(reason = 'lose'): void {
    this.isRoundOver = false;
    this.isBusy = false;
    this.send({ type: 'RestartRound', payload: `${reason}|` });
  }

  /**
   * Клавиши как у мок-панели в редакторе Unity: пробел — шаг, C — кэшаут,
   * R — пересобрать раунд после проигрыша.
   */
  public bindKeys(target: EventTarget = window): () => void {
    const onKeyDown = (event: Event): void => {
      const key = (event as KeyboardEvent).code;
      if (key === 'Space') this.step();
      else if (key === 'KeyC') this.cashout();
      else if (key === 'KeyR') this.restart();
      else return;

      event.preventDefault();
    };

    target.addEventListener('keydown', onKeyDown);
    return () => target.removeEventListener('keydown', onKeyDown);
  }

  private sendGameConfig(): void {
    this.send({
      type: 'ApplyGameConfig',
      payload: JSON.stringify({
        coefficients: this.options.coefficients,
        bonusCounts: {},
        bonusModes: {},
        currency: this.options.currency,
      }),
    });
  }

  private sendGameState(): void {
    this.send({
      type: 'ApplyGameState',
      payload: JSON.stringify({ status: 'none', isFinished: false, isWin: false, coeff: 1 }),
    });
  }

  private send(command: Parameters<PhaserGameBridge['receive']>[0]): void {
    this.game?.receive(command);
  }
}
