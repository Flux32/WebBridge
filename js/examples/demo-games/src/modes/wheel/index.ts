import { WheelBridge } from '@omega/webbridge-js';
import type { DemoMode } from '../../kit/demoBoot';
import { PALETTE } from '../../kit/palette';
import { WheelController } from './WheelController';
import { WheelView } from './WheelView';

/**
 * The bridge with the one request the wheel adds to the common sync: the bar's metrics, which the host
 * also sends on its own once the engine has loaded — asked again in case the first ones came too early.
 */
class DemoWheelBridge extends WheelBridge {
  public start(): void {
    this.requestGameConfig();
    this.requestGameState();
    this.transport.send({ type: 'RequestBetBarViewportMetrics' });
  }
}

/** Wheel: a shared, server-scheduled round — bets on a colour, one spin, the colour pays. */
export const wheelMode: DemoMode<DemoWheelBridge> = {
  title: 'Wheel',
  accent: PALETTE.violet,
  createBridge: (transport) => new DemoWheelBridge(transport),
  createScene: ({ bridge, stage }) => {
    const view: WheelView = new WheelView(stage, () => controller);
    const controller = new WheelController(bridge, view);
    return { renderer: view, destroy: () => controller.destroy() };
  },
  startSync: (bridge) => bridge.start(),
};
