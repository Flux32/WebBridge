/** The dev page's plinko-aztec: the bridge package's `PlinkoAztecMockHost` plays the host. */
import { PlinkoAztecMockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { plinkoAztecMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(plinkoAztecMode),
  createMockHost: () => {
    const host = new PlinkoAztecMockHost();
    return { host, bindKeys: () => void host.bindKeys() };
  },
  hint: 'Space — drop · W — wheel · G — bonus game · ↑↓ balls · ←→ bet · T / B — top / bottom · R — new player',
};
