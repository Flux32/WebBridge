import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { localBuildServer } from '../src/vite/localBuild';
import { PROJECT_FILE, PROJECT_LINK_PATH } from '../src/vite/projectLink';

const CONFIGURATOR_ORIGIN = 'http://127.0.0.1:3100';
const OTHER_LOOPBACK_ORIGIN = 'http://localhost:3100';

let root: string;
let server: ViteDevServer;
let baseUrl: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'webbridge-project-link-'));
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [localBuildServer({ entry: '/src/main.ts', configuratorUrl: CONFIGURATOR_ORIGIN })],
    server: { port: 0, open: false },
  });
  await server.listen();
  // listen() always binds an http server here: middlewareMode is off.
  const { port } = server.httpServer!.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterEach(async () => {
  await server.close();
  rmSync(root, { recursive: true, force: true });
});

const preflight = (origin: string): Promise<Response> =>
  fetch(`${baseUrl}${PROJECT_LINK_PATH}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
      'Access-Control-Request-Private-Network': 'true',
    },
  });

const postLink = (origin: string, gameId: string): Promise<Response> =>
  fetch(`${baseUrl}${PROJECT_LINK_PATH}`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
  });

describe('project link endpoint on the Vite dev server', () => {
  it('answers the configurator preflight itself, private network access included', async () => {
    const response = await preflight(CONFIGURATOR_ORIGIN);

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(CONFIGURATOR_ORIGIN);
    expect(response.headers.get('access-control-allow-methods')).toBe('POST');
    expect(response.headers.get('access-control-allow-private-network')).toBe('true');
  });

  it('refuses a preflight from another loopback origin without CORS headers', async () => {
    const response = await preflight(OTHER_LOOPBACK_ORIGIN);

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('refuses a link from another loopback origin unreadably and leaves the project unlinked', async () => {
    const response = await postLink(OTHER_LOOPBACK_ORIGIN, 'game-1');

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(existsSync(join(root, PROJECT_FILE))).toBe(false);
  });

  it('stores the game sent by the configurator', async () => {
    const response = await postLink(CONFIGURATOR_ORIGIN, 'game-1');

    expect(response.status).toBe(204);
    expect(JSON.parse(readFileSync(join(root, PROJECT_FILE), 'utf8'))).toEqual({ gameId: 'game-1' });
  });

  it("leaves other paths to Vite's CORS", async () => {
    const response = await fetch(`${baseUrl}/game.js`, {
      method: 'OPTIONS',
      headers: { Origin: OTHER_LOOPBACK_ORIGIN, 'Access-Control-Request-Method': 'GET' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(OTHER_LOOPBACK_ORIGIN);
  });
});
