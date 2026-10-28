/**
 * Мост колеса. Раунд общий для всех игроков и идёт по расписанию сервера: хост шлёт
 * снимок раунда (`ApplyRound`) на каждое его изменение, в том числе повторами, а игра
 * крутит колесо и сообщает `notifyRoundShown()`, когда исход показан. Бет-баром колеса
 * правит статус раунда, а не игра, поэтому `SpinReady` здесь нет.
 */
import type {
  CoreCommand,
  EngineCommand,
  WheelBetBarMetricsPayload,
} from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';

export class WheelBridge extends BridgeBase {
  /** Снимок раунда как его прислал хост; форму (статус, ячейка, цвет) разбирает игра. */
  public readonly roundReceived = new Signal<unknown>();
  public readonly betBarMetricsReceived = new Signal<WheelBetBarMetricsPayload>();

  public lastRound: unknown = null;

  public constructor(transport: BridgeTransport) {
    super(transport);
  }

  public override requestGameConfig(): void {
    this.transport.send({ type: 'RequestGameConfig' });
  }

  public override requestGameState(): void {
    this.transport.send({ type: 'RequestGameState' });
  }

  /** Шлёт и общая синхронизация road; колесу в ней нечего брать. */
  protected override applyGameConfig(): void {}

  /** Колесо не восстанавливает раунд из состояния: текущий снимок приходит `ApplyRound`. */
  protected override applyGameState(): void {}

  protected override handleGameCommand(command: Exclude<EngineCommand, CoreCommand>): void {
    switch (command.type) {
      case 'ApplyRound': {
        const round: unknown = JSON.parse(command.payload);
        this.lastRound = round;
        this.roundReceived.invoke(round);
        return;
      }
      case 'SetWheelBetBarMetrics':
        this.betBarMetricsReceived.invoke(JSON.parse(command.payload) as WheelBetBarMetricsPayload);
        return;
      case 'UpdateCoeffs':
        return;
      default:
        BridgeLogger.warn(`[WheelBridge] ${command.type} does not belong to the wheel`);
    }
  }

  // ───────────────────────────── Игра → React ─────────────────────────────

  /** Исход показан игроку: хост раскрывает выплату и открывает окно результата. */
  public notifyRoundShown(): void {
    this.transport.send({ type: 'RoundShown' });
  }
}
