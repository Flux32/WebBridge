import { PlinkoBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { PlinkoController } from './PlinkoController';
import { PlinkoView } from './PlinkoView';

/** Plinko: one ball down a peg board per bet, into the slot of the bet bar's risk line. */
export const plinkoMode: DemoMode<PlinkoBridge> = {
  title: 'Plinko',
  accent: PALETTE.sky,
  createBridge: (transport) => new PlinkoBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: PlinkoView = new PlinkoView(stage, PALETTE.sky, () => controller);
    const controller = new PlinkoController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
