/**
 * A bought bonus, played as the protocol asks: `BonusActive`, every free game's route with its progress
 * saved once it has played out, then `BonusEnded`. Jumper's engine sends no `BonusProgressClear` /
 * `BonusCleared`: the host closes the series itself (RoadFrontent ADR-0008 §8).
 */
import type { JumperBridge } from '@omega/webbridge-js';
import type { JumperBonus } from './jumperModel';
import { freeGameWaypoints } from './jumperRoute';
import type { JumperScene } from './jumperScene';

export type JumpPace = 'round' | 'bonus';

export interface JumperMotions {
  /** Puts the player on a step at once: a round opened or restored. */
  place(step: number): void;
  jump(waypoints: readonly number[], pace: JumpPace): Promise<boolean>;
  fall(): Promise<boolean>;
  rewind(): Promise<boolean>;
  /** The beat between two free games. */
  pause(): Promise<boolean>;
  celebrate(): void;
}

export interface BonusContext {
  readonly bridge: JumperBridge;
  readonly motions: JumperMotions;
  readonly scene: JumperScene;
}

/** Resolves `false` when the series was cut short (the game was destroyed): nothing more is reported. */
export const playJumperBonus = async ({ bridge, motions, scene }: BonusContext, bonus: JumperBonus): Promise<boolean> => {
  bridge.notifyBonusActive();
  const totalIterations = bonus.games.length;
  for (const [index, game] of bonus.games.entries()) {
    if (index > 0 && !(await motions.rewind())) return false;
    scene.showFreeGame(bonus, index);
    if (!(await motions.jump(freeGameWaypoints(game), 'bonus'))) return false;
    scene.coefficient = game.coefficient;
    motions.celebrate();
    bridge.saveBonusProgress({ completedIterations: index + 1, totalIterations });
    if (!(await motions.pause())) return false;
  }
  if (!(await motions.rewind())) return false;
  scene.reset(`Bonus x${bonus.totalCoefficient} · ${bonus.totalWin} ${bonus.currency}`);
  scene.coefficient = bonus.totalCoefficient;
  bridge.notifyBonusEnded();
  return true;
};
