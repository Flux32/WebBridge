/** The dev page's dragon-pots mode: the bridge package's `DragonPotsMockHost` plays the host. */
import { DragonPotsMockHost } from '@omega/webbridge-js';
import type { DevMode } from '../../dev/devMode';
import { createDemoBoot } from '../../kit/demoBoot';
import { dragonPotsMode } from '.';

export const devMode: DevMode = {
  boot: createDemoBoot(dragonPotsMode),
  createMockHost: () => {
    const host = new DragonPotsMockHost();
    return { host, bindKeys: () => void host.bindKeys() };
  },
  hint: 'Space — spin · 1…7 — Mighty, Mega, Super, Jackpot, Ultra, Supreme, Ultimate · 8 — coins, no trigger · B / N / M — buy Mighty / Mega / Super · F — fast game',
};
