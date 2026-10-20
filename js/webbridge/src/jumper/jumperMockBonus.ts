/**
 * A bought jumper bonus as the dev backend settles it: the whole series at once,
 * each free game a route of jumps from step 0 to its final step.
 */
import type {
  JumperBonusGame,
  JumperLadder,
  JumperRoutePoint,
  JumperStartBonusPayload,
} from '@omega/webbridge-protocol';
import { acceleratorDistance, coefficientAt, lastStepOf } from './jumperMockLadders';
import { multiplyAmount, sumDecimals } from './jumperMockMoney';
import type { JumperMockHostOptions } from './jumperMockOptions';
import { drawCount, drawWeighted } from './jumperMockRandom';

type BonusOptions = Pick<
  JumperMockHostOptions,
  'loseChance' | 'slotWeights' | 'bonusGameCount' | 'betAmount' | 'currency' | 'decimalPlaces' | 'random'
>;

/**
 * The action of the jump from `step`. An accelerator that would throw the player
 * past the top is played as a plain jump, so every route keeps
 * `next = step + distance`.
 */
const drawAction = (ladder: JumperLadder, step: number, options: BonusOptions): JumperRoutePoint['action'] => {
  const content = drawWeighted(options.slotWeights, options.random);
  if (content === 'NONE') return 'STEP';

  return step + acceleratorDistance(ladder, content) <= lastStepOf(ladder) ? content : 'STEP';
};

const advance = (ladder: JumperLadder, point: JumperRoutePoint): number =>
  point.step + (point.action === 'STEP' ? 1 : acceleratorDistance(ladder, point.action));

/**
 * One free game: jumps from step 0 until the player falls or reaches the top.
 * The route lists the platforms jumped from, as the server's `bonusRoutes` do:
 * the last jump lands on the final step, which has no point of its own.
 */
const playFreeGame = (ladder: JumperLadder, options: BonusOptions): JumperBonusGame => {
  const route: JumperRoutePoint[] = [];
  let step = 0;
  do {
    const point: JumperRoutePoint = { step, action: drawAction(ladder, step, options) };
    route.push(point);
    step = advance(ladder, point);
  } while (step < lastStepOf(ladder) && options.random() >= options.loseChance);

  return { finalStep: step, coefficient: coefficientAt(ladder, step), route };
};

export const settleJumperBonus = (ladder: JumperLadder, options: BonusOptions): JumperStartBonusPayload => {
  const gameCount = drawCount(options.bonusGameCount, options.random);
  const games = Array.from({ length: gameCount }, () => playFreeGame(ladder, options));
  const totalCoefficient = sumDecimals(games.map((game) => game.coefficient));

  return {
    difficulty: ladder.difficulty,
    betAmount: options.betAmount,
    currency: options.currency,
    games,
    totalCoefficient,
    totalWin: multiplyAmount(options.betAmount, totalCoefficient, options.decimalPlaces),
  };
};
