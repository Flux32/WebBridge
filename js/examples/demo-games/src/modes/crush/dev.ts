/** The dev page's crush: the bridge package's `MockHost` plays the host. */
import { MockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { crushMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(crushMode),
  createMockHost: () => {
    const host = new MockHost();
    return { host, bindKeys: () => host.bindKeys() };
  },
  hint: 'Space — step · C — cash out · R — restart',
};
