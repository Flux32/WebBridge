/**
 * Мост режима Plinko — зеркало C#-шного `PlinkoWebBridge`. Ставкой владеет React:
 * он зовёт `play({ risk })`, получает готовый GameState и присылает его
 * `ApplyDropResult`. Игра только роняет шарик в `resultPosition` и сообщает, что
 * он сел, — `notifyDropFinished()`: до этого React держит бет-бар заблокированным.
 *
 * Конфиг и состояние — сырой JSON бэкенда (`coefficients` по риску, `coeff`,
 * `resultPosition`, `winAmount`); форму знает игра, мост её не трактует.
 */
import type { CoreCommand, EngineCommand } from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';

export class PlinkoBridge extends BridgeBase {
  public readonly gameConfigReceived = new Signal<unknown>();
  public readonly gameStateReceived = new Signal<unknown>();
  public readonly dropResultReceived = new Signal<unknown>();

  public lastGameConfig: unknown = null;
  public lastGameState: unknown = null;
  public lastDropResult: unknown = null;

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
      case 'ApplyDropResult': {
        const result: unknown = JSON.parse(command.payload);
        this.lastDropResult = result;
        this.lastGameState = result;
        this.dropResultReceived.invoke(result);
        return;
      }
      default:
        BridgeLogger.warn(`[PlinkoBridge] ${command.type} не относится к plinko`);
    }
  }

  // ───────────────────────────── Игра → React ─────────────────────────────

  /**
   * Шарик сел — бет-бар можно разблокировать. Звать ровно один раз на
   * `ApplyDropResult`, когда анимация доиграна: раньше — игрок увидит выигрыш до
   * того, как шарик долетел.
   */
  public notifyDropFinished(): void {
    this.transport.send({ type: 'DropFinished' });
  }
}
