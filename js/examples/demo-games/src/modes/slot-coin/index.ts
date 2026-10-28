import { SlotCoinBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { SlotCoinController } from './SlotCoinController';
import { SlotCoinView } from './SlotCoinView';

/** Slot Coin: one spin is one whole round — its boards play in order, coins fly into the trigger. */
export const slotCoinMode: DemoMode<SlotCoinBridge> = {
  title: 'Slot Coin',
  accent: PALETTE.amber,
  createBridge: (transport) => new SlotCoinBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: SlotCoinView = new SlotCoinView(stage, () => controller);
    const controller = new SlotCoinController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
