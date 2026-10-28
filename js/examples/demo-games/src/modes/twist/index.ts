import { TwistBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { TwistController } from './TwistController';
import { TwistView } from './TwistView';

/** Twist: totems land on a sector and fill its row, until death wipes the board or the player cashes out. */
export const twistMode: DemoMode<TwistBridge> = {
  title: 'Twist',
  accent: PALETTE.mint,
  createBridge: (transport) => new TwistBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: TwistView = new TwistView(stage, () => controller);
    const controller = new TwistController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
