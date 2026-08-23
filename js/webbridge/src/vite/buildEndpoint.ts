/**
 * Vite-плагин для кнопки Build в мок-панели: страница сборку запустить не
 * может, поэтому просит dev-сервер, а тот выполняет команду и открывает папку
 * с результатом.
 *
 * Живёт отдельной точкой входа (`@omega/webbridge-js/vite`), а не в общем
 * индексе: здесь код для Node, и бандлеру игры он на глаза попадаться не
 * должен.
 *
 * Плагин dev-only (`apply: 'serve'`) и принимает запросы только с локальной
 * петли: dev-сервер часто поднимают с `host: true`, и без этой проверки
 * выполнить команду мог бы любой в той же сети.
 */
import { exec } from 'node:child_process';

/** Минимальная форма Vite-плагина — чтобы не тянуть vite в зависимости. */
interface ViteDevServerLike {
  config: { root: string };
  middlewares: {
    use(path: string, handler: (req: IncomingLike, res: ServerResponseLike) => void): void;
  };
}

interface IncomingLike {
  socket: { remoteAddress?: string | undefined };
}

interface ServerResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(chunk: string): void;
}

export interface BuildEndpointOptions {
  /** Путь эндпоинта, который дёргает панель. */
  path: string;
  /** Что выполнить. По умолчанию — сборка бандла и открытие папки (macOS). */
  command: string;
}

const DEFAULTS: BuildEndpointOptions = {
  path: '/__build',
  command: 'npm run build:drop && open dist',
};

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export const mockBuildEndpoint = (options: Partial<BuildEndpointOptions> = {}) => {
  const { path, command } = { ...DEFAULTS, ...options };

  return {
    name: 'webbridge-mock-build-endpoint',
    apply: 'serve' as const,
    configureServer(server: ViteDevServerLike): void {
      server.middlewares.use(path, (req, res) => {
        const respond = (status: number, body: Record<string, unknown>): void => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) {
          respond(403, { ok: false, error: 'only loopback may run the build' });
          return;
        }

        exec(command, { cwd: server.config.root }, (error, stdout, stderr) => {
          respond(error ? 500 : 200, {
            ok: !error,
            output: (error ? stderr : stdout).slice(-400),
          });
        });
      });
    },
  };
};
