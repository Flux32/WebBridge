/**
 * Мост Mine Slot. Хост присылает ответ сервера на play целиком (`ApplySpinResult`):
 * базовый спин и, если выпал или куплен бонус, все фри-спины. Игра проигрывает
 * раунды по порядку — поле блоков между фри-спинами не обновляется — и в конце
 * ровно один раз зовёт `notifySpinReady()`: до этого хост держит бет-бар.
 */
import type { CoreCommand, EngineCommand, MineSlotSpinResult } from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';

export class MineSlotBridge extends BridgeBase {
  public readonly spinResultReceived = new Signal<MineSlotSpinResult>();
  public readonly gameConfigReceived = new Signal<unknown>();
  public readonly gameStateReceived = new Signal<unknown>();

  public lastSpinResult: MineSlotSpinResult | null = null;
  public lastGameConfig: unknown = null;
  public lastGameState: unknown = null;

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
      case 'ApplySpinResult': {
        // Форму ответа держит сервер платформы; игра читает числа и строки денег сама.
        const spin = JSON.parse(command.payload) as MineSlotSpinResult;
        this.lastSpinResult = spin;
        this.spinResultReceived.invoke(spin);
        return;
      }
      // Общая синхронизация хоста шлёт и лесенку road; слоту в ней нечего брать.
      case 'UpdateCoeffs':
        return;
      default:
        BridgeLogger.warn(`[MineSlotBridge] ${command.type} does not belong to mine-slot`);
    }
  }

  // ───────────────────────────── Игра → React ─────────────────────────────

  /** Все раунды ответа доиграны: хост раскрывает выигрыш и разблокирует бет-бар. */
  public notifySpinReady(): void {
    this.transport.send({ type: 'SpinReady' });
  }
}
