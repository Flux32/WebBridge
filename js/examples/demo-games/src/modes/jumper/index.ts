import { JumperBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { JumperController } from './JumperController';
import { JumperView } from './JumperView';

/** Jumper: jump up a ladder of coefficients; accelerators throw the player several steps at once. */
export const jumperMode: DemoMode<JumperBridge> = {
  title: 'Jumper',
  accent: PALETTE.pink,
  createBridge: (transport) => new JumperBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: JumperView = new JumperView(stage, () => controller.scene);
    const controller = new JumperController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
