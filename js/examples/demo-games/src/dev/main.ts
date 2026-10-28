/**
 * The dev page without a shell: `?mock=1` runs the demo game of the served mode (`DEMO_MODE`) against
 * its mode's mock host from the bridge package, on the same boot path the shell uses.
 */
import { isMockEnabled } from '@omega/webbridge-js';
import type { DevMode } from './devMode';

/** Every mode that has a `dev.ts`, by its folder name. */
const DEV_MODES = import.meta.glob<{ devMode: DevMode }>('../modes/*/dev.ts');

const container = document.getElementById('game');
const hint = document.getElementById('hint');
if (container === null || hint === null) throw new Error('[demo-games] index.html lacks #game or #hint');

const modeName: string = import.meta.env.VITE_DEMO_MODE;
const load = DEV_MODES[`../modes/${modeName}/dev.ts`];
if (load === undefined) throw new Error(`[demo-games] no dev page for mode ${modeName}`);

if (isMockEnabled()) {
  const { devMode } = await load();
  const mock = devMode.createMockHost();
  mock.host.attach(devMode.boot(mock.host, container));
  mock.bindKeys();
  hint.textContent = devMode.hint;
} else {
  hint.textContent = 'Open with ?mock=1, or load /game.js from the shell (?localBuild=).';
}
