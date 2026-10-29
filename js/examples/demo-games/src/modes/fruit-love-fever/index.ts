import { FruitLoveFeverBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { FruitLoveFeverController } from './FruitLoveFeverController';
import { FruitLoveFeverView } from './FruitLoveFeverView';

/** Fruit Love Fever: a 5 × 3 line slot whose bonus plays free spin by free spin, wilds sticking to their cells. */
export const fruitLoveFeverMode: DemoMode<FruitLoveFeverBridge> = {
  title: 'Fruit Love Fever',
  accent: PALETTE.rose,
  createBridge: (transport) => new FruitLoveFeverBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: FruitLoveFeverView = new FruitLoveFeverView(stage, () => controller);
    const controller = new FruitLoveFeverController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
