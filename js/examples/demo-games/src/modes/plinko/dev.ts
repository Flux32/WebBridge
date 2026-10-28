/** The dev page's plinko: the bridge package's `PlinkoMockHost` plays the host. */
import { PlinkoMockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { plinkoMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(plinkoMode),
  createMockHost: () => {
    const host = new PlinkoMockHost();
    return { host, bindKeys: () => void host.bindKeys() };
  },
  hint: 'Space — drop · T — top slot · B — bottom slot · R — next risk',
};
