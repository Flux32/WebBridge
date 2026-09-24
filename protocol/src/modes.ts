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

export interface ModeProtocols {
  readonly crush: ModeChannel<CrushCommand, CrushEvent>;
  // Twist runs the same server-driven round/bonus lifecycle as crush on the
  // wire, so it reuses CrushEvent as-is instead of repeating its members.
  readonly twist: ModeChannel<TwistCommandChannel, CrushEvent>;
  readonly slot: ModeChannel<SpinCommand, RoundEvent>;
  readonly wheel: ModeChannel<WheelCommand, WheelEvent>;
  readonly plinko: ModeChannel<
    Extract<PlinkoCommand, { type: 'ApplyDropResult' }>,
    Extract<PlinkoEvent, { type: 'DropFinished' }>
  >;
  readonly plinkoAztec: ModeChannel<PlinkoAztecCommand, PlinkoEvent>;
}

export type ModeProtocolId = keyof ModeProtocols;
