# Wheel — JS

> Как подключить колесо к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas).
> Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```ts
import { createWebBoot, registerWebBoot, WheelBridge } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new WheelBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const game = new MyWheelGame(container);                // ваш движок
      bridge.roundReceived.add((raw) => game.applyRound(raw)); // каждый снимок, повторы тоже
      game.onOutcomeShown(() => bridge.notifyRoundShown());   // один раз за раунд
      bridge.betBarMetricsReceived.add((metrics) => game.layoutAbove(metrics.betBarTopViewport));
      host.ready();                                            // хост отдаст накопленные команды
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      return game;
    },
    destroyGame: (game) => game.destroy(),
  }),
);
```

`MyWheelGame` — ваш код. Как его написать так, чтобы повторы не ломали вращение, — в
[полном примере](#полный-пример).

## Установка и точка входа

Пакет — `@omega/webbridge-js`, тип `WheelBetBarMetricsPayload` — из `@omega/webbridge-protocol`. Бандл
игры выставляет фабрику через `registerWebBoot(createWebBoot({ … }))`. Шелл зовёт её, когда скрипт
загрузился. Как поставить пакет, собрать `game.js` и открыть игру в шелле — в
[старте на JS](../../guides/getting-started-js.md).

Порядок в `createGame` важен:

1. Подписаться на сигналы моста.
2. Позвать `host.ready()`. Команды, которые хост отправил до этого, он держит в очереди и отдаёт сразу
   на `ready()`. Подписка после `ready()` их пропустит.
3. Послать `setUiVisibility(...)`. Первое `UiVisibility` хост считает знаком, что мост поднят.

У `WheelBridge` нет `start()` и стартовой синхронизации с ретраями: хост сам шлёт текущий раунд, как
только игра позвала `ready()`. Переспросить раунд — `requestGameState()`.

## API `WheelBridge`

`WheelBridge extends BridgeBase`. Общие сигналы и методы базы (`fastGameChanged`, `translationsReceived`,
`disabledPlayPressed`, `winWindowOpened`, `playSound`, `setUiVisibility`, …) — в
[справочнике ядра](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `roundReceived` | `unknown` — разобранный JSON [`WheelRoundMessage`](README.md#wheelroundmessage) | на каждый `ApplyRound`, в том числе повтор той же фазы |
| `betBarMetricsReceived` | `WheelBetBarMetricsPayload` | на каждый `SetWheelBetBarMetrics` |

Снимок раунда мост не проверяет и не толкует: форму разбирает игра. Payload — `unknown`, поэтому проверить
его нужно у себя (см. `readWheelSnapshot` в примере).

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `notifyRoundShown()` | `RoundShown` | один раз за раунд: колесо встало, пришёл `FINISH_GAME`, показ цвета доигран |
| `requestGameState()` | `RequestGameState` | игра потеряла раунд: хост перечитает его на сервере и пришлёт `ApplyRound` |
| `requestGameConfig()` | `RequestGameConfig` | колесу не нужен: в ответ придёт лесенка road, мост её пропустит |

Отдельного метода для `RequestBetBarViewportMetrics` в мосте нет. Наследник шлёт событие через
`this.transport` (так делает демо):

```ts
import { WheelBridge } from '@omega/webbridge-js';

export class GameWheelBridge extends WheelBridge {
  /** Хост шлёт метрики сам после загрузки; переспросить — если сцена поднялась позже. */
  public requestBetBarMetrics(): void {
    this.transport.send({ type: 'RequestBetBarViewportMetrics' });
  }
}
```

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastRound` | `unknown` | последний снимок `ApplyRound` как есть; `null` до первого |

Последних метрик мост не хранит: запомнить их — дело игры.

### Что мост пропускает

| Команда | Что делает мост | Почему |
|---|---|---|
| `ApplyGameConfig`, `ApplyGameState` | ничего | колесо не берёт раунд из конфига и состояния, текущий снимок приходит `ApplyRound` |
| `UpdateCoeffs` | ничего, без предупреждения | общая синхронизация конфига road шлёт его и колесу |
| любая другая команда режима | `BridgeLogger.warn('[WheelBridge] … does not belong to the wheel')` | команда чужого режима — ошибка хоста |

## Полный пример

Сцена, которая выдерживает повторы, поздний вход и пропуск ячейки в `FINISH_GAME`. Это сжатая версия
демо (`js/examples/demo-games/src/modes/wheel`: `wheelRound.ts`, `WheelController.ts`). Рисование —
за интерфейсом `WheelMotions`: сцена не рисует, вид не знает протокола.

```ts
// wheelSnapshot.ts — граница: сырой JSON хоста → проверенный снимок
export const WHEEL_STATUSES = ['WAIT_GAME', 'IN_GAME', 'FINISH_GAME', 'STOPPED'] as const;
export const WHEEL_COLORS = ['BLACK', 'RED', 'BLUE', 'GREEN'] as const;

export type WheelStatus = (typeof WHEEL_STATUSES)[number];
export type WheelColor = (typeof WHEEL_COLORS)[number];

export interface WheelSnapshot {
  readonly status: WheelStatus;
  readonly roundId: string | null;
  readonly msToNextPhase: number | null;
  readonly winnerColor: WheelColor | null;
  readonly cellIndex: number | null;
  readonly inCellOffset: number | null;
}

export class WheelSnapshotError extends Error {
  public constructor(field: string, value: unknown) {
    super(`[wheel] ApplyRound has an invalid ${field}: ${JSON.stringify(value) ?? String(value)}`);
    this.name = 'WheelSnapshotError';
  }
}

type Fields = Readonly<Record<string, unknown>>;

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  list.some((item) => item === value);

const numberOrNull = (fields: Fields, key: string): number | null => {
  const raw = fields[key];
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new WheelSnapshotError(key, raw);
  return raw;
};

const colorOrNull = (raw: unknown): WheelColor | null => {
  if (raw === null || raw === undefined) return null;
  if (!isOneOf(WHEEL_COLORS, raw)) throw new WheelSnapshotError('winnerColor', raw);
  return raw;
};

export const readWheelSnapshot = (raw: unknown): WheelSnapshot => {
  if (typeof raw !== 'object' || raw === null) throw new WheelSnapshotError('payload', raw);
  const fields = raw as Fields;
  const status = fields.status;
  if (!isOneOf(WHEEL_STATUSES, status)) throw new WheelSnapshotError('status', status);
  return {
    status,
    roundId: typeof fields.roundId === 'string' ? fields.roundId : null,
    msToNextPhase: numberOrNull(fields, 'msToNextPhase'),
    winnerColor: colorOrNull(fields.winnerColor),
    cellIndex: numberOrNull(fields, 'cellIndex'),
    inCellOffset: numberOrNull(fields, 'inCellOffset'),
  };
};
```

```ts
// WheelScene.ts — снимки → вращение → показ → RoundShown, ровно один раз за раунд
import { BridgeLogger, type WheelBridge } from '@omega/webbridge-js';
import { readWheelSnapshot, WheelSnapshotError, type WheelColor, type WheelSnapshot, type WheelStatus } from './wheelSnapshot';

export interface WheelMotions {
  /** Крутит к ячейке; `turns = 0` — встать без вращения. Резолвится, когда колесо встало. */
  spin(cellIndex: number, inCellOffset: number, durationMs: number, turns: number): Promise<void>;
  /** Показывает выпавший цвет; резолвится, когда показ доигран. */
  reveal(color: WheelColor): Promise<void>;
  showBetting(deadlineAt: number | null): void;
  showPaused(): void;
}

interface RoundProgress {
  readonly roundId: string | null;
  status: WheelStatus;
  deadlineAt: number | null;
  cellIndex: number | null;
  inCellOffset: number | null;
  winnerColor: WheelColor | null;
  spin: Promise<void> | null;
  isRevealStarted: boolean;
}

const DEFAULT_SPIN_MS = 4000;
const MIN_SPIN_MS = 600;
const SNAP_MS = 700;
const MS_PER_TURN = 900;
const MAX_TURNS = 6;
const CELL_MIDDLE = 0.5;

const isNewRound = (round: RoundProgress | null, snapshot: WheelSnapshot): boolean =>
  round === null ||
  snapshot.roundId !== round.roundId ||
  (snapshot.status === 'WAIT_GAME' && round.status !== 'WAIT_GAME');

export class WheelScene {
  private round: RoundProgress | null = null;
  private readonly unsubscribe: () => void;

  /** `layout` — цвет каждой ячейки по порядку бэкенда: по нему ищется ячейка цвета и сверяется исход. */
  public constructor(
    private readonly bridge: WheelBridge,
    private readonly motions: WheelMotions,
    private readonly layout: readonly WheelColor[],
    private readonly now: () => number = () => performance.now(),
  ) {
    this.unsubscribe = bridge.roundReceived.add((raw) => this.applyRound(raw));
  }

  public destroy(): void {
    this.unsubscribe();
  }

  private applyRound(raw: unknown): void {
    let snapshot: WheelSnapshot;
    try {
      snapshot = readWheelSnapshot(raw);
    } catch (error) {
      if (!(error instanceof WheelSnapshotError)) throw error;
      BridgeLogger.error(error.message);
      return;
    }
    const round = this.merge(snapshot);
    if (round.status === 'WAIT_GAME') this.motions.showBetting(round.deadlineAt);
    if (round.status === 'STOPPED') this.motions.showPaused();
    this.startSpin(round);
    if (round.status === 'FINISH_GAME') void this.reveal(round);
  }

  /** Повтор той же фазы ничего не меняет; дедлайн берётся только при смене фазы. */
  private merge(snapshot: WheelSnapshot): RoundProgress {
    const deadlineAt = snapshot.msToNextPhase === null ? null : this.now() + snapshot.msToNextPhase;
    const current = this.round;
    if (current === null || isNewRound(current, snapshot)) {
      const fresh: RoundProgress = { ...snapshot, deadlineAt, spin: null, isRevealStarted: false };
      this.round = fresh;
      return fresh;
    }
    if (snapshot.status !== current.status) current.deadlineAt = deadlineAt;
    current.status = snapshot.status;
    current.cellIndex = snapshot.cellIndex ?? current.cellIndex;
    current.inCellOffset = snapshot.inCellOffset ?? current.inCellOffset;
    current.winnerColor = snapshot.winnerColor ?? current.winnerColor;
    return current;
  }

  /** Ячейка из IN_GAME; страница, открытая на FINISH_GAME, знает только цвет — берём ячейку этого цвета. */
  private targetCell(round: RoundProgress): number | null {
    if (round.cellIndex !== null) return round.cellIndex;
    if (round.winnerColor === null) return null;
    return this.layout.indexOf(round.winnerColor);
  }

  private startSpin(round: RoundProgress): void {
    if (round.spin !== null) return;
    if (round.status !== 'IN_GAME' && round.status !== 'FINISH_GAME') return;
    const cell = this.targetCell(round);
    if (cell === null) return;
    const offset = round.inCellOffset ?? CELL_MIDDLE;
    if (round.status === 'FINISH_GAME') {
      round.spin = this.motions.spin(cell, offset, SNAP_MS, 0);
      return;
    }
    const left = round.deadlineAt === null ? DEFAULT_SPIN_MS : round.deadlineAt - this.now();
    const durationMs = Math.max(MIN_SPIN_MS, left);
    const turns = Math.min(MAX_TURNS, Math.max(1, Math.floor(durationMs / MS_PER_TURN)));
    round.spin = this.motions.spin(cell, offset, durationMs, turns);
  }

  private async reveal(round: RoundProgress): Promise<void> {
    if (round.isRevealStarted) return;
    round.isRevealStarted = true;
    const color = round.winnerColor;
    if (round.spin === null || color === null) {
      BridgeLogger.error('[wheel] FINISH_GAME names neither the cell nor the colour: nothing to show');
      return;
    }
    await round.spin;
    if (this.round !== round) return; // пока крутилось, начался новый раунд
    const landed = this.layout[this.targetCell(round) ?? -1];
    if (landed !== color) BridgeLogger.error(`[wheel] the pointer stopped on ${landed}, the round is ${color}`);
    await this.motions.reveal(color);
    this.bridge.notifyRoundShown();
  }
}
```

```ts
// boot.ts — вход бандла
import { createWebBoot, registerWebBoot } from '@omega/webbridge-js';
import { GameWheelBridge } from './GameWheelBridge';
import { WheelScene } from './WheelScene';
import { MyWheelView, WHEEL_LAYOUT } from './MyWheelView';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new GameWheelBridge(transport),
    createGame: (bridge, container, options, host) => {
      const view = new MyWheelView(container, options.devicePixelRatio); // реализует WheelMotions
      const scene = new WheelScene(bridge, view, WHEEL_LAYOUT);
      const unsubscribeMetrics = bridge.betBarMetricsReceived.add((metrics) => view.setBarTop(metrics.betBarTopViewport));
      host.ready();
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      bridge.requestBetBarMetrics();
      return { view, scene, unsubscribeMetrics };
    },
    destroyGame: ({ view, scene, unsubscribeMetrics }) => {
      unsubscribeMetrics();
      scene.destroy();
      view.destroy();
    },
  }),
);
```

Что здесь важно:

- `merge` — слияние, а не замена. Повтор той же фазы не трогает дедлайн и не перезапускает вращение.
- `isRevealStarted` ставится синхронно: повторы `FINISH_GAME`, пришедшие во время показа, второго
  `RoundShown` не дадут.
- `RoundShown` уходит после `await` анимаций, а не внутри обработчика команды.

## Mock-хост: игра без шелла

В `@omega/webbridge-js` mock-хоста колеса нет. Он есть в демо — `WheelMockHost`
(`js/examples/demo-games/src/modes/wheel/WheelMockHost.ts`). Он играет шелл вместе с расписанием
раундов сервера:

- фазы `WAIT_GAME` 5 с → `IN_GAME` 4 с → `FINISH_GAME` 3 с на случайной ячейке;
- каждая фаза приходит дважды (повтор через 700 мс), как от настоящего хоста;
- в `FINISH_GAME` — только цвет, без ячейки;
- `SetWheelBetBarMetrics` на `ready()` и на `RequestBetBarViewportMetrics`;
- `RequestPlay` вне `WAIT_GAME` → `DisabledPlayPressed`;
- клавиша **S** — остановить раунды (`STOPPED`) и запустить снова.

Запустить демо:

```bash
npm install                                                   # в корне репозитория, один раз
DEMO_MODE=wheel npm run dev -w js/examples/demo-games         # http://localhost:5195/?mock=1
```

Своя игра подключает мок так же, как моки других режимов. Класс можно скопировать из демо: он зависит
только от протокола и раскладки ячеек.

```ts
import { createWebBoot, isMockEnabled, registerWebBoot } from '@omega/webbridge-js';
import { WheelMockHost } from './dev/WheelMockHost'; // копия из demo-games

