/**
 * One demo game per build: `DEMO_MODE=<mode> vite build` bundles `src/modes/<mode>/boot.ts` into a
 * single self-contained `dist/<mode>/game.js` — the file the shell loads from a configurator build
 * folder. `DEMO_MODE=<mode> vite` serves the same entry as `/game.js` for the shell's `?localBuild=`.
 */
import { localBuildServer } from '@omega/webbridge-js/vite';
import { defineConfig } from 'vite';
import { DEMO_MODE_IDS, isDemoModeId } from './src/modes/modeIds';

const modeName = process.env.DEMO_MODE ?? 'crush';
if (!isDemoModeId(modeName)) throw new Error(`[demo-games] DEMO_MODE=${modeName} is not one of ${DEMO_MODE_IDS.join(', ')}`);

/** Fixed per mode: the shell's `?localBuild=` points here. */
const DEV_PORT = 5190 + DEMO_MODE_IDS.indexOf(modeName);
const entry = `src/modes/${modeName}/boot.ts`;

export default defineConfig({
  define: { 'import.meta.env.VITE_DEMO_MODE': JSON.stringify(modeName) },
  plugins: [localBuildServer({ entry: `/${entry}`, mode: modeName })],
  server: { port: DEV_PORT, strictPort: true, open: false },
  build: {
    outDir: `dist/${modeName}`,
    emptyOutDir: true,
    lib: { entry, name: 'DemoGame', formats: ['iife'], fileName: () => 'game.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
