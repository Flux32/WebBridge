/**
 * A bought bonus, played by the engine as the protocol asks: `BonusActive`, every free game's
 * route with its progress saved after it, then `BonusEnded`.
 */
import type { JumperBridge } from '@omega/webbridge-js';
import type { JumperStartBonusPayload } from '@omega/webbridge-protocol';
import { freeGameWaypoints, START_STEP } from '../scene/routes';
import type { StubStage } from './StubStage';
import { FREE_GAME_HOLD_MS, FREE_GAME_MS } from './timings';

/** Resolves `false` when the series was cut short (the game was destroyed). */
export const playBonusSeries = async (
  bridge: JumperBridge,
  stage: StubStage,
  bonus: JumperStartBonusPayload,
): Promise<boolean> => {
  bridge.notifyBonusActive();
  const totalIterations = bonus.games.length;
  for (const [index, game] of bonus.games.entries()) {
    stage.scene.showFreeGame(bonus, game, index);
    stage.place(START_STEP);
    if (!(await stage.jump(freeGameWaypoints(game), FREE_GAME_MS))) return false;

    stage.scene.coeff = game.coefficient;
    bridge.saveBonusProgress({ completedIterations: index + 1, totalIterations });
    if (!(await stage.hold(FREE_GAME_HOLD_MS))) return false;
  }

  stage.scene.reset(`Bonus x${bonus.totalCoefficient} = ${bonus.totalWin} ${bonus.currency}`);
  stage.scene.coeff = bonus.totalCoefficient;
  stage.place(START_STEP);
  bridge.notifyBonusEnded();
  return true;
};
