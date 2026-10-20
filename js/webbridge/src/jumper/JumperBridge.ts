/**
 * Jumper bridge — mirror of the C# `JumperWebBridge`. The host owns the bet and
 * the server: it sends the ladders as the game config, every live move as
 * `ApplyJumperMove` and a bought bonus as `StartBonus`. The game plays a jump
 * and reports `notifySpinReady()` once the player has landed; on `RestartRound`
 * it resets the scene and reports `notifySpinReady()` as well. A move from the
 * scene itself goes through `requestPlay()` of the base.
 */
import type {
  CoreCommand,
  EngineCommand,
  JumperDifficulty,
  JumperGameConfigPayload,
  JumperMovePayload,
  JumperRoundState,
  JumperStartBonusPayload,
  StartBonusPayload,
} from '@omega/webbridge-protocol';
import { BridgeBase } from '../core/BridgeBase';
import { BridgeLogger } from '../core/BridgeLogger';
import type { BridgeTransport } from '../core/BridgeTransport';
import { Signal } from '../core/Signal';
import type { RestartRequest } from '../crush/CrushBridge';

/**
 * `StartBonus` carries a union of every mode's bonus with no tag; a jumper series
 * is the one with free-game routes.
 */
const isJumperBonus = (payload: StartBonusPayload): payload is JumperStartBonusPayload =>
  'games' in payload && 'totalCoefficient' in payload;

export class JumperBridge extends BridgeBase {
  public readonly gameConfigReceived = new Signal<JumperGameConfigPayload>();
  public readonly gameStateReceived = new Signal<JumperRoundState>();
  public readonly moveReceived = new Signal<JumperMovePayload>();
  public readonly difficultyChanged = new Signal<JumperDifficulty>();
  public readonly autoplayChanged = new Signal<boolean>();
  public readonly restartRequested = new Signal<RestartRequest>();
  public readonly bonusStartRequested = new Signal<JumperStartBonusPayload>();

  public lastGameConfig: JumperGameConfigPayload | null = null;
  /** The round as last described: the restored state or the latest move. */
  public lastGameState: JumperRoundState | null = null;
  public lastDifficulty: JumperDifficulty | null = null;

  public constructor(transport: BridgeTransport) {
    super(transport);
  }

  /** Called by the game once the scene can take data. */
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
    // The host builds this JSON from the protocol type; the bridge does not re-validate it.
    const config = JSON.parse(payload) as JumperGameConfigPayload;
    this.lastGameConfig = config;
    this.hasReceivedInitialConfig = true;
    this.gameConfigReceived.invoke(config);
  }

  protected override applyGameState(payload: string): void {
    // Same as the config: a protocol-typed JSON built by the host.
    const state = JSON.parse(payload) as JumperRoundState;
    this.lastGameState = state;
    this.gameStateReceived.invoke(state);
  }

  protected override handleGameCommand(command: Exclude<EngineCommand, CoreCommand>): void {
    switch (command.type) {
      case 'SetJumperDifficulty':
        this.lastDifficulty = command.payload;
        this.difficultyChanged.invoke(command.payload);
        return;
      case 'ApplyJumperMove':
        this.lastGameState = command.payload;
        this.moveReceived.invoke(command.payload);
        return;
      case 'SetAutoplay':
        this.autoplayChanged.invoke(command.payload);
        return;
      case 'RestartRound': {
        const [reason = '', amount = ''] = command.payload.split('|');
        this.restartRequested.invoke({ reason, amount });
        return;
      }
      case 'StartBonus':
        this.startBonus(command.payload);
        return;
      default:
        BridgeLogger.warn(`[JumperBridge] ${command.type} does not belong to jumper`);
    }
  }

  // ───────────────────────────── Game → React ─────────────────────────────

  /**
   * The jump is over (the player has landed or fallen), or the scene is reset
   * after `RestartRound`. The host unlocks the bet bar.
   */
  public notifySpinReady(): void {
    this.transport.send({ type: 'SpinReady' });
  }

  public notifyBonusActive(): void {
    this.transport.send({ type: 'BonusActive' });
  }

  public notifyBonusEnded(): void {
    this.transport.send({ type: 'BonusEnded' });
  }

  /** Bonus progress outlives a page reload: the host keeps it. */
  public saveBonusProgress(progress: unknown): void {
    this.transport.send({ type: 'BonusProgressSave', raw: JSON.stringify(progress) });
  }

  private startBonus(payload: StartBonusPayload): void {
    if (!isJumperBonus(payload)) {
      BridgeLogger.warn('[JumperBridge] StartBonus without free-game routes is not a jumper bonus');
      return;
    }

    this.bonusStartRequested.invoke(payload);
  }
}
