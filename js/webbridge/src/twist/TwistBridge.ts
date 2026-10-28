/**
 * Мост механики Twist: спин тотемов живой сессии и купленная серия фри-спинов.
 * Игра проигрывает каждый спин и в конце зовёт `notifySpinReady()` — до этого хост
 * держит исход и бет-бар. Сервер шлёт сырой GameState, поэтому его форма (`outcome`,
 * `progress`, `sessionIsFinished`) здесь не разбирается — её знает игра.
 */
import type {
  CoreCommand,
  EngineCommand,
  StartBonusPayload,
  TwistStartBonusPayload,
} from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';
import type { RestartRequest } from '../crush/CrushBridge';

/** Купленная серия: спины уже разобраны из строк GameState. */
export interface TwistBonusSeries {
  readonly totalRounds: number;
  readonly spins: readonly unknown[];
}

/** `StartBonus` несёт бонусы всех режимов без метки: серию twist выдают её спины. */
const isTwistSeries = (payload: StartBonusPayload): payload is TwistStartBonusPayload =>
  'spins' in payload && Array.isArray(payload.spins);

export class TwistBridge extends BridgeBase {
  public readonly gameConfigReceived = new Signal<unknown>();
  public readonly gameStateReceived = new Signal<unknown>();
  public readonly spinResultReceived = new Signal<unknown>();
  public readonly restartRequested = new Signal<RestartRequest>();
  public readonly autoplayChanged = new Signal<boolean>();
  public readonly bonusStartRequested = new Signal<TwistBonusSeries>();
  /** Интро серии на стороне хоста доиграло: первый фри-спин можно крутить. */
  public readonly freeGamesIntroFinished = new Signal();

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
        const spin: unknown = JSON.parse(command.payload);
        this.lastGameState = spin;
        this.spinResultReceived.invoke(spin);
        return;
      }
      case 'RestartRound': {
        const [reason = '', amount = ''] = command.payload.split('|');
        this.restartRequested.invoke({ reason, amount });
        return;
      }
      case 'SetAutoplay':
        this.autoplayChanged.invoke(command.payload);
        return;
      case 'StartBonus':
        this.startBonus(command.payload);
        return;
      case 'FreeGamesIntroFinished':
        this.freeGamesIntroFinished.invoke();
        return;
      // The shared App sync also pushes a road ladder; twist's table is the game's own.
      case 'UpdateCoeffs':
        return;
      default:
        BridgeLogger.warn(`[TwistBridge] ${command.type} does not belong to twist`);
    }
  }

  // ───────────────────────────── Игра → React ─────────────────────────────

  /** Тотемы встали: хост раскрывает исход и разблокирует бет-бар. Во фри-спинах не зовётся. */
  public notifySpinReady(): void {
    this.transport.send({ type: 'SpinReady' });
  }

  public notifyBonusActive(): void {
    this.transport.send({ type: 'BonusActive' });
  }

  /** Конец серии обязателен: без него хост не закроет бонус. */
  public notifyBonusEnded(): void {
    this.transport.send({ type: 'BonusEnded' });
  }

  /** Прогресс серии хост хранит до перезагрузки страницы. */
  public saveBonusProgress(progress: { completedIterations: number; totalIterations: number }): void {
    this.transport.send({ type: 'BonusProgressSave', raw: JSON.stringify(progress) });
  }

  private startBonus(payload: StartBonusPayload): void {
    if (!isTwistSeries(payload)) {
      BridgeLogger.warn('[TwistBridge] StartBonus without spins is not a twist series');
      return;
    }
    const spins = payload.spins.map((spin): unknown => JSON.parse(spin));
    this.bonusStartRequested.invoke({ totalRounds: payload.totalRounds, spins });
  }
}
