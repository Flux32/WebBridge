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

export interface LocalBuildOptions {
  /** Точка входа бандла игры — та, что регистрирует `__PHASER_BOOT__`. */
  entry: string;
  /** Origin страниц шелла, которым dev-сервер отдаёт код игры. */
  shellOrigins: readonly string[];
}

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

interface IncomingLike {
  url?: string | undefined;
}

interface ViteDevServerLike {
  middlewares: {
    use(handler: (req: IncomingLike, res: unknown, next: () => void) => void): void;
  };
}

const bundleModule = (entry: string): string => `import '/@vite/client';\nimport '${entry}';\n`;

export const localBuildServer = (options: Pick<LocalBuildOptions, 'entry'> & Partial<LocalBuildOptions>) => {
  const { entry, shellOrigins } = { shellOrigins: DEFAULT_SHELL_ORIGINS, ...options };

  return {
    name: 'webbridge-local-build',
    apply: 'serve' as const,
    // Ассеты Vite адресует от корня (`/node_modules/…/font.woff2`), и на чужой
    // странице они ушли бы на origin шелла; `origin` делает их адреса полными.
    // Порт поэтому фиксирован: сдвинься он, адреса ассетов указывали бы мимо.
    config(userConfig: { server?: { port?: number } }) {
      const port = userConfig.server?.port ?? VITE_DEFAULT_PORT;
      return {
        server: {
          cors: { origin: [...shellOrigins, LOOPBACK_ORIGIN] },
          origin: `http://localhost:${port}`,
          strictPort: true,
        },
      };
    },
    configureServer(server: ViteDevServerLike): void {
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
