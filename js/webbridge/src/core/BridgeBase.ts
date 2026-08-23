/**
 * Движко-агностичный фундамент, общий для всех игр — зеркало C#-шного
 * `WebBridgeBase<T>`. Держит то, что одинаково везде: стартовую синхронизацию с
 * React с ретраями, white-label-рукопожатие, fast game и общий UI-слой
 * (ориентация, переводы, окна результата/перехода).
 *
 * Игровая специфика живёт в наследнике (см. `road/RoadBridge`).
 */
import type {
  CoreCommand,
  EngineCommand,
  Orientation,
} from '@omega/webbridge-protocol';
import { BridgeLogger } from './BridgeLogger';
import type { BridgeTransport } from './BridgeTransport';
import { isMockEnabled } from './mockMode';
import { Signal } from './Signal';

const INITIAL_SYNC_ATTEMPTS = 10;
const INITIAL_SYNC_RETRY_INTERVAL_MS = 500;

export abstract class BridgeBase {
  /** React ответил на RequestWhiteLabel: true = white-label (без брендинга). */
  public readonly whiteLabelReceived = new Signal<boolean>();
  /** Fast game переключился — из бет-бара React либо самой игрой. */
  public readonly fastGameChanged = new Signal<boolean>();
  public readonly orientationChanged = new Signal<Orientation>();
  public readonly translationsReceived = new Signal<Record<string, string>>();
  public readonly winWindowOpened = new Signal();
  public readonly winWindowClosed = new Signal();
  public readonly transitionScreenOpenStarted = new Signal();
  public readonly transitionScreenOpenFinished = new Signal();
  public readonly transitionScreenCloseStarted = new Signal();
  public readonly transitionScreenCloseFinished = new Signal();
  /** Метрики бет-бара приходят строкой от билдера во фронтенде. */
  public readonly desktopBetBarViewportMetricsReceived = new Signal<string>();
  public readonly mobileBetBarViewportMetricsReceived = new Signal<string>();

  /** Значения кэшируются: подписчик, поднявшийся после ответа React, их не теряет. */
  public currentIsWhiteLabel: boolean | null = null;
  public isFastGameEnabled = false;

  /** Ставится наследником, когда React доставил стартовые config/state. */
  protected hasReceivedInitialConfig = false;

  private initialSyncTimerId: number | null = null;
  private initialSyncAttempts = 0;

  protected constructor(protected readonly transport: BridgeTransport) {}

  public abstract requestGameConfig(): void;
  public abstract requestGameState(): void;

  /** Команда React → игра. Базовые обрабатываются здесь, игровые уходят наследнику. */
  public receive(command: EngineCommand): void {
    switch (command.type) {
      case 'ApplyWhiteLabel':
        this.applyWhiteLabel(command.payload);
        return;
      case 'SetFastGame':
        this.applyFastGame(command.payload);
        return;
      case 'SetLoggingEnabled':
        BridgeLogger.isEnabled = command.payload;
        return;
      case 'ChangeOrientation':
        this.orientationChanged.invoke(command.payload);
        return;
      case 'ApplyTranslations':
        this.translationsReceived.invoke(JSON.parse(command.payload) as Record<string, string>);
        return;
      case 'SetDesktopBetBarViewportMetrics':
        this.desktopBetBarViewportMetricsReceived.invoke(command.payload);
        return;
      case 'SetMobileBetBarViewportMetrics':
        this.mobileBetBarViewportMetricsReceived.invoke(command.payload);
        return;
      case 'WinWindowOpened':
        this.winWindowOpened.invoke();
        return;
      case 'WinWindowClosed':
        this.winWindowClosed.invoke();
        return;
      case 'TransitionScreenOpenStarted':
        this.transitionScreenOpenStarted.invoke();
        return;
      case 'TransitionScreenOpenFinished':
        this.transitionScreenOpenFinished.invoke();
        return;
      case 'TransitionScreenCloseStarted':
        this.transitionScreenCloseStarted.invoke();
        return;
      case 'TransitionScreenCloseFinished':
        this.transitionScreenCloseFinished.invoke();
        return;
      // SetAssetsBasePath — наследие Unity Addressables: Phaser-хост шлёт сюда
      // пустую строку, ассеты бандл резолвит сам.
      case 'SetAssetsBasePath':
        return;
      case 'SyncUiVisibility':
        this.syncUiVisibility();
        return;
      default:
        this.handleGameCommand(command);
    }
  }

  /** Игровые команды. Наследник обязан разобрать свой союз `*Command`. */
  protected abstract handleGameCommand(command: Exclude<EngineCommand, CoreCommand>): void;

  /**
   * Публикация текущей видимости игрового UI по запросу React. Наследник шлёт
   * событие `UiVisibility` с актуальным состоянием сцены.
   */
  protected abstract syncUiVisibility(): void;

  /**
   * Стартовая синхронизация: спрашиваем config/state, пока React не ответит.
   * Зовётся наследником, когда сцена готова принимать данные — аналог
   * `BeginInitialWebSyncAfterSceneLoad`.
   */
  protected beginInitialSync(): void {
    this.stopInitialSync();

    if (isMockEnabled()) return;

    this.initialSyncAttempts = 0;
    const tick = (): void => {
      if (this.hasReceivedInitialConfig || this.initialSyncAttempts >= INITIAL_SYNC_ATTEMPTS) {
        this.stopInitialSync();
        return;
      }

      this.initialSyncAttempts += 1;
      this.requestGameConfig();
      this.requestGameState();
    };

    tick();
    this.initialSyncTimerId = window.setInterval(tick, INITIAL_SYNC_RETRY_INTERVAL_MS);
  }

  /** Спросить white-label у React; он ответит командой ApplyWhiteLabel. */
  public requestWhiteLabel(): void {
    this.transport.send({ type: 'RequestWhiteLabel' });
  }

  /**
   * Спросить статус fast game. React пушит значение и сам на старте, так что
   * это для кода, поднявшегося позже и пропустившего пуш.
   */
  public requestFastGame(): void {
    this.transport.send({ type: 'RequestFastGame' });
  }

  /**
   * Игра сама переключила fast game (например, погасила его на бонусе) —
   * React отзеркалит значение в тумблер бет-бара. Молчит, если ничего не изменилось.
   */
  public notifyFastGameChanged(isEnabled: boolean): void {
    if (!this.applyFastGame(isEnabled)) return;

    this.transport.send({ type: 'FastGameChanged', payload: isEnabled });
  }

  public dispose(): void {
    this.stopInitialSync();
  }

  private applyWhiteLabel(isWhiteLabel: boolean): void {
    this.currentIsWhiteLabel = isWhiteLabel;
    BridgeLogger.log(`[WebBridge] ApplyWhiteLabel: ${isWhiteLabel}`);
    this.whiteLabelReceived.invoke(isWhiteLabel);
  }

  /** true, если значение реально сменилось — чтобы не эхо-слать его обратно отправителю. */
  private applyFastGame(isEnabled: boolean): boolean {
    if (this.isFastGameEnabled === isEnabled) return false;

    this.isFastGameEnabled = isEnabled;
    BridgeLogger.log(`[WebBridge] FastGame: ${isEnabled}`);
    this.fastGameChanged.invoke(isEnabled);
    return true;
  }

  private stopInitialSync(): void {
    if (this.initialSyncTimerId === null) return;

    window.clearInterval(this.initialSyncTimerId);
    this.initialSyncTimerId = null;
  }
}
