/**
 * The platforms the player passes through, in order: what a jump motion plays. An accelerator throws the
 * player on from the step it stands on, so a chain is the aimed step, every accelerator, then the landing
 * (RoadFrontent `src/modes/jumper/PROTOCOL.md`).
 */
import { JUMPER_START_STEP } from '@omega/webbridge-protocol';
import type { JumperFreeGame, JumperRound, JumperSlotView } from './jumperModel';

/** Where the player stands before the round's first jump. */
export const START_STEP = JUMPER_START_STEP;

export type JumpPlan = Pick<JumperRound, 'status' | 'lineNumber' | 'landingStep' | 'visitedSteps' | 'collisionStep'>;

const withoutRepeats = (steps: readonly number[]): number[] =>
  steps.filter((step, index) => index === 0 || step !== steps[index - 1]);

/**
 * A lost jump ends where the player fell: `landingStep` of a lost round is where the chain aimed, not where
 * the player is, so the chain is cut at `collisionPosition`.
 */
export const jumpWaypoints = (jump: JumpPlan): number[] => {
  const chain = withoutRepeats([jump.lineNumber, ...jump.visitedSteps.map((visited) => visited.step), jump.landingStep]);
  const collision = jump.collisionStep;
  if (jump.status !== 'lose' || collision === null) return chain;
  return [...chain.filter((step) => step < collision), collision];
};

/** A free game from the start: every platform jumped from, then the final step. */
export const freeGameWaypoints = (game: JumperFreeGame): number[] =>
  withoutRepeats([...game.route.map((point) => point.step), game.finalStep]);

/** The accelerators a free game went through, shown as revealed slots. */
export const freeGameSlots = (game: JumperFreeGame): JumperSlotView[] =>
  game.route.flatMap((point) => (point.action === 'STEP' ? [] : [{ step: point.step, state: point.action }]));
