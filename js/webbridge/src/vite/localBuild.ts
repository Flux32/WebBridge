/**
 * Vite-плагин для запуска игры в настоящем шелле без сборки: стенд открывается с
 * `?localBuild=http://localhost:<порт>` и берёт код игры с dev-сервера, а
 * конфигурация, редактор раскладки и бэк остаются стендовыми.
 *
 * Шелл грузит `<localBuild>/game.js` модулем, как и билд из конфигуратора
 * (`<baseUrl>/game.js`), поэтому здесь `/game.js` — модуль-обёртка: клиент Vite
 * (перезагрузка страницы на правку) и точка входа игры, та же, что у релизного
 * бандла. Игра регистрирует `__PHASER_BOOT__` как обычно.
 *
 * Страница стенда живёт на другом origin, и модульные скрипты она берёт только с
 * CORS. Vite по умолчанию пускает лишь localhost, поэтому плагин добавляет
 * origin стендов — и только их: открытый CORS отдал бы исходники игры любой
 * странице, открытой у разработчика.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { adminUrl, projectLinkMiddleware, readProjectGameId } from './projectLink';

export interface LocalBuildOptions {
  /** Точка входа бандла игры — та, что регистрирует `__PHASER_BOOT__`. */
  entry: string;
  /** Origin страниц шелла, которым dev-сервер отдаёт код игры. */
  shellOrigins: readonly string[];
  /** Админка, которую dev-сервер открывает при старте и от которой принимает связь с игрой. */
  configuratorUrl: string;
  /** Режим игры (`crush`, `slot`, …): админка подставит его, когда проект заводит новую игру. */
  mode?: string;
}

const DEFAULT_CONFIGURATOR_URL = 'https://games.omega.keitarocab.link';

/** Стенд в конфигураторе (шелл проксирован на его origin) и прямой адрес шелла. */
const DEFAULT_SHELL_ORIGINS: readonly string[] = [
  'https://games.omega.keitarocab.link',
  'https://master.games.keitarocab.link',
];

/** Шелл, поднятый локально, — тоже клиент dev-сервера; это пускает и Vite по умолчанию. */
const LOOPBACK_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

const BUNDLE_PATH = '/game.js';
const VITE_DEFAULT_PORT = 5173;

// Виртуальный модуль, а не свой ответ: тогда `/game.js` отдаёт сам Vite — со
// своим CORS и переписанными импортами. Свой обработчик стоял бы либо до CORS,
// либо после SPA-фолбэка, который отвечает на неизвестный путь index.html.
const BUNDLE_MODULE_ID = '\0webbridge-local-build';
const BUNDLE_MODULE_URL = '/@id/__x00__webbridge-local-build';

interface ViteDevServerLike {
  config: { root: string; logger: { info(message: string): void } };
  middlewares: {
    use(handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void): void;
  };
}

interface UserConfigLike {
  root?: string;
  server?: { port?: number; open?: boolean | string };
}

const bundleModule = (entry: string): string => `import '/@vite/client';\nimport '${entry}';\n`;

export const localBuildServer = (options: Pick<LocalBuildOptions, 'entry'> & Partial<LocalBuildOptions>) => {
  const { entry, shellOrigins, configuratorUrl, mode } = {
    shellOrigins: DEFAULT_SHELL_ORIGINS,
    configuratorUrl: DEFAULT_CONFIGURATOR_URL,
    ...options,
  };
  let openedAdmin = '';

  return {
    name: 'webbridge-local-build',
    apply: 'serve' as const,
    // Ассеты Vite адресует от корня (`/node_modules/…/font.woff2`), и на чужой
    // странице они ушли бы на origin шелла; `origin` делает их адреса полными.
    // Порт поэтому фиксирован: сдвинься он, адреса ассетов указывали бы мимо.
    //
    // При старте открывается админка: редактор игры проекта или, пока проект с
    // игрой не связан, его настройка. `open: false` в конфиге проекта это гасит.
    config(userConfig: UserConfigLike) {
      const port = userConfig.server?.port ?? VITE_DEFAULT_PORT;
      const localOrigin = `http://localhost:${port}`;
      const root = resolve(userConfig.root ?? process.cwd());
      openedAdmin = adminUrl({ configuratorUrl, localOrigin, gameId: readProjectGameId(root), mode });
      return {
        server: {
          cors: { origin: [...shellOrigins, LOOPBACK_ORIGIN] },
          origin: localOrigin,
          strictPort: true,
          ...(userConfig.server?.open === false ? {} : { open: openedAdmin }),
        },
      };
    },
    configureServer(server: ViteDevServerLike): void {
      server.config.logger.info(`  WebBridge admin: ${openedAdmin}`);
      server.middlewares.use(projectLinkMiddleware(server.config.root, new URL(configuratorUrl).origin));
      server.middlewares.use((req, _res, next) => {
        if (req.url?.split('?')[0] === BUNDLE_PATH) req.url = BUNDLE_MODULE_URL;
        next();
      });
    },
    resolveId(id: string): string | undefined {
      return id === BUNDLE_MODULE_ID ? id : undefined;
    },
    load(id: string): string | undefined {
      return id === BUNDLE_MODULE_ID ? bundleModule(entry) : undefined;
    },
  };
};
