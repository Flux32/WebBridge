import { JokerSlotBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { JokerSlotController } from './JokerSlotController';
import { JokerSlotView } from './JokerSlotView';

/** Joker Slot: one spin is one whole round — the base board, then every board of a landed or bought bonus. */
export const jokerSlotMode: DemoMode<JokerSlotBridge> = {
  title: 'Joker Slot',
  accent: PALETTE.magenta,
  createBridge: (transport) => new JokerSlotBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: JokerSlotView = new JokerSlotView(stage, () => controller);
    const controller = new JokerSlotController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