const boot = createWebBoot({ /* createBridge, createGame, destroyGame — как выше */ });

if (isMockEnabled()) {          // страница открыта с ?mock=1
  const host = new WheelMockHost();
  host.attach(boot(host, document.getElementById('game')!));
  host.bindKeys();
} else {
  registerWebBoot(boot);
}
```

Мок начинает слать раунды на `host.ready()`. Если игра зовёт `ready()` синхронно прямо в `createGame`,
мок ещё не привязан (`attach` идёт после `boot`), и первые снимок и метрики теряются. Демо поэтому зовёт
`ready()` тиком позже (`setTimeout(…, 0)` в `kit/demoBoot.ts`).

## Проверка

1. **Mock.** `?mock=1`: колесо крутится на `IN_GAME`, цвет появляется только после остановки,
   повторы фаз не дёргают колесо, `S` ставит на паузу.
2. **Лента событий.** Включить логи моста (`SetLoggingEnabled`, чит-панель шелла) и проверить:
   `RoundShown` — один на раунд и всегда после `FINISH_GAME`.
3. **Шелл.** Поднять dev-сервер с плагином `localBuildServer` (`@omega/webbridge-js/vite`) и открыть
   стенд с `?localBuild=http://localhost:<порт>`. Игра в конфигураторе — режима `wheel`, launch-URL
   несёт `gameMode=wheel&gameCategory=wheel`. Подробно — [старт на JS](../../guides/getting-started-js.md).
