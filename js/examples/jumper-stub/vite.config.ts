import { defineConfig } from 'vite';
import { localBuildServer } from '@omega/webbridge-js/vite';

/** Fixed: the shell's `?localBuild=` points here, and the plugin builds asset URLs from it. */
const PORT = 5181;

export default defineConfig({
  plugins: [localBuildServer({ entry: '/src/boot.ts', mode: 'jumper' })],
  // The admin link is still printed; the stub is mostly opened by a shell URL, see README.
  server: { port: PORT, open: false },
});
