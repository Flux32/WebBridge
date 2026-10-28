/**
 * A bought series of free spins as the game plays it: the host hands the whole series over in one
 * `StartBonus`, and the game spins it at its own pace. The first spin waits for the host's intro; each spin
 * reports its count (`BonusProgressSave` — the host's «Free games left»), never a `SpinReady`.
 */
import type { TwistBridge } from '@omega/webbridge-js';
import type { IntroLatch } from './IntroLatch';
import type { TwistSpin } from './twistSpin';
import type { TwistProgress } from './twistTable';

export interface SeriesCount {
  completed: number;
  readonly total: number;
}

export interface SeriesStage {
  readonly bridge: TwistBridge;
  readonly intro: IntroLatch;
  spin(spin: TwistSpin): Promise<boolean>;
  show(progress: TwistProgress): Promise<boolean>;
  pause(): Promise<boolean>;
}

const saveProgress = (bridge: TwistBridge, { completed, total }: SeriesCount): void =>
  bridge.saveBonusProgress({ completedIterations: completed, totalIterations: total });

/** Resolves `false` once a motion was cut short: the game is gone and nothing more goes out. */
export const playFreeSpins = async (rounds: readonly TwistSpin[], count: SeriesCount, stage: SeriesStage): Promise<boolean> => {
  stage.bridge.notifyBonusActive();
  saveProgress(stage.bridge, count);
  if (!(await stage.intro.wait())) return false;
  stage.intro.rearm();
  for (const [index, round] of rounds.entries()) {
    if (index > 0 && !(await stage.pause())) return false;
    if (!(await stage.spin(round))) return false;
    if (!(await stage.show(round.progress))) return false;
    count.completed = index + 1;
    saveProgress(stage.bridge, count);
  }
  stage.bridge.notifyBonusEnded();
  return true;
};
