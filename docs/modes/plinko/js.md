# Plinko — JS

> Как подключить Plinko к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas).
> Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```ts
import { createWebBoot, PlinkoBridge, registerWebBoot } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new PlinkoBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const game = new MyPlinkoGame(container);                     // ваш движок
      bridge.gameConfigReceived.add((config) => game.buildBoard(config));
      bridge.dropResultReceived.add(async (result) => {
        await game.dropBall(result);                                // шарик сел в resultPosition
        bridge.notifyDropFinished();                                // ровно один раз
      });
      host.ready();                                                 // игра принимает команды
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      bridge.start();                                               // спросить конфиг и состояние
      return game;
    },
    destroyGame: (game) => game.destroy(),
  }),
);
```

`MyPlinkoGame` — ваш код. Как проверить payload и проиграть броски по очереди — в
[полном примере](#полный-пример).

## Установка и точка входа

Пакет — `@omega/webbridge-js`. Бандл игры выставляет фабрику через `registerWebBoot(createWebBoot({ … }))`.
Шелл зовёт её, когда скрипт загрузился. Как поставить пакет, собрать `game.js` и открыть игру в шелле —
в [старте на JS](../../guides/getting-started-js.md).

Порядок в `createGame`:

1. Подписаться на сигналы. Команды до `host.ready()` хост держит в очереди и отдаёт на `ready()`.
2. `host.ready()`.
3. `setUiVisibility(...)`. Без первого `UiVisibility` шелл ждёт 10 с, прежде чем прислать конфиг и
   состояние.
4. `bridge.start()` — стартовая синхронизация.

## API `PlinkoBridge`

`PlinkoBridge extends BridgeBase` — зеркало C#-шного `PlinkoWebBridge`. Общие сигналы и методы базы
(`fastGameChanged`, `translationsReceived`, `disabledPlayPressed`, `playSound`, `setUiVisibility`, …) — в
[справочнике ядра](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `gameConfigReceived` | `unknown` — разобранный JSON [конфига](README.md#конфиг) | на каждый `ApplyGameConfig` |
| `gameStateReceived` | `unknown` — разобранный `get-game-state` | на каждый `ApplyGameState` |
| `dropResultReceived` | `unknown` — разобранный [`PlinkoGameState`](README.md#plinkogamestate) броска | на каждый `ApplyDropResult` |

Мост payload'ы не проверяет и не толкует: значения — `unknown`, форму разбирает игра. Невалидный JSON
бросит из `JSON.parse` внутри `receive`.

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `start()` | `RequestGameConfig` + `RequestGameState` сразу и каждые 500 мс, до 10 раз, пока не придёт `ApplyGameConfig`. С `?mock=1` не шлёт ничего | когда сцена готова принимать данные |
| `notifyDropFinished()` | `DropFinished` | ровно один раз на `ApplyDropResult`, когда шарик сел |
| `requestGameConfig()` / `requestGameState()` | `RequestGameConfig` / `RequestGameState` | вручную — если сцена пересоздана и нужны свежие данные |

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastGameConfig` | `unknown` | последний конфиг; `null` до первого |
| `lastGameState` | `unknown` | последнее состояние: `ApplyGameState` **или** последний бросок |
| `lastDropResult` | `unknown` | последний бросок; `null` до первого |

Команды чужого режима (`SetBallsAmount`, `SetBetPerBall`, `UpdateCoeffs`, …) мост не применяет и пишет
`BridgeLogger.warn('[PlinkoBridge] … не относится к plinko')`.

## Полный пример

Сжатая версия демо (`js/examples/demo-games/src/modes/plinko`: `plinkoRound.ts`, `PlinkoController.ts`,
`ballPath.ts`). Сцена не рисует, вид не знает протокола: движения — за интерфейсом `PlinkoMotions`.

```ts
// plinkoRound.ts — граница: сырой JSON хоста → проверенные линии и бросок
export const PLINKO_RISKS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type PlinkoRisk = (typeof PLINKO_RISKS)[number];

export interface PlinkoDrop {
  readonly slot: number;
  readonly coefficient: number;
  readonly risk: PlinkoRisk;
  readonly winAmount: string;   // деньги остаются строкой бэкенда
  readonly currency: string;
}

export class PlinkoPayloadError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'PlinkoPayloadError';
  }
}

type Fields = Readonly<Record<string, unknown>>;

const readRecord = (value: unknown, what: string): Fields => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PlinkoPayloadError(`${what} is not an object`);
  }
  return value as Fields;
};

