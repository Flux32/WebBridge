/** The dev page's jumper: the bridge package's `JumperMockHost` plays the host. */
import { JumperMockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { jumperMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(jumperMode),
  createMockHost: () => {
    const host = new JumperMockHost();
    return { host, bindKeys: () => host.bindKeys() };
  },
  hint: 'Space — jump · C — cash out · B — buy bonus · D — difficulty',
};
