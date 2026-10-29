/** The dev page's fruit-love-fever mode: the bridge package's `FruitLoveFeverMockHost` plays the host. */
import { FruitLoveFeverMockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { fruitLoveFeverMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(fruitLoveFeverMode),
  createMockHost: () => {
    const host = new FruitLoveFeverMockHost();
    return { host, bindKeys: () => void host.bindKeys() };
  },
  hint: 'Space — spin · B — buy x75 · H — buy x200 · G — reconnect (re-send the state) · F — fast game',
};