4. **Окно результата.** После `RoundShown` шелл открывает окно (если админ включил его для исхода),
   проигрывает баннер над баром и показывает выплату. Без `RoundShown` ничего из этого не будет.
5. **Поздний вход.** Перезагрузить страницу во время вращения и во время результата: колесо встаёт на
   правильный цвет, `RoundShown` уходит один раз.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Колесо перезапускает вращение несколько раз за раунд | каждый `ApplyRound` обрабатывается как новая фаза; хост шлёт снимок на каждую ставку любого игрока | сливать снимки (`merge`), новый раунд — только новый `roundId` или вход в `WAIT_GAME` |
| Отсчёт приёма ставок прыгает назад | дедлайн пересчитывается на каждом повторе | брать `msToNextPhase` только при смене фазы |
| Окно результата открывается дважды | `RoundShown` на каждом повторе `FINISH_GAME` | флаг «показ начат» на раунд, ставить синхронно |
| Окно результата открывается, пока колесо крутится | `RoundShown` до конца анимации или сразу на `FINISH_GAME` | слать после `await` вращения и показа цвета |
| Выигрыш так и не появился | `RoundShown` не пришёл: колесо ждёт ячейку, а `FINISH_GAME` пришёл без неё | брать ячейку из `IN_GAME`, при позднем входе — ячейку цвета `winnerColor` |
| На `IN_GAME` цвет `null` | цвет приходит только с `FINISH_GAME` | на `IN_GAME` крутить по `cellIndex`, цвет показывать на `FINISH_GAME` |
| Стрелка на чужом цвете | раскладка ячеек игры не совпадает с раскладкой бэкенда | взять порядок ячеек у бэкенда; на `FINISH_GAME` верить `winnerColor` |
| Колесо залезает под бар | метрики пришли до того, как сцена подписалась | подписаться до `host.ready()`; при необходимости переспросить `RequestBetBarViewportMetrics` |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `js/webbridge/src/wheel/WheelBridge.ts`, тест `js/webbridge/test/WheelBridge.test.ts`,
  демо `js/examples/demo-games/src/modes/wheel/`