/** Хост пересылает числа сервера как есть, и они часто приходят десятичными строками ("1.03"). */
const toNumber = (value: unknown, what: string): number => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new PlinkoPayloadError(`${what} is not a number: ${JSON.stringify(value)}`);
  }
  return number;
};

const readText = (fields: Fields, key: string): string => {
  const value = fields[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new PlinkoPayloadError(`${key} is not text: ${JSON.stringify(value)}`);
};

const readLine = (value: unknown, risk: PlinkoRisk): readonly number[] => {
  if (!Array.isArray(value)) throw new PlinkoPayloadError(`coefficients.${risk} is not a list`);
  return value.map((item, index) => toNumber(item, `coefficients.${risk}[${index}]`));
};

const readRisk = (value: unknown): PlinkoRisk => {
  const risk = PLINKO_RISKS.find((candidate) => candidate === value);
  if (risk === undefined) throw new PlinkoPayloadError(`risk is not one of ${PLINKO_RISKS.join(', ')}: ${JSON.stringify(value)}`);
  return risk;
};

export class PlinkoRound {
  private lines: Readonly<Record<PlinkoRisk, readonly number[]>> | null = null;
  private currentRisk: PlinkoRisk = 'LOW'; // выбранного в баре риска игра не знает до первого броска

  /** Линия коэффициентов текущего риска; пустая до конфига. */
  public get line(): readonly number[] {
    return this.lines?.[this.currentRisk] ?? [];
  }

  public setConfig(config: unknown): void {
    const coefficients = readRecord(readRecord(config, 'config').coefficients, 'config.coefficients');
    this.lines = {
      LOW: readLine(coefficients.LOW, 'LOW'),
      MEDIUM: readLine(coefficients.MEDIUM, 'MEDIUM'),
      HIGH: readLine(coefficients.HIGH, 'HIGH'),
    };
  }

  /** Читает бросок и переводит доску на линию его риска. */
  public readDrop(result: unknown): PlinkoDrop {
    const fields = readRecord(result, 'drop result');
    const risk = readRisk(fields.risk);
    const slot = toNumber(fields.resultPosition, 'resultPosition');
    const line = this.lines?.[risk] ?? [];
    if (!Number.isInteger(slot) || slot < 0 || slot >= line.length) {
      throw new PlinkoPayloadError(`resultPosition ${slot} is not one of the ${line.length} ${risk} slots`);
    }
    this.currentRisk = risk;
    return {
      slot,
      coefficient: toNumber(fields.coeff, 'coeff'),
      risk,
      winAmount: readText(fields, 'winAmount'),
      currency: readText(fields, 'currency'),
    };
  }
}
```

```ts
// ballPath.ts — зигзаг шарика к ячейке, которую выбрал сервер
/**
 * Сколько штырьков вправо от верхнего шарик после каждого ряда: `rows + 1` значений, от 0 до `slot`.
 * Ячейка `slot` достигается ровно `slot` отскоками вправо; их порядок перемешан сидом.
 */
export const ballPath = (rows: number, slot: number, seed: number): readonly number[] => {
  if (!Number.isInteger(slot) || slot < 0 || slot > rows) {
    throw new RangeError(`[plinko] slot ${slot} is not on a board of ${rows} rows`);
  }
  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0; // mulberry32: тот же сид — тот же путь
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  const bounces = Array.from({ length: rows }, (_, row) => (row < slot ? 1 : 0));
  for (let index = bounces.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [bounces[index], bounces[other]] = [bounces[other] ?? 0, bounces[index] ?? 0];
  }
  const path = [0];
  bounces.forEach((bounce, row) => path.push((path[row] ?? 0) + bounce));
  return path;
};
```

```ts
// PlinkoScene.ts — бросок → падение → DropFinished, по очереди
import { BridgeLogger, type PlinkoBridge } from '@omega/webbridge-js';
import { PlinkoPayloadError, PlinkoRound, type PlinkoDrop } from './plinkoRound';

export interface PlinkoMotions {
  /** Строит доску по линии коэффициентов: `line.length - 1` рядов. */
  showLine(line: readonly number[]): void;
  /** Роняет шарик в ячейку; резолвится, когда шарик сел. */
  drop(slot: number): Promise<void>;
  /** Шарик сел: подсветить ячейку, показать коэффициент и выигрыш. */
  land(drop: PlinkoDrop): void;
  showError(message: string): void;
}

export class PlinkoScene {
  private readonly round = new PlinkoRound();
  private queue: Promise<void> = Promise.resolve();
  private isDestroyed = false;
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: PlinkoBridge,
    private readonly motions: PlinkoMotions,
  ) {
    this.unsubscribers = [
      bridge.gameConfigReceived.add((config) => this.enqueue(async () => this.applyConfig(config))),
      bridge.dropResultReceived.add((result) => this.enqueue(() => this.playDrop(result))),
    ];
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  /** Конфиг тоже в очереди: новая линия не перестраивает доску под летящим шариком. */
  private enqueue(move: () => Promise<void>): void {
    this.queue = this.queue.then(() => (this.isDestroyed ? undefined : move()));
  }

  private applyConfig(config: unknown): void {
    if (this.readPayload(() => this.round.setConfig(config)) === null) return;
    this.motions.showLine(this.round.line);
  }

  private async playDrop(result: unknown): Promise<void> {
    const drop = this.readPayload(() => this.round.readDrop(result));
    if (drop === null) return; // битый бросок: шарика нет, DropFinished нет — бар остаётся залоченным
    this.motions.showLine(this.round.line);
    await this.motions.drop(drop.slot);
    if (this.isDestroyed) return;
    this.motions.land(drop);
    this.bridge.notifyDropFinished();
  }

  /** Граница для сырого JSON хоста: битый payload становится видимой ошибкой, а не исключением в кадре. */
  private readPayload<T>(read: () => T): T | null {
    try {
      return read();
    } catch (error) {
      if (!(error instanceof PlinkoPayloadError)) throw error;
      BridgeLogger.error(`[plinko] ${error.message}`);
      this.motions.showError(error.message);
      return null;
    }
  }
}
```

```ts
// boot.ts — вход бандла
import { createWebBoot, PlinkoBridge, registerWebBoot } from '@omega/webbridge-js';
import { PlinkoScene } from './PlinkoScene';
import { MyPlinkoView } from './MyPlinkoView'; // реализует PlinkoMotions, путь шарика — ballPath

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new PlinkoBridge(transport),
    createGame: (bridge, container, options, host) => {
      const view = new MyPlinkoView(container, options.devicePixelRatio);
      const scene = new PlinkoScene(bridge, view);
      host.ready();
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      bridge.start();
      return { view, scene };
    },
    destroyGame: ({ view, scene }) => {
      scene.destroy();
      view.destroy();
    },
  }),
);
```

Что здесь важно:

- `notifyDropFinished()` — после `await` падения, никогда синхронно внутри обработчика команды.
- `ApplyGameState` сцена не слушает вовсе: это состояние сессии, а не бросок.
- Риск доски меняется вместе с броском (`readDrop`), до падения шарика.

## Mock-хост: игра без шелла

`PlinkoMockHost` встаёт на место шелла и сервера. Он отвечает на запросы игры, сам выбирает ячейку,
считает выплату и держит бросок занятым, пока игра не пришлёт `DropFinished`. Игра идёт по настоящему
пути: та же фабрика, тот же мост, те же команды. Суммы иллюстративные.

```ts
import { createWebBoot, isMockEnabled, PlinkoMockHost, registerWebBoot } from '@omega/webbridge-js';

