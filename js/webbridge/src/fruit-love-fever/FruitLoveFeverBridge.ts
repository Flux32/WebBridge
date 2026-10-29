/**
 * The Fruit Love Fever bridge. The host forwards the server's play reply (`ApplySpinResult`); the game plays
 * the base spin. A reply with `isFinished: false` starts a bonus game: the game plays its intro, then asks
 * for each free spin with `requestStep()` and plays the host's answer (`ApplyBonusStepResult`), until it has
 * played a reply with `isFinished: true`. Only then — once per round — does it call `notifySpinReady()`:
 * until that the host keeps the bet bar locked and the win parked.
 *
 * `ApplyGameState` with `isFinished: false` is a bonus in progress after a reload: the game shows that board
 * and continues with `requestStep()`. One that arrives while the game waits for a step (a reconnect) means
 * the request may be lost: the game asks again.
 */
import type {
  CoreCommand,
  EngineCommand,
  FruitLoveFeverGameState,
  FruitLoveFeverSpinResult,
  FruitLoveFeverStepResult,
} from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';

export class FruitLoveFeverBridge extends BridgeBase {
  public readonly spinResultReceived = new Signal<FruitLoveFeverSpinResult>();
  public readonly stepResultReceived = new Signal<FruitLoveFeverStepResult>();
  public readonly gameConfigReceived = new Signal<unknown>();
  public readonly gameStateReceived = new Signal<FruitLoveFeverGameState>();

  public lastSpinResult: FruitLoveFeverSpinResult | null = null;
  public lastStepResult: FruitLoveFeverStepResult | null = null;
  public lastGameConfig: unknown = null;
  public lastGameState: FruitLoveFeverGameState | null = null;

  public constructor(transport: BridgeTransport) {
    super(transport);
  }

  /** Called by the game once the scene takes data. */
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
    // The platform server owns the shape; the game reads every field it draws by itself.
    const state = JSON.parse(payload) as FruitLoveFeverGameState;
    this.lastGameState = state;
    this.gameStateReceived.invoke(state);
  }

  protected override handleGameCommand(command: Exclude<EngineCommand, CoreCommand>): void {
    switch (command.type) {
      case 'ApplySpinResult': {
        // The platform server owns the shape; the game reads every field it draws by itself.
        const spin = JSON.parse(command.payload) as FruitLoveFeverSpinResult;
        this.lastSpinResult = spin;
        this.spinResultReceived.invoke(spin);
        return;
      }
      case 'ApplyBonusStepResult': {
        const step = JSON.parse(command.payload) as FruitLoveFeverStepResult;
        this.lastStepResult = step;
        this.stepResultReceived.invoke(step);
        return;
      }
      // The host's common sync also sends road's ladder; a slot has nothing to take from it.
      case 'UpdateCoeffs':
        return;
      default:
        BridgeLogger.warn(`[FruitLoveFeverBridge] ${command.type} does not belong to fruit-love-fever`);
    }
  }

  // ───────────────────────────── Game → React ─────────────────────────────

  /** The next free spin of the bonus game: the host answers with `ApplyBonusStepResult`. */
  public requestStep(): void {
    this.transport.send({ type: 'RequestStep' });
  }

  /**
   * The round is played out: the host reveals the win and unlocks the bet bar. Once per round — after the
   * base spin without a bonus, else after the last free spin.
   */
  public notifySpinReady(): void {
    this.transport.send({ type: 'SpinReady' });
  }
}
