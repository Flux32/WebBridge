import { DragonPotsBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { DragonPotsController } from './DragonPotsController';
import { DragonPotsView } from './DragonPotsView';

/** Dragon Pots: a 243-ways slot whose coins fill three pots; the pots start a jackpot pick and a Hold & Win. */
export const dragonPotsMode: DemoMode<DragonPotsBridge> = {
  title: 'Dragon Pots',
  accent: PALETTE.vermilion,
  createBridge: (transport) => new DragonPotsBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: DragonPotsView = new DragonPotsView(stage, () => controller);
    const controller = new DragonPotsController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
