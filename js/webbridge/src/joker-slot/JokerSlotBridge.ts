/**
 * The Joker Slot bridge. The round is atomic: the host forwards the server's play reply (`ApplySpinResult`)
 * and it carries everything — the base board and, after landed jokers or a bought bonus, every bonus board.
 * The game plays `boards[i]` with `actions[i]` in order and then, once per round, calls `notifySpinReady()`:
 * until then the host keeps the bet bar locked and the win parked.
 *
 * There are no steps and nothing to resume: `get-game-state` is always `{ status: 'none' }`, and a reload
 * starts from an idle board.
 */
import type { CoreCommand, EngineCommand, JokerSlotGameState, JokerSlotSpinResult } from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';

export class JokerSlotBridge extends BridgeBase {
  public readonly spinResultReceived = new Signal<JokerSlotSpinResult>();
  public readonly gameConfigReceived = new Signal<unknown>();
  public readonly gameStateReceived = new Signal<JokerSlotGameState>();

  public lastSpinResult: JokerSlotSpinResult | null = null;
  public lastGameConfig: unknown = null;
  public lastGameState: JokerSlotGameState | null = null;

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
    const state = JSON.parse(payload) as JokerSlotGameState;
    this.lastGameState = state;
    this.gameStateReceived.invoke(state);
  }

  protected override handleGameCommand(command: Exclude<EngineCommand, CoreCommand>): void {
    switch (command.type) {
      case 'ApplySpinResult': {
        // The platform server owns the shape; the game reads every field it draws by itself.
        const spin = JSON.parse(command.payload) as JokerSlotSpinResult;
        this.lastSpinResult = spin;
        this.spinResultReceived.invoke(spin);
        return;
      }
      // The host's common sync also sends road's ladder; a slot has nothing to take from it.
      case 'UpdateCoeffs':
        return;
      default:
        BridgeLogger.warn(`[JokerSlotBridge] ${command.type} does not belong to joker-slot`);
    }
  }

  // ───────────────────────────── Game → React ─────────────────────────────

  /**
   * The round is played out — the base board and every bonus board: the host reveals the win and unlocks the
   * bet bar. Exactly once per `ApplySpinResult`, a bought bonus included.
   */
  public notifySpinReady(): void {
    this.transport.send({ type: 'SpinReady' });
  }
}
