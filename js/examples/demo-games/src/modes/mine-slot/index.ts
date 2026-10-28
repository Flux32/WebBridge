import { MineSlotBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { MineSlotController } from './MineSlotController';
import { MineSlotView } from './MineSlotView';

/** Mine Slot: pickaxes from the reels dig a field of blocks; every round of a reply plays on the one field. */
export const mineSlotMode: DemoMode<MineSlotBridge> = {
  title: 'Mine Slot',
  accent: PALETTE.copper,
  createBridge: (transport) => new MineSlotBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: MineSlotView = new MineSlotView(stage, () => controller);
    const controller = new MineSlotController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
