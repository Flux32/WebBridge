/** The dev page's slot-coin mode: the bridge package's `SlotCoinMockHost` plays the host. */
import { SlotCoinMockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { slotCoinMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(slotCoinMode),
  createMockHost: () => {
    const host = new SlotCoinMockHost();
    return { host, bindKeys: () => void host.bindKeys() };
  },
  hint: 'Space — spin · C — spin with a coin collection · B — bonus round of boards',
};