const boot = createWebBoot({ /* createBridge, createGame, destroyGame — как выше */ });

if (isMockEnabled()) {          // страница открыта с ?mock=1
  const host = new PlinkoMockHost({ risk: 'MEDIUM' });
  host.attach(boot(host, document.getElementById('game')!));
  host.bindKeys();
} else {
  registerWebBoot(boot);
}
```

С `?mock=1` `start()` ничего не шлёт: конфиг и состояние мок пушит сам на `host.ready()`. Если игра зовёт
`ready()` синхронно прямо в `createGame`, мок ещё не привязан (`attach` идёт после `boot`), и стартовые
данные теряются. Демо поэтому зовёт `ready()` тиком позже (`setTimeout(…, 0)` в `kit/demoBoot.ts`).

| Клавиша | Метод | Что делает |
|---|---|---|
| Пробел | `drop()` | бросок: ячейка выпадает по рядам штырьков (`random() < 0.5` на каждый ряд), края — реже всего |
| T | `drop('top')` | шарик в самую дорогую ячейку |
| B | `drop('bottom')` | шарик в самую дешёвую ячейку |
| R | `cycleRisk()` | следующий риск: `LOW` → `MEDIUM` → `HIGH` |

`bindKeys(target = window)` возвращает функцию отписки. Ещё одно свойство — `risk`: текущий риск мока.

Опции конструктора (`PlinkoMockHostOptions`, все необязательные):

| Опция | Тип | По умолчанию |
|---|---|---|
| `coefficients` | `Record<PlinkoRisk, number[]>` | 9 ячеек на риск (доска 8 рядов) |
| `risk` | `'LOW' \| 'MEDIUM' \| 'HIGH'` | `'LOW'` |
| `currency` | `string` | `'USD'` |
| `decimalPlaces` | `number` | `2` |
| `betAmount` | `number` | `1` |
| `balance` | `number` | `1000` |
| `random` | `() => number` | `Math.random`; тесты подменяют, чтобы исход был предсказуем |

Что эмулирует мок:

- `RequestGameConfig` / `RequestGameState` → `ApplyGameConfig` / `ApplyGameState` (`status: 'none'`);
- `RequestWhiteLabel` → `ApplyWhiteLabel false`, `RequestFastGame` → `SetFastGame false`;
- бросок занят до `DropFinished`: `drop()` в это время игнорируется, `RequestPlay` → `DisabledPlayPressed`;
- `RequestPlay` при свободном баре — бросок. В шелле иначе: там `RequestPlay` в plinko всегда получает
  `DisabledPlayPressed` (см. [обзор](README.md#события-игры--хост)).

Не прислала игра `DropFinished` — мок залипнет, и это видно сразу.

Демо целиком:

```bash
npm install                                                   # в корне репозитория, один раз
DEMO_MODE=plinko npm run dev -w js/examples/demo-games        # http://localhost:5190/?mock=1
```

## Проверка

1. **Mock.** `?mock=1`, пробел: шарик падает, коэффициент появляется после посадки, второй пробел во
   время падения ничего не делает. `T` / `B` — края линии, `R` — смена риска со следующим броском.
2. **Тест.** Связка мост + мок прогоняется без браузера, как в
   `js/webbridge/test/plinkoMockHostBridge.integration.test.ts`: `host.ready()`, `requestPlay()`,
   `notifyDropFinished()`.
3. **Логи.** Включить логи моста (`SetLoggingEnabled`, чит-панель шелла): на каждый `ApplyDropResult` — один
   `DropFinished`, и только после анимации.
4. **Шелл.** Поднять dev-сервер с плагином `localBuildServer` (`@omega/webbridge-js/vite`) и открыть стенд с
   `?localBuild=http://localhost:<порт>`. Игра в конфигураторе — режима `plinko`, launch-URL несёт
   `gameMode=plinko&gameCategory=plinko`. Бар plinko в шелле пока заглушка: риск, сумма, кнопка ставки.
   Подробно — [старт на JS](../../guides/getting-started-js.md).
