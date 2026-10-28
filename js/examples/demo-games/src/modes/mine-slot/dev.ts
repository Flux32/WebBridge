/** The dev page's mine-slot mode: the bridge package's `MineSlotMockHost` plays the host. */
import { MineSlotMockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { mineSlotMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(mineSlotMode),
  createMockHost: () => {
    const host = new MineSlotMockHost();
    return { host, bindKeys: () => void host.bindKeys() };
  },
  hint: 'Space — spin · B — buy bonus',
};
