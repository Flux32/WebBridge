/**
 * Заглушка React-стороны для Plinko Aztec — веб-аналог мок-режима
 * `PlinkoAztecWebBridge`. Делает то, что на бою делает шелл: держит выбор бет-бара
 * (число шариков и ставку за шар) и пушит его в игру, отвечает на её запросы,
 * бросает по нажатию и ведёт бонусную игру по тапам. Ответы платформы собирает
 * `PlinkoAztecMockSession`.
 *
 * Игра идёт по НАСТОЯЩЕМУ пути — тот же `__WEB_GAME_BOOT__`, тот же мост, те же
 * команды. Подменяется только собеседник, поэтому мок проверяет интеграцию, а не
 * обходит её.
 */
import type { EngineCommand, EngineEvent, WebGameBridge, WebHostBridge } from '@omega/webbridge-protocol';
import {
  DEFAULT_PLINKO_AZTEC_MOCK_OPTIONS,
  type PlinkoAztecMockHostOptions,
  type PlinkoAztecMockScenario,
} from './plinkoAztecMockOptions';
import { PlinkoAztecMockSession, type PlinkoAztecBetSelection } from './PlinkoAztecMockSession';

export type { PlinkoAztecMockHostOptions, PlinkoAztecMockScenario } from './plinkoAztecMockOptions';

/** Шаг переключателя бет-бара: `+1` — следующий вариант, `-1` — предыдущий. */
export type PlinkoAztecOptionStep = 1 | -1;

export class PlinkoAztecMockHost implements WebHostBridge {
  private readonly options: PlinkoAztecMockHostOptions;
  private readonly session: PlinkoAztecMockSession;
  private game: WebGameBridge | null = null;

  private ballsAmountIndex = 0;
  private betPerBallIndex = 0;
  /** Бросок занят, пока игра не прислала `DropFinished` — так же бет-бар держит Play. */
  private isBusy = false;

  public constructor(options: Partial<PlinkoAztecMockHostOptions> = {}) {
    this.options = { ...DEFAULT_PLINKO_AZTEC_MOCK_OPTIONS, ...options };
    this.session = new PlinkoAztecMockSession(this.options);
  }

  public get isBonusActive(): boolean {
    return this.session.isBonusActive;
  }

  public get selection(): PlinkoAztecBetSelection {
    return {
      ballsAmount: this.options.ballsAmountOptions[this.ballsAmountIndex]!,
      betPerBall: this.options.betPerBallOptions[this.betPerBallIndex]!,
    };
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
      case 'RequestBallsAmount':
        this.send({ type: 'SetBallsAmount', payload: this.selection.ballsAmount });
        return;
      case 'RequestBetPerBall':
        this.send({ type: 'SetBetPerBall', payload: this.selection.betPerBall });
        return;
      case 'RequestStep':
        this.step();
        return;
      case 'DropFinished':
        this.isBusy = false;
        return;
      // Бросок из самой сцены — то же, что Play: пока бар заблокирован, мок отказывает, как хост.
      case 'RequestPlay':
        if (this.isBarLocked()) this.send({ type: 'DisabledPlayPressed' });
        else this.drop();
        return;
      default:
        return;
    }
  }

  /** Как шелл после загрузки движка: сначала выбор бет-бара, затем конфиг и состояние. */
  public ready(): void {
    this.send({ type: 'SetBallsAmount', payload: this.selection.ballsAmount });
    this.send({ type: 'SetBetPerBall', payload: this.selection.betPerBall });
    this.sendGameConfig();
    this.sendGameState();
  }

  public setProgress(): void {}

  /** Ставка: один бросок. Пока шарики летят или идёт бонус, нажатие игнорируется. */
  public drop(scenario: PlinkoAztecMockScenario = 'random'): void {
    if (this.isBarLocked()) return;

    this.isBusy = true;
    const result = this.session.buildDropResult(this.selection, scenario);
    this.send({ type: 'ApplyDropResult', payload: JSON.stringify(result) });
  }

  /** Шаг бонусной игры — ответ на тап игрока. Вне бонуса шагать нечего. */
  public step(): void {
    if (!this.session.isBonusActive) return;

    const result = this.session.buildStepResult(this.selection);
    this.send({ type: 'ApplyBonusStepResult', payload: JSON.stringify(result) });
  }

  /** Переключатель числа шариков. Пока бар заблокирован или вариант крайний — ничего. */
  public changeBallsAmount(step: PlinkoAztecOptionStep): void {
    const index = this.nextOptionIndex(this.ballsAmountIndex, step, this.options.ballsAmountOptions.length);
    if (index === this.ballsAmountIndex) return;

    this.ballsAmountIndex = index;
    this.send({ type: 'SetBallsAmount', payload: this.selection.ballsAmount });
  }

  /** Переключатель ставки за шар — по тем же правилам, что и шарики. */
  public changeBetPerBall(step: PlinkoAztecOptionStep): void {
    const index = this.nextOptionIndex(this.betPerBallIndex, step, this.options.betPerBallOptions.length);
    if (index === this.betPerBallIndex) return;

    this.betPerBallIndex = index;
    this.send({ type: 'SetBetPerBall', payload: this.selection.betPerBall });
  }

  /** Новый игрок: прогресс бамперов сброшен, бонус снят, конфиг и состояние переотправлены. */
  public reset(): void {
    this.session.reset();
    this.isBusy = false;
    this.sendGameConfig();
    this.sendGameState();
  }

  /**
   * Пробел — бросок, T / B — все шарики в верхнюю / нижнюю ячейку, W — колесо, G — колесо
   * с бонусной игрой, S — шаг бонуса, ↑↓ — шарики, →← — ставка, R — новый игрок.
   */
  public bindKeys(target: EventTarget = window): () => void {
    const actions: Record<string, () => void> = {
      Space: () => this.drop(),
      KeyT: () => this.drop('top'),
      KeyB: () => this.drop('bottom'),
      KeyW: () => this.drop('fortune-wheel'),
      KeyG: () => this.drop('bonus-game'),
      KeyS: () => this.step(),
      ArrowUp: () => this.changeBallsAmount(1),
      ArrowDown: () => this.changeBallsAmount(-1),
      ArrowRight: () => this.changeBetPerBall(1),
      ArrowLeft: () => this.changeBetPerBall(-1),
      KeyR: () => this.reset(),
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

  /** Бет-бар шелла заблокирован, пока шарики летят и пока идёт бонусная игра. */
  private isBarLocked(): boolean {
    return this.isBusy || this.session.isBonusActive;
  }

  private nextOptionIndex(index: number, step: PlinkoAztecOptionStep, length: number): number {
    if (this.isBarLocked()) return index;

    return Math.min(length - 1, Math.max(0, index + step));
  }

  private sendGameConfig(): void {
    this.send({ type: 'ApplyGameConfig', payload: JSON.stringify(this.session.buildGameConfig()) });
  }

  private sendGameState(): void {
    this.send({ type: 'ApplyGameState', payload: JSON.stringify(this.session.buildGameState(this.selection)) });
  }

  private send(command: EngineCommand): void {
    this.game?.receive(command);
  }
}
