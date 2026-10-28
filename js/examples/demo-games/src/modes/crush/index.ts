import { CrushBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { CrushController } from './CrushController';
import { CrushView } from './CrushView';

/** Crush: step by step up a ladder of coefficients until a block falls or the player cashes out. */
export const crushMode: DemoMode<CrushBridge> = {
  title: 'Crush',
  accent: PALETTE.coral,
  createBridge: (transport) => new CrushBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: CrushView = new CrushView(stage, () => controller);
    const controller = new CrushController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
