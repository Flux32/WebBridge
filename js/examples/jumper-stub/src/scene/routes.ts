/**
 * The platforms the player passes through, in order — what the motion plays.
 */
import {
  JUMPER_START_STEP,
  type JumperBonusGame,
  type JumperMovePayload,
  type JumperRoundState,
  type JumperSlot,
} from '@omega/webbridge-protocol';

/** Where the player stands before the round's first jump. */
export const START_STEP = JUMPER_START_STEP;

const withoutRepeats = (steps: readonly number[]): number[] =>
  steps.filter((step, index) => index === 0 || step !== steps[index - 1]);

/** The step a closed round ended on; the protocol guarantees it on every closed round. */
export const collisionStepOf = (state: JumperRoundState): number => {
  if (state.collisionPosition === undefined) {
    throw new Error(`[jumper-stub] a ${state.status} round came without collisionPosition`);
  }
  return state.collisionPosition;
};

/** A jump: the aimed step, every accelerator of the chain, the landing and, on a loss, the fall. */
export const jumpWaypoints = (move: JumperMovePayload): number[] => {
  const chain = [move.lineNumber, ...move.visitedSteps.map((visited) => visited.step), move.landingStep];
  return withoutRepeats(move.status === 'lose' ? [...chain, collisionStepOf(move)] : chain);
};

/** A free game from the start: every platform jumped from, then the final step. */
export const freeGameWaypoints = (game: JumperBonusGame): number[] =>
  withoutRepeats([...game.route.map((point) => point.step), game.finalStep]);

/** The accelerators a free game went through, shown as revealed slots. */
export const freeGameSlots = (game: JumperBonusGame): JumperSlot[] =>
  game.route.flatMap((point) => (point.action === 'STEP' ? [] : [{ step: point.step, state: point.action }]));
