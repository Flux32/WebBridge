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
  /**
   * Лесенки по именам сложности — как DifficultyEntry[] в MockConfig
   * C#-пакета. Сложность на бэке выбирает таблицу коэффициентов, поэтому здесь
   * она делает ровно то же: меняет лесенку и переотправляет конфиг.
   */
  difficulties: Record<string, number[]>;
  /** Текущая сложность; по умолчанию — первая в наборе. */
  difficulty: string;
  /** Вероятность проигрыша на шаге. */
  loseChance: number;
  /** Валюта в ответах — движок показывает её как есть. */
  currency: string;
}

/**
 * Четыре уровня платформы — ровно те, что уходят на бэк в `value.difficulty`
 * (`DifficultyLevel` во фронтенде) и что показывает чит-панель Unity. Регистр
 * верхний, как на проводе.
 *
 * Лесенки — иллюстративные: EASY/MEDIUM/HARD взяты из MockConfig C#-пакета,
 * DAREDEVIL добавлен по смыслу уровня (короче и круче). Настоящие таблицы
 * присылает сервер, мок лишь даёт чему-то приехать в конфиге.
 */
const DEFAULT_DIFFICULTIES: Record<string, number[]> = {
  EASY: [1.1, 1.2, 1.4, 1.8, 2.2, 2.6, 3.2, 4.1, 5.8],
  MEDIUM: [1.2, 1.5, 1.8, 2.4, 3.0, 3.8, 5.0, 7.0, 10.0],
  HARD: [1.5, 2.0, 3.0, 4.5, 6.5, 9.0, 13.0, 18.0, 25.0],
  DAREDEVIL: [2.0, 4.5, 9.0, 19.0, 40.0, 85.0, 180.0],
};

const DEFAULTS: MockHostOptions = {
  difficulties: DEFAULT_DIFFICULTIES,
  difficulty: 'EASY',
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

    // Сложность, которой нет в переданном наборе, оставила бы мок без лесенки.
    if (!(this.options.difficulty in this.options.difficulties)) {
      const [first] = Object.keys(this.options.difficulties);
      if (first === undefined) throw new Error('MockHost: difficulties пуст');
      this.options.difficulty = first;
    }
  }

  /** Имена сложностей в порядке объявления — для перебора в панели. */
  public get difficultyNames(): string[] {
    return Object.keys(this.options.difficulties);
  }

  public get difficulty(): string {
    return this.options.difficulty;
  }

  /** Лесенка текущей сложности. */
  public get coefficients(): number[] {
    // Конструктор гарантирует, что текущая сложность есть в наборе.
    return this.options.difficulties[this.options.difficulty]!;
  }

  public get loseChance(): number {
    return this.options.loseChance;
  }

  public set loseChance(value: number) {
    this.options.loseChance = Math.min(1, Math.max(0, value));
  }

  /**
   * Сменить сложность: новая лесенка уезжает в движок конфигом, а раунд
   * начинается заново — на бэке смена сложности тоже относится к новому
   * раунду, а не к текущему.
   */
  public setDifficulty(name: string): void {
    if (!(name in this.options.difficulties) || name === this.options.difficulty) return;

    this.options.difficulty = name;
    this.sendGameConfig();
    this.restart('difficulty');
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
        coefficients: this.coefficients,
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
