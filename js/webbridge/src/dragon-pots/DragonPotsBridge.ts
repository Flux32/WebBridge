/**
 * The Dragon Pots bridge. The round is atomic: the host forwards the server's play reply (`ApplySpinResult`)
 * and it carries everything — the base spin, the coins into the pots, the jackpot pick and the Hold & Win,
 * whichever the pots triggered or the player bought. The game plays them in that order and then, once per
 * round, calls `notifySpinReady()`: until then the host keeps the bet bar locked and the win parked.
 *
 * There are no steps and nothing to resume: `get-game-state` is always `{}`, so `ApplyGameState` carries
 * `{}` and a reload starts from an idle board.
 */
import type { CoreCommand, DragonPotsGameState, DragonPotsSpinResult, EngineCommand } from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';

export class DragonPotsBridge extends BridgeBase {
  public readonly spinResultReceived = new Signal<DragonPotsSpinResult>();
  public readonly gameConfigReceived = new Signal<unknown>();
  public readonly gameStateReceived = new Signal<DragonPotsGameState>();

  public lastSpinResult: DragonPotsSpinResult | null = null;
  public lastGameConfig: unknown = null;
  public lastGameState: DragonPotsGameState | null = null;

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
    const state = JSON.parse(payload) as DragonPotsGameState;
    this.lastGameState = state;
    this.gameStateReceived.invoke(state);
  }

  protected override handleGameCommand(command: Exclude<EngineCommand, CoreCommand>): void {
    switch (command.type) {
      case 'ApplySpinResult': {
        // The platform server owns the shape; the game reads every field it draws by itself.
        const spin = JSON.parse(command.payload) as DragonPotsSpinResult;
        this.lastSpinResult = spin;
        this.spinResultReceived.invoke(spin);
        return;
      }
      // The host's common sync also sends road's ladder; a slot has nothing to take from it.
      case 'UpdateCoeffs':
        return;
      default:
        BridgeLogger.warn(`[DragonPotsBridge] ${command.type} does not belong to dragon-pots`);
    }
  }

  // ───────────────────────────── Game → React ─────────────────────────────

  /**
   * The round is played out — base spin, pots, jackpot pick, Hold & Win and the total: the host reveals the
   * win and unlocks the bet bar. Exactly once per `ApplySpinResult`, a bought bonus included.
   */
  public notifySpinReady(): void {
    this.transport.send({ type: 'SpinReady' });
  }
}
