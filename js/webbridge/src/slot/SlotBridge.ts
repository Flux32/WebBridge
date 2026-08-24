/**
 * Мост механики слота. Разбирает команды React в сигналы, на которые
 * подписываются сцены, и отдаёт наружу методы уведомлений. Ни одной игровой
 * сущности здесь не импортируется: зависимость идёт от игры к мосту.
 *
 * Раунд слота приходит целиком одним `ApplySpinResult` — включая бонусные
 * доски. Игра проигрывает их по порядку и в конце обязана позвать
 * `notifySpinReady()`: пока это событие не придёт, React держит бет-бар
 * заблокированным.
 */
import type {
  CoreCommand,
  EngineCommand,
  SlotSpinResult,
  UiVisibilityPayload,
} from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';

export class SlotBridge extends BridgeBase {
  public readonly spinResultReceived = new Signal<SlotSpinResult>();
  public readonly gameConfigReceived = new Signal<unknown>();
  public readonly gameStateReceived = new Signal<unknown>();

  public lastSpinResult: SlotSpinResult | null = null;
  public lastGameConfig: unknown = null;
  public lastGameState: unknown = null;

  private uiVisibility: UiVisibilityPayload = {};

  public constructor(transport: BridgeTransport) {
    super(transport);
  }

  /**
   * Зовётся игрой, когда сцена готова принимать данные.
   *
   * Слоту восстанавливать между спинами нечего — барабан не хранит состояние, и
   * `slotSession.restoreCommands` во фронтенде пуст, — поэтому стартовая
   * синхронизация нужна только тем сценам, которым реально нужен конфиг.
   * Игра решает это сама, вызывая `start()` или обходясь без него.
   */
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
      case 'ApplySpinResult': {
        const result = JSON.parse(command.payload) as SlotSpinResult;
        this.lastSpinResult = result;
        this.spinResultReceived.invoke(result);
        return;
      }
      default:
        BridgeLogger.warn(`[SlotBridge] ${command.type} не относится к слоту`);
    }
  }

  // ───────────────────────────── Игра → React ─────────────────────────────

  public playSound(key: string, volume?: number): void {
    this.transport.send({ type: 'PlaySound', key, ...(volume === undefined ? {} : { volume }) });
  }

  public playMusic(key: string, volume?: number): void {
    this.transport.send({ type: 'PlayMusic', key, ...(volume === undefined ? {} : { volume }) });
  }

  /** Игра просит React перерисовать свой UI под новое состояние сцены. */
  public setUiVisibility(patch: UiVisibilityPayload): void {
    this.uiVisibility = { ...this.uiVisibility, ...patch };
    this.syncUiVisibility();
  }

  protected override syncUiVisibility(): void {
    this.transport.send({ type: 'UiVisibility', payload: this.uiVisibility });
  }

  /**
   * Раунд доигран — бет-бар можно разблокировать. Звать ровно один раз на
   * `ApplySpinResult`, после последней доски: раньше — игрок увидит кнопку
   * посреди раунда, позже (или никогда) — она останется заблокированной.
   */
  public notifySpinReady(): void {
    this.transport.send({ type: 'SpinReady' });
  }
}
