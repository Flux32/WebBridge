import { SlotBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { SlotController } from './SlotController';
import { SlotView } from './SlotView';

/** Slot: one spin is one whole round — its boards play in order, coins fly into the trigger. */
export const slotMode: DemoMode<SlotBridge> = {
  title: 'Slot',
  accent: PALETTE.amber,
  createBridge: (transport) => new SlotBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: SlotView = new SlotView(stage, () => controller);
    const controller = new SlotController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
