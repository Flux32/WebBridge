/**
 * Jumper: a ladder of platforms with accelerators that throw the player several
 * steps up. The host turns the game server's replies (RoadFrontent
 * `src/modes/jumper/PROTOCOL.md`) into the shapes below: arrays instead of the
 * server's step-keyed maps and named fields, so the Unity bridge reads them with
 * a plain JsonUtility class and the web bridge gets them as they are.
 *
 * Money and coefficients travel as decimal strings, as the server sends them.
 */

/** Difficulty levels by the backend's names; jumper has no DAREDEVIL. */
export const JUMPER_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

export type JumperDifficulty = (typeof JUMPER_DIFFICULTIES)[number];

export const JUMPER_ACCELERATORS = ['TRAMPOLINE', 'JETPACK', 'ROCKET'] as const;

export type JumperAccelerator = (typeof JUMPER_ACCELERATORS)[number];

/**
 * What an accelerator slot shows: `HIDDEN` until the player lands on it or flies
 * over it, then its accelerator, or `NONE` for an empty slot.
 */
export type JumperSlotState = 'HIDDEN' | 'NONE' | JumperAccelerator;

/**
 * Where the player stands before the first jump: below step 0. `lineNumber` and
 * `landingStep` hold it until the round's first step.
 */
export const JUMPER_START_STEP = -1;

/** How far an accelerator throws the player on one difficulty. */
export interface JumperAcceleratorDistance {
  accelerator: JumperAccelerator;
  steps: number;
}

/** One difficulty's ladder. */
export interface JumperLadder {
  difficulty: JumperDifficulty;
  /** The coefficient of each step, by its index. */
  coefficients: string[];
  accelerators: JumperAcceleratorDistance[];
  /** The bonus price in bets. */
  bonusBuyMultiplier: number;
}

/** JSON of `ApplyGameConfig` for jumper: every difficulty's ladder; `SetJumperDifficulty` picks one. */
export interface JumperGameConfigPayload {
  ladders: JumperLadder[];
}

export interface JumperSlot {
  step: number;
  state: JumperSlotState;
}

/** An accelerator the jump went through, in the order the player hit them. */
export interface JumperVisitedStep {
  step: number;
  accelerator: JumperAccelerator;
}

export type JumperRoundStatus = 'none' | 'in-game' | 'win' | 'lose';

/**
 * The round as the server last described it. JSON of `ApplyGameState` for
 * jumper; `status: 'none'` — no live round.
 */
export interface JumperRoundState {
  status: JumperRoundStatus;
  difficulty: JumperDifficulty;
  /** The coefficient of `landingStep`; "0" before the first jump and after a loss. */
  coeff: string;
  winAmount: string;
  /** Every accelerator slot of the round, known from its start. */
  slots: JumperSlot[];
  /** The step this jump aimed at; `JUMPER_START_STEP` before the first one. */
  lineNumber: number;
  /** Where the player stands after the accelerator chain; the next jump aims at `landingStep + 1`. */
  landingStep: number;
  visitedSteps: JumperVisitedStep[];
  /**
   * Only on a closed round: the step the player fell from, or after a cash out
   * the step where they would have fallen.
   */
  collisionPosition?: number;
}

/** The request the reply answered. */
export type JumperMove = 'play' | 'step' | 'payout';

/**
 * A live move's result (`ApplyJumperMove`). `SpinReady` answers jumps only:
 * - `play` opens the round (slots placed, player at the start) and gets no
 *   `SpinReady` — the host follows it with the first jump, `step` to step 0;
 * - `step` is a jump: the engine plays it, accelerator chain included, and sends
 *   `SpinReady` when the player has landed or fallen;
 * - `payout` closes the round: the engine shows it and waits for `RestartRound`.
 */
export interface JumperMovePayload extends JumperRoundState {
  move: JumperMove;
}

/** One step of a free game's route: a plain jump or an accelerator. */
export interface JumperRoutePoint {
  step: number;
  action: 'STEP' | JumperAccelerator;
}

export interface JumperBonusGame {
  /** The step the free game ends on. */
  finalStep: number;
  /** Its coefficient in bets: the ladder's coefficient of `finalStep`. */
  coefficient: string;
  route: JumperRoutePoint[];
}

/**
 * The bought bonus (`StartBonus` for jumper). The server settles the whole series
 * in one reply and pays it at once; the engine plays the free games itself and
 * reports progress with the bonus events.
 */
export interface JumperStartBonusPayload {
  difficulty: JumperDifficulty;
  /** The bet one free game is played for: the price paid divided by the bonus multiplier. */
  betAmount: string;
  currency: string;
  /** The bet in the display currency ("$0.05"), as the cash out shows it; empty — show `betAmount`. */
  displayBet?: string;
  games: JumperBonusGame[];
  /** The sum of the games' coefficients. */
  totalCoefficient: string;
  totalWin: string;
}
