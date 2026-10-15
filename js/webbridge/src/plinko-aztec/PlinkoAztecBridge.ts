/**
 * Мост режима Plinko Aztec — зеркало C#-шного `PlinkoAztecWebBridge`. Ставкой
 * владеет React: он зовёт `play({ betPerBall, ballsAmount })` и присылает готовый
 * GameState `ApplyDropResult`. Игра роняет каждый шарик в его `ballsResult`,
 * играет колесо и бонус, если они пришли, и сообщает `notifyDropFinished()`.
 *
 * Бонусная игра — тот же цикл: тап игрока по полю — `requestStep()`, React зовёт
 * `step()` и присылает результат `ApplyBonusStepResult`.
 *
 * Число шариков и ставку за шар выбирают в бет-баре: React пушит выбор после
 * загрузки и на каждое переключение. Мост кэширует значение, поэтому поздний
 * подписчик читает `currentBallsAmount` / `currentBetPerBall`, а не ждёт смены.
 */
import type { CoreCommand, EngineCommand } from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';
import { compareBetPerBall, isZeroBetPerBall, parseBetPerBall, type BetPerBallAmount } from './betPerBallAmount';
import { resolveDirection, type BallsAmountChange, type BetPerBallChange } from './selectionChange';

export type { BallsAmountChange, BetPerBallChange, SelectionDirection } from './selectionChange';

/** Число шариков неизвестно, пока React не прислал выбор бет-бара. */
const UNKNOWN_BALLS_AMOUNT = 0;

export class PlinkoAztecBridge extends BridgeBase {
  public readonly gameConfigReceived = new Signal<unknown>();
  public readonly gameStateReceived = new Signal<unknown>();
  public readonly dropResultReceived = new Signal<unknown>();
  public readonly stepResultReceived = new Signal<unknown>();
  public readonly ballsAmountChanged = new Signal<BallsAmountChange>();
  public readonly betPerBallChanged = new Signal<BetPerBallChange>();

  public lastGameConfig: unknown = null;
  public lastGameState: unknown = null;
  public lastDropResult: unknown = null;
  public lastStepResult: unknown = null;

  /** Сколько шариков уйдёт в следующий бросок. `0`, пока React не прислал выбор. */
  public currentBallsAmount = UNKNOWN_BALLS_AMOUNT;
  /** Ставка за шар следующего броска строкой бэкенда. `null`, пока React её не прислал. */
  public currentBetPerBall: string | null = null;

  /** Разобранная `currentBetPerBall`: смена сравнивается по сумме, `"2"` равно `"2.0"`. */
  private currentBetPerBallAmount: BetPerBallAmount | null = null;

  public constructor(transport: BridgeTransport) {
    super(transport);
  }

  /** Зовётся игрой, когда сцена готова принимать данные. */
  public start(): void {
    this.beginInitialSync();
  }

  public override requestGameConfig(): void {
    this.transport.send({ type: 'RequestGameConfig' });
  }

  public override requestGameState(): void {
    this.transport.send({ type: 'RequestGameState' });
  }

  protected override applyGameConfig(payload: string): void {
    const config: unknown = JSON.parse(payload);
    this.lastGameConfig = config;
    this.hasReceivedInitialConfig = true;
    this.gameConfigReceived.invoke(config);
  }

  protected override applyGameState(payload: string): void {
    const state: unknown = JSON.parse(payload);
    this.lastGameState = state;
    this.gameStateReceived.invoke(state);
  }

  protected override handleGameCommand(command: Exclude<EngineCommand, CoreCommand>): void {
    switch (command.type) {
      case 'SetBallsAmount':
        this.applyBallsAmount(command.payload);
        return;
      case 'SetBetPerBall':
        this.applyBetPerBall(command.payload);
        return;
      case 'ApplyDropResult':
        this.lastDropResult = this.applyRoundState(command.payload, this.dropResultReceived);
        return;
      case 'ApplyBonusStepResult':
        this.lastStepResult = this.applyRoundState(command.payload, this.stepResultReceived);
        return;
      default:
        BridgeLogger.warn(`[PlinkoAztecBridge] ${command.type} не относится к plinko-aztec`);
    }
  }

  // ───────────────────────────── Игра → React ─────────────────────────────

  /** Игрок тапнул поле в бонусной игре. React ответит `ApplyBonusStepResult`. */
  public requestStep(): void {
    this.transport.send({ type: 'RequestStep' });
  }

  /** Для кода, поднявшегося позже пуша. React ответит `SetBallsAmount`. */
  public requestBallsAmount(): void {
    this.transport.send({ type: 'RequestBallsAmount' });
  }

  /** Для кода, поднявшегося позже пуша. React ответит `SetBetPerBall`. */
  public requestBetPerBall(): void {
    this.transport.send({ type: 'RequestBetPerBall' });
  }

  /**
   * Все шарики сели — бет-бар можно разблокировать. Звать ровно один раз на
   * `ApplyDropResult`, когда анимация доиграна, включая колесо и бонус.
   */
  public notifyDropFinished(): void {
    this.transport.send({ type: 'DropFinished' });
  }

  /** Бросок и шаг бонуса приходят одним GameState: он же становится текущим состоянием. */
  private applyRoundState(payload: string, received: Signal<unknown>): unknown {
    const state: unknown = JSON.parse(payload);
    this.lastGameState = state;
    received.invoke(state);
    return state;
  }

  /** Тот же выбор повторно событие не поднимает. */
  private applyBallsAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= UNKNOWN_BALLS_AMOUNT) {
      BridgeLogger.warn(`[PlinkoAztecBridge] SetBallsAmount проигнорирован: ${amount}`);
      return;
    }
    if (amount === this.currentBallsAmount) return;

    const previousAmount = this.currentBallsAmount;
    this.currentBallsAmount = amount;
    const direction = resolveDirection(previousAmount === UNKNOWN_BALLS_AMOUNT, amount - previousAmount);
    this.ballsAmountChanged.invoke({ amount, previousAmount, direction });
  }

  /** Разбирается только для проверки и направления — мост хранит строку бэкенда. */
  private applyBetPerBall(betPerBall: string): void {
    const amount = parseBetPerBall(betPerBall);
    if (amount === null || isZeroBetPerBall(amount)) {
      BridgeLogger.warn(`[PlinkoAztecBridge] SetBetPerBall проигнорирован: ${betPerBall}`);
      return;
    }

    const previousAmount = this.currentBetPerBallAmount;
    const comparison = previousAmount === null ? 1 : compareBetPerBall(amount, previousAmount);
    if (comparison === 0) return;

    const previousBetPerBall = this.currentBetPerBall;
    this.currentBetPerBall = betPerBall;
    this.currentBetPerBallAmount = amount;
    const direction = resolveDirection(previousAmount === null, comparison);
    this.betPerBallChanged.invoke({ betPerBall, previousBetPerBall, direction });
  }
}
