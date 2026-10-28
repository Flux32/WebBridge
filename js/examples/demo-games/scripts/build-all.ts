/** Builds every demo game: `dist/<mode>/game.js`, one self-contained bundle per mode. */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { DEMO_MODE_IDS } from '../src/modes/modeIds.ts';

const viteBin = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');

for (const mode of DEMO_MODE_IDS) {
  execFileSync(process.execPath, [viteBin, 'build', '--logLevel', 'warn'], {
    stdio: 'inherit',
    env: { ...process.env, DEMO_MODE: mode },
  });
  console.log(`[demo-games] built ${mode}`);
}
