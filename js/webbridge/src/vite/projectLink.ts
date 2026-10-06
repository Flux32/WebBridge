/**
 * Связь проекта игры с игрой в конфигураторе. Связь хранится в `webbridge.json` в
 * корне проекта (его стоит коммитить: команда работает с одной игрой), а заводит её
 * админка: страница настройки проекта шлёт выбранную игру сюда, на dev-сервер.
 *
 * Путь эндпоинта и форма тела — контракт с конфигуратором
 * (`features/project-link/domain/project-link.ts`); меняются только парно.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';

export const PROJECT_FILE = 'webbridge.json';
export const PROJECT_LINK_PATH = '/__webbridge/project';

/** Тело запроса — один id; больше страница настройки не шлёт. */
const MAX_BODY_BYTES = 1024;

export class ProjectFileError extends Error {
  override readonly name = 'ProjectFileError';
}

const gameIdOf = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null || !('gameId' in value)) return null;
  const { gameId } = value;
  return typeof gameId === 'string' && gameId.trim() !== '' ? gameId : null;
};

/** Игра проекта или `null`, если проект ещё не связан. Битый файл — ошибка, а не «не связан». */
export const readProjectGameId = (root: string): string | null => {
  const path = join(root, PROJECT_FILE);
  if (!existsSync(path)) return null;
  const gameId = gameIdOf(JSON.parse(readFileSync(path, 'utf8')));
  if (gameId === null) throw new ProjectFileError(`${path}: "gameId" must be a non-empty string`);
  return gameId;
};

const writeProjectGameId = (root: string, gameId: string): void => {
  writeFileSync(join(root, PROJECT_FILE), `${JSON.stringify({ gameId }, null, 2)}\n`);
};

export interface AdminUrlInput {
  configuratorUrl: string;
  /** Адрес этого dev-сервера: с него шелл в редакторе возьмёт игру. */
  localOrigin: string;
  gameId: string | null;
  /** Режим игры, который админка подставит при создании новой. */
  mode: string | undefined;
}

/** Куда открыть админку: редактор связанной игры или настройка проекта. */
export const adminUrl = ({ configuratorUrl, localOrigin, gameId, mode }: AdminUrlInput): string => {
  const localBuild = `localBuild=${encodeURIComponent(localOrigin)}`;
  if (gameId !== null) {
    return new URL(`/admin/games/${encodeURIComponent(gameId)}/editor?${localBuild}`, configuratorUrl).href;
  }
  const modeQuery = mode === undefined ? '' : `&mode=${encodeURIComponent(mode)}`;
  return new URL(`/admin/connect?${localBuild}${modeQuery}`, configuratorUrl).href;
};

const respond = (res: ServerResponse, status: number): void => {
  res.statusCode = status;
  res.end();
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) req.destroy(new Error('project link body is too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
};

/**
 * Приём связи от админки. Пускает только её origin: иначе любая открытая у
 * разработчика страница могла бы перепривязать проект. Стоит до CORS Vite и
 * отвечает сам, включая preflight: JSON-тело его требует.
 */
export const projectLinkMiddleware =
  (root: string, configuratorOrigin: string) =>
  (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.url?.split('?')[0] !== PROJECT_LINK_PATH) return next();
    if (req.headers.origin !== configuratorOrigin) return respond(res, 403);

    res.setHeader('Access-Control-Allow-Origin', configuratorOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return respond(res, 204);
    if (req.method !== 'POST') return respond(res, 405);

    readBody(req).then(
      (body) => {
        const gameId = gameIdOf(parseJson(body));
        if (gameId === null) return respond(res, 400);
        writeProjectGameId(root, gameId);
        respond(res, 204);
      },
      () => respond(res, 413),
    );
  };
