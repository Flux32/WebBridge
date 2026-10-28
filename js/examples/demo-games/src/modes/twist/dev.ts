/** The dev page's twist: the bridge package has no twist mock host, so `TwistMockHost` plays the shell. */
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { twistMode } from '.';
import { TwistMockHost } from './TwistMockHost';

export const devMode: DevMode = {
  boot: createDemoBoot(twistMode),
  createMockHost: () => {
    const host = new TwistMockHost();
    return { host, bindKeys: () => void host.bindKeys() };
  },
  hint: 'Space — spin · P — part cash out · C — cash out · B — buy free spins',
};
