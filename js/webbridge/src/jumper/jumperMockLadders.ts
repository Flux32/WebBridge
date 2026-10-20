/**
 * The dev backend's jumper ladders (RoadFrontent `src/modes/jumper/PROTOCOL.md`),
 * already in the protocol's `JumperLadder` shape.
 */
import type {
  JumperAccelerator,
  JumperAcceleratorDistance,
  JumperDifficulty,
  JumperLadder,
} from '@omega/webbridge-protocol';

const BONUS_BUY_MULTIPLIER = 100;

const ACCELERATOR_DISTANCES: JumperAcceleratorDistance[] = [
  { accelerator: 'TRAMPOLINE', steps: 2 },
  { accelerator: 'JETPACK', steps: 4 },
  { accelerator: 'ROCKET', steps: 8 },
];

const COEFFICIENTS: Record<JumperDifficulty, string> = {
  EASY:
    '1.01,1.04,1.09,1.15,1.21,1.28,1.36,1.45,1.55,1.66,1.78,1.93,2.08,2.26,2.47,2.70,2.96,3.25,3.59,3.98,' +
    '4.42,4.93,5.51,6.19,6.97,7.87,8.93,10.16,11.60,13.29,15.27,17.61,20.39,23.68,27.60,32.28,37.89,44.63,' +
    '52.75,62.58',
  MEDIUM:
    '1.02,1.09,1.18,1.29,1.42,1.58,1.77,2.00,2.29,2.64,3.07,3.60,4.27,5.11,6.17,7.52,9.27,11.53,14.48,18.38,' +
    '23.56,30.52,39.95,52.85,70.66,95.48,130.44,180.17,251.64,355.42,507.75,733.74,1072.73,1586.88,2375.57,' +
    '3599.35,5520.48,8572.18',
  HARD:
    '1.04,1.14,1.28,1.45,1.66,1.93,2.28,2.72,3.31,4.07,5.09,6.47,8.33,10.91,14.51,19.61,26.93,37.62,53.44,' +
    '77.23,113.57,170.02,259.18,402.45,636.79,1027.09,1689.29,2834.38,4853.40,8484.97,15151.73,27649.15,' +
    '51584.23,98443.20,192271.88',
};

const buildLadder = (difficulty: JumperDifficulty): JumperLadder => ({
  difficulty,
  coefficients: COEFFICIENTS[difficulty].split(','),
  accelerators: ACCELERATOR_DISTANCES,
  bonusBuyMultiplier: BONUS_BUY_MULTIPLIER,
});

export const DEV_BACKEND_JUMPER_LADDERS: readonly JumperLadder[] = [
  buildLadder('EASY'),
  buildLadder('MEDIUM'),
  buildLadder('HARD'),
];

/** The top step: reaching it closes the round as a win. */
export const lastStepOf = (ladder: JumperLadder): number => ladder.coefficients.length - 1;

export const coefficientAt = (ladder: JumperLadder, step: number): string => {
  const coefficient = ladder.coefficients[step];
  if (coefficient === undefined) {
    throw new RangeError(`Jumper ${ladder.difficulty} ladder has no step ${step}`);
  }
  return coefficient;
};

export const acceleratorDistance = (ladder: JumperLadder, accelerator: JumperAccelerator): number => {
  const distance = ladder.accelerators.find((entry) => entry.accelerator === accelerator);
  if (distance === undefined) {
    throw new RangeError(`Jumper ${ladder.difficulty} ladder has no ${accelerator} distance`);
  }
  return distance.steps;
};
