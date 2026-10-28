/**
 * Мост режима slot-coin. Разбирает команды React в сигналы, на которые
 * подписываются сцены, и отдаёт наружу методы уведомлений. Ни одной игровой
 * сущности здесь не импортируется: зависимость идёт от игры к мосту.
 *
 * Раунд slot-coin приходит целиком одним `ApplySpinResult` — включая бонусные
 * доски. Игра проигрывает их по порядку и в конце обязана позвать
 * `notifySpinReady()`: пока это событие не придёт, React держит бет-бар
 * заблокированным.
 */
import type {
  CoreCommand,
  EngineCommand,
  SlotCoinSpinResult,
} from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';

export class SlotCoinBridge extends BridgeBase {
  public readonly spinResultReceived = new Signal<SlotCoinSpinResult>();
  public readonly gameConfigReceived = new Signal<unknown>();
  public readonly gameStateReceived = new Signal<unknown>();

  public lastSpinResult: SlotCoinSpinResult | null = null;
  public lastGameConfig: unknown = null;
  public lastGameState: unknown = null;

  public constructor(transport: BridgeTransport) {
    super(transport);
  }

  /**
   * Зовётся игрой, когда сцена готова принимать данные.
   *
   * Режиму slot-coin восстанавливать между спинами нечего — барабан не хранит состояние, и
   * `slotCoinSession.restoreCommands` во фронтенде пуст, — поэтому стартовая
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
        const result = JSON.parse(command.payload) as SlotCoinSpinResult;
        this.lastSpinResult = result;
        this.spinResultReceived.invoke(result);
        return;
      }
      default:
        BridgeLogger.warn(`[SlotCoinBridge] ${command.type} не относится к slot-coin`);
    }
  }

  // ───────────────────────────── Игра → React ─────────────────────────────

  /**
   * Раунд доигран — бет-бар можно разблокировать. Звать ровно один раз на
   * `ApplySpinResult`, после последней доски: раньше — игрок увидит кнопку
   * посреди раунда, позже (или никогда) — она останется заблокированной.
   */
  public notifySpinReady(): void {
    this.transport.send({ type: 'SpinReady' });
  }
}
