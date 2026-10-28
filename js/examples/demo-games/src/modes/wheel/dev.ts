/** The dev page's wheel: its own scheduler mock plays the shell, the bridge package has none. */
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { wheelMode } from '.';
import { WheelMockHost } from './WheelMockHost';

export const devMode: DevMode = {
  boot: createDemoBoot(wheelMode),
  createMockHost: () => {
    const host = new WheelMockHost();
    return { host, bindKeys: () => host.bindKeys() };
  },
  hint: 'Rounds run on their own: 5 s bets · 4 s spin · 3 s result · S — stop / resume',
};
