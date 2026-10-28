/** The dev page's slot: the bridge package's `SlotMockHost` plays the host. */
import { SlotMockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { slotMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(slotMode),
  createMockHost: () => {
    const host = new SlotMockHost();
    return { host, bindKeys: () => void host.bindKeys() };
  },
  hint: 'Space — spin · C — spin with a coin collection · B — bonus round of boards',
};
