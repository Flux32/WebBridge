/**
 * Мост игры Road — зеркало C#-шного `RoadWebBridge`. Разбирает команды React в
 * сигналы, на которые подписываются сцены, и отдаёт наружу методы уведомлений.
 * Ни одной игровой сущности здесь не импортируется: зависимость идёт от игры к
 * мосту, не наоборот.
 */
import type {
  CoreCommand,
  EngineCommand,
  GameConfigPayload,
  StartBonusPayload,
  StepResultPayload,
  UiVisibilityPayload,
} from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';

/** `RestartRound` приходит строкой `"<причина>|<сумма>"`, например `"cashout|$5.00"`. */
export interface RestartRequest {
  reason: string;
  amount: string;
}

export class RoadBridge extends BridgeBase {
  public readonly gameConfigReceived = new Signal<GameConfigPayload>();
  public readonly gameStateReceived = new Signal<unknown>();
  public readonly stepResultReceived = new Signal<StepResultPayload>();
  public readonly coefficientsReceived = new Signal<number[]>();
  public readonly autoplayChanged = new Signal<boolean>();
  public readonly restartRequested = new Signal<RestartRequest>();
  public readonly bonusStartRequested = new Signal<StartBonusPayload>();
  public readonly cashoutPressed = new Signal();

  public lastGameConfig: GameConfigPayload | null = null;
  public lastGameState: unknown = null;

  private uiVisibility: UiVisibilityPayload = {};

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

  protected override handleGameCommand(command: Exclude<EngineCommand, CoreCommand>): void {
    switch (command.type) {
      case 'ApplyGameConfig': {
        const config = JSON.parse(command.payload) as GameConfigPayload;
        this.lastGameConfig = config;
        this.hasReceivedInitialConfig = true;
        this.gameConfigReceived.invoke(config);
        return;
      }
      case 'ApplyGameState': {
        const state: unknown = JSON.parse(command.payload);
        this.lastGameState = state;
        this.gameStateReceived.invoke(state);
        return;
      }
      case 'ApplyStepResult':
        this.stepResultReceived.invoke(command.payload);
        return;
      case 'UpdateCoeffs':
        this.coefficientsReceived.invoke(command.payload);
        return;
      case 'SetAutoplay':
        this.autoplayChanged.invoke(command.payload);
        return;
      case 'RestartRound': {
        const [reason = '', amount = ''] = command.payload.split('|');
        this.restartRequested.invoke({ reason, amount });
        return;
      }
      case 'StartBonus':
        this.bonusStartRequested.invoke(command.payload);
        return;
      case 'CashoutPressed':
        this.cashoutPressed.invoke();
        return;
      case 'ApplyBonusPurchaseResult':
        // TODO: довести вместе со сценой магазина бонусов — сигнал заводить
        // тогда же, чтобы не плодить мёртвый API.
        BridgeLogger.warn(`[RoadBridge] ${command.type} ещё не обработан`);
        return;
    }
  }

  // ───────────────────────────── Игра → React ─────────────────────────────

  public playSound(key: string, volume?: number): void {
    this.transport.send({ type: 'PlaySound', key, ...(volume === undefined ? {} : { volume }) });
  }

  public playMusic(key: string, volume?: number): void {
    this.transport.send({ type: 'PlayMusic', key, ...(volume === undefined ? {} : { volume }) });
  }

  public playLoop(key: string, volume?: number): void {
    this.transport.send({ type: 'PlayLoop', key, ...(volume === undefined ? {} : { volume }) });
  }

  public stopLoop(key: string): void {
    this.transport.send({ type: 'StopLoop', key });
  }

  /** Игра просит React перерисовать свой UI под новое состояние сцены. */
  public setUiVisibility(patch: UiVisibilityPayload): void {
    this.uiVisibility = { ...this.uiVisibility, ...patch };
    this.syncUiVisibility();
  }

  protected override syncUiVisibility(): void {
    this.transport.send({ type: 'UiVisibility', payload: this.uiVisibility });
  }

  public notifySpinReady(): void {
    this.transport.send({ type: 'SpinReady' });
  }

  public notifyBonusActive(): void {
    this.transport.send({ type: 'BonusActive' });
  }

  public notifyBonusEnded(): void {
    this.transport.send({ type: 'BonusEnded' });
  }

  public notifyBonusCleared(): void {
    this.transport.send({ type: 'BonusCleared' });
  }

  /** Прогресс автоплея бонуса переживает перезагрузку страницы: его хранит React. */
  public saveBonusAutoPlayProgress(progress: unknown): void {
    this.transport.send({ type: 'BonusProgressSave', raw: JSON.stringify(progress) });
  }

  public clearBonusAutoPlayProgress(): void {
    this.transport.send({ type: 'BonusProgressClear' });
  }
}
