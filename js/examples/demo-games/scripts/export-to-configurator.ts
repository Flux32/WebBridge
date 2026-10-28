/**
 * Copies the built demo games and their covers into the configurator, where its «Демо игры» tab serves
 * them: `<configurator>/public/demo-games/<mode>/{game.js,cover.svg}`.
 *
 *   CONFIGURATOR_DIR=../../../../Pixi/games-configurator npm run export -w js/examples/demo-games
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CONFIGURATOR_MODE_IDS } from '../src/modes/modeIds.ts';

const configuratorDir = process.env.CONFIGURATOR_DIR;
if (configuratorDir === undefined) throw new Error('[demo-games] set CONFIGURATOR_DIR to the games-configurator checkout');
const publicDir = resolve(configuratorDir, 'public');
if (!existsSync(publicDir)) throw new Error(`[demo-games] ${publicDir} is not a games-configurator public folder`);

for (const mode of CONFIGURATOR_MODE_IDS) {
  const target = join(publicDir, 'demo-games', mode);
  mkdirSync(target, { recursive: true });
  copyFileSync(join('dist', mode, 'game.js'), join(target, 'game.js'));
  copyFileSync(join('covers', `${mode}.svg`), join(target, 'cover.svg'));
  console.log(`[demo-games] exported ${mode} → ${target}`);
}