5. **Перезагрузка** во время падения: после загрузки сцена в покое, шарик не падает повторно.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бар не освобождается после броска | `notifyDropFinished()` не позван: исключение в анимации, битый payload, обработчик не подписан до `ready()` | подписаться до `host.ready()`; ловить ошибки анимации; на битом броске — видимая ошибка |
| Можно бросать, пока шарик летит | `notifyDropFinished()` позван сразу на `ApplyDropResult`, а не после посадки | слать после `await` падения |
| Шарик сел не в ту ячейку | `resultPosition` взят из линии, что на доске, а не из линии `risk` броска | переводить доску на риск броска перед падением |
| Шарик падает при загрузке | `ApplyGameState` / `gameStateReceived` обрабатывается как бросок | состояние сессии — не бросок; шарик только на `ApplyDropResult` |
| `NaN` в коэффициенте | число пришло десятичной строкой (`"1.03"`) | читать число из строки и из числа, как `toNumber` |
| Конфиг приходит через 10 с после загрузки | игра не прислала `UiVisibility` | `setUiVisibility(...)` сразу после `host.ready()` |
| В моке нет конфига на старте | `host.ready()` позван синхронно в `createGame`, мок ещё не привязан | звать `ready()` тиком позже |
| Тап по сцене не бросает в шелле | в шелле plinko `RequestPlay` всегда отвечает `DisabledPlayPressed` | бросок — кнопкой бара хоста |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md) · [Plinko Aztec — JS](../plinko-aztec/js.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `js/webbridge/src/plinko/PlinkoBridge.ts`, `js/webbridge/src/plinko/PlinkoMockHost.ts`, тесты
  `js/webbridge/test/PlinkoBridge.test.ts`, `PlinkoMockHost.test.ts`; демо `js/examples/demo-games/src/modes/plinko/`
