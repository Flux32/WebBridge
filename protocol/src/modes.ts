/**
 * Per-mode channels: what the host sends a mode's game bridge beyond the core
 * command set, and what that bridge sends back beyond the core event set.
 * `CoreCommand`/`CoreEvent` are not repeated here — a mode's port adds them
 * on top (`CoreCommand | ModeProtocols[id]['commands']`).
 */
import type { CrushCommand, PlinkoCommand, SpinCommand, TwistCommand, WheelCommand } from './commands';
import type { CrushEvent, PlinkoEvent, RoundEvent, WheelEvent } from './events';

export interface ModeChannel<TCommand extends { type: string }, TEvent extends { type: string }> {
  readonly commands: TCommand;
  readonly events: TEvent;
}

/**
 * Autoplay/restart/bonus-start commands twist shares with crush's round
 * flow: the host sends the same three regardless of which of the two runs.
 */
type TwistRoundCommand = Extract<CrushCommand, { type: 'RestartRound' | 'SetAutoplay' | 'StartBonus' }>;

type TwistCommandChannel =
  | SpinCommand
  | TwistRoundCommand
  | Extract<TwistCommand, { type: 'FreeGamesIntroFinished' }>;

type PlinkoAztecCommand =
  | Extract<PlinkoCommand, { type: 'SetBallsAmount' | 'ApplyDropResult' }>
  | Extract<TwistCommand, { type: 'ApplyBonusStepResult' }>;

/**
 * Twist shares crush's round-ready signal and its three bonus lifecycle
 * events (TwistReact's bridge emits them: SlotScene.ts / bridgeEntry.ts),
 * but never BonusProgressClear, BonusCleared or BonusPurchaseRequest — the
 * host drives twist's bonus purchase itself via StartBonus, not an engine
 * event, and clears twist's bonus progress without a dedicated signal.
 */
type TwistEventChannel = RoundEvent | Extract<CrushEvent, { type: 'BonusActive' | 'BonusProgressSave' | 'BonusEnded' }>;

export interface ModeProtocols {
  readonly crush: ModeChannel<CrushCommand, CrushEvent>;
  readonly twist: ModeChannel<TwistCommandChannel, TwistEventChannel>;
  readonly slot: ModeChannel<SpinCommand, RoundEvent>;
  readonly wheel: ModeChannel<WheelCommand, WheelEvent>;
  readonly plinko: ModeChannel<
    Extract<PlinkoCommand, { type: 'ApplyDropResult' }>,
    Extract<PlinkoEvent, { type: 'DropFinished' }>
  >;
  readonly plinkoAztec: ModeChannel<PlinkoAztecCommand, PlinkoEvent>;
}

export type ModeProtocolId = keyof ModeProtocols;
