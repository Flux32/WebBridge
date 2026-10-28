/**
 * Per-mode channels: what the host sends a mode's game bridge beyond the core
 * command set, and what that bridge sends back beyond the core event set.
 * `CoreCommand`/`CoreEvent` are not repeated here — a mode's port adds them
 * on top (`CoreCommand | ModeProtocols[id]['commands']`).
 */
import type {
  CrushCommand,
  JumperCommand,
  PlinkoCommand,
  SpinCommand,
  TwistCommand,
  WheelCommand,
} from './commands.js';
import type { CrushEvent, PlinkoEvent, RoundEvent, WheelEvent } from './events.js';

export interface ModeChannel<TCommand extends { type: string }, TEvent extends { type: string }> {
  readonly commands: TCommand;
  readonly events: TEvent;
}

/**
 * Autoplay/restart/bonus-start commands twist and jumper share with crush's
 * round flow: the host sends the same three regardless of which mode runs.
 */
type SharedRoundCommand = Extract<CrushCommand, { type: 'RestartRound' | 'SetAutoplay' | 'StartBonus' }>;

type TwistCommandChannel =
  | SpinCommand
  | SharedRoundCommand
  | Extract<TwistCommand, { type: 'FreeGamesIntroFinished' }>;

type PlinkoAztecCommand = Extract<
  PlinkoCommand,
  { type: 'SetBallsAmount' | 'SetBetPerBall' | 'ApplyDropResult' | 'ApplyBonusStepResult' }
>;

/**
 * A bonus bought on the host's bar and settled by the server in one reply:
 * the engine plays the series and reports crush's three lifecycle events, but
 * never BonusProgressClear, BonusCleared or BonusPurchaseRequest — the host
 * drives the purchase itself via StartBonus, not an engine event, and clears
 * the progress without a dedicated signal. Twist's bridge (TwistReact:
 * SlotScene.ts / bridgeEntry.ts) and jumper's emit exactly these.
 */
type SeriesBonusEventChannel =
  | RoundEvent
  | Extract<CrushEvent, { type: 'BonusActive' | 'BonusProgressSave' | 'BonusEnded' }>;

export interface ModeProtocols {
  readonly crush: ModeChannel<CrushCommand, CrushEvent>;
  readonly twist: ModeChannel<TwistCommandChannel, SeriesBonusEventChannel>;
  readonly slotCoin: ModeChannel<SpinCommand, RoundEvent>;
  /** @deprecated Используйте `slotCoin`: режим переименован в 1.17.0, канал тот же. */
  readonly slot: ModeProtocols['slotCoin'];
  readonly wheel: ModeChannel<WheelCommand, WheelEvent>;
  readonly plinko: ModeChannel<
    Extract<PlinkoCommand, { type: 'ApplyDropResult' }>,
    Extract<PlinkoEvent, { type: 'DropFinished' }>
  >;
  readonly plinkoAztec: ModeChannel<PlinkoAztecCommand, PlinkoEvent>;
  readonly jumper: ModeChannel<JumperCommand | SharedRoundCommand, SeriesBonusEventChannel>;
  /** One spin reply plays the whole round, free spins included, and is answered with one SpinReady. */
  readonly mineSlot: ModeChannel<SpinCommand, RoundEvent>;
}

export type ModeProtocolId = keyof ModeProtocols;
