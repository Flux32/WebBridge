import { PlinkoAztecBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { AztecView } from './AztecView';
import { PlinkoAztecController } from './PlinkoAztecController';

/**
 * Plinko Aztec: many balls per bet down one board, a fortune wheel on the spin slot and a bonus game the
 * player steps through by tapping.
 */
export const plinkoAztecMode: DemoMode<PlinkoAztecBridge> = {
  title: 'Plinko Aztec',
  accent: PALETTE.lime,
  createBridge: (transport) => new PlinkoAztecBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: AztecView = new AztecView(stage, PALETTE.lime, () => controller);
    const controller = new PlinkoAztecController(bridge, view);
    return { renderer: view, onTap: () => controller.onTap(), destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
