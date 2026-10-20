import { createWebBoot, JumperBridge } from '@omega/webbridge-js';
import { JumperStubGame } from './game/JumperStubGame';

/** `__WEB_GAME_BOOT__` of the stub: the same factory for the shell and for the mock host. */
export const jumperStubBoot = createWebBoot({
  createBridge: (transport) => new JumperBridge(transport),
  createGame: (bridge, container, options, host) => new JumperStubGame(bridge, container, options, host),
  destroyGame: (game) => game.destroy(),
});
