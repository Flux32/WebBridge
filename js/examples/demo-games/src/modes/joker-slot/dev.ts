/** The dev page's joker-slot mode: the bridge package's `JokerSlotMockHost` plays the host. */
import { JokerSlotMockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { jokerSlotMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(jokerSlotMode),
  createMockHost: () => {
    const host = new JokerSlotMockHost();
    return { host, bindKeys: () => void host.bindKeys() };
  },
  hint: 'Space — spin · L line · C Joker · S Super Joker · B bonus · X buy x75 · Z buy x200 · F fast game',
};
