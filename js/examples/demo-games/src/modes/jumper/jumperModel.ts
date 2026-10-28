/** The jumper round in the engine's own terms: steps and coefficients as numbers, read once at the edge. */
import type { JumperAccelerator, JumperDifficulty, JumperRoundStatus, JumperSlotState } from '@omega/webbridge-protocol';

export interface JumperSlotView {
  readonly step: number;
  readonly state: JumperSlotState;
}

export interface JumperRound {
  readonly status: JumperRoundStatus;
  readonly difficulty: JumperDifficulty;
  readonly coefficient: number;
  readonly winAmount: string;
  readonly slots: readonly JumperSlotView[];
  readonly lineNumber: number;
  readonly landingStep: number;
  readonly visitedSteps: readonly { readonly step: number; readonly accelerator: JumperAccelerator }[];
  readonly collisionStep: number | null;
}

export interface JumperFreeGame {
  readonly finalStep: number;
  readonly coefficient: number;
  readonly route: readonly { readonly step: number; readonly action: 'STEP' | JumperAccelerator }[];
}

export interface JumperBonus {
  readonly difficulty: JumperDifficulty;
  readonly totalCoefficient: number;
  readonly totalWin: string;
  readonly currency: string;
  readonly games: readonly JumperFreeGame[];
}
