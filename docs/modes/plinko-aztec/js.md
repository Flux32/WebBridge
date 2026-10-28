# Plinko Aztec — JS

> Как подключить режим к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas).
> Контракт режима — в [обзоре](README.md).

## Коротко

```ts
import { createWebBoot, registerWebBoot, PlinkoAztecBridge } from '@omega/webbridge-js';

/** Ваша сцена: проигрывает GameState броска и резолвится, когда доиграла. */
declare const board: {
  play(state: unknown): Promise<void>;
  mount(container: HTMLElement): { destroy(): void };
};

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new PlinkoAztecBridge(transport),
    createGame: (bridge, container, _options, host) => {
      bridge.dropResultReceived.add(async (state) => {
        await board.play(state);       // шарики → колесо → бонус
        bridge.notifyDropFinished();   // один раз, когда доиграно всё
      });
      window.setTimeout(() => {
        host.ready();
        bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
        bridge.start();                // RequestGameConfig + RequestGameState с ретраями
      }, 0);
      return board.mount(container);
    },
    destroyGame: (game) => game.destroy(),
  }),
);
```

Бонусная игра, очередь ответов и выбор бет-бара — в [полном примере](#полный-пример).

## Установка и точка входа

Пакет `@omega/webbridge-js` ставится из GitHub Releases по тегу `js-v*`, сборка бандла и dev-сервер — в
[старте на JS](../../guides/getting-started-js.md). Всё, что нужно режиму, экспортирует корень пакета:

```ts
import {
  PlinkoAztecBridge,          // мост
  PlinkoAztecMockHost,        // mock-хост для игры без шелла
  isMockEnabled,              // ?mock=1 в адресе
  type BallsAmountChange,
  type BetPerBallChange,
  type SelectionDirection,
  type PlinkoAztecMockHostOptions,
  type PlinkoAztecMockScenario,
  type PlinkoAztecOptionStep,
} from '@omega/webbridge-js';
```

Бандл отдаёт шеллу фабрику через `registerWebBoot(createWebBoot({...}))`. `host.ready()` игра зовёт сама, когда
готова принимать команды, — на тик позже, чем вернулась из `createGame`: mock-хост привязывается к игре
(`attach`) только после возврата фабрики, и `ready()`, позванный синхронно, свои стартовые данные не получит.

## API `PlinkoAztecBridge`

`PlinkoAztecBridge extends BridgeBase`: сигналы и методы ядра (`fastGameChanged`, `disabledPlayPressed`,
`requestPlay()`, `setUiVisibility()`, звуки…) — в [справочнике ядра](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `gameConfigReceived` | `unknown` — разобранный JSON конфига | `ApplyGameConfig` |
| `gameStateReceived` | `unknown` — GameState | `ApplyGameState` |
| `dropResultReceived` | `unknown` — GameState броска | `ApplyDropResult` |
| `stepResultReceived` | `unknown` — GameState шага бонуса | `ApplyBonusStepResult` |
| `ballsAmountChanged` | `BallsAmountChange` | `SetBallsAmount` с новым значением |
| `betPerBallChanged` | `BetPerBallChange` | `SetBetPerBall` с новой суммой |

Payload'ы приходят как `unknown`: мост делает `JSON.parse` и не проверяет форму. Проверку игра делает на своей
границе — пример в `js/examples/demo-games/src/modes/plinko-aztec/aztecRound.ts` (`readAztecDrop`, `readBonus`).
Формы данных — в [обзоре](README.md#данные).

```ts
interface BallsAmountChange {
  readonly amount: number;
  readonly previousAmount: number;     // 0, пока хост не прислал первый выбор
  readonly direction: SelectionDirection;
}

interface BetPerBallChange {
  readonly betPerBall: string;         // строка бэкенда как есть: "0.2"
  readonly previousBetPerBall: string | null;  // null до первой ставки
  readonly direction: SelectionDirection;
}

type SelectionDirection = 'none' | 'increased' | 'decreased';
```

`direction` — `'none'` у первого значения после загрузки (сравнивать не с чем), иначе `'increased'` /
`'decreased'` по сумме. Повтор того же значения сигнал не поднимает вовсе, поэтому ответ на `requestBallsAmount()`
без смены выбора сигнала не даст — значение уже лежит в `currentBallsAmount`.

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `start()` | `RequestGameConfig` + `RequestGameState`, повтор каждые 500 мс до 10 раз, пока не пришёл конфиг | Сцена готова принимать данные. В mock-режиме (`?mock=1`) не шлёт ничего |
| `notifyDropFinished()` | `DropFinished` | Один раз на `ApplyDropResult`, когда доиграны шарики, колесо и вся бонусная игра |
| `requestStep()` | `RequestStep` | Тап в бонусной игре — один на шаг, пока не пришёл `stepResultReceived` |
| `requestBallsAmount()` | `RequestBallsAmount` | Нужен явный ответ хоста; обычно хватает `currentBallsAmount` |
| `requestBetPerBall()` | `RequestBetPerBall` | То же для ставки; обычно хватает `currentBetPerBall` |
| `requestPlay()` | `RequestPlay` (метод ядра) | Тап по полю вне бонуса — то же, что Play бара |
| `requestGameConfig()` / `requestGameState()` | `RequestGameConfig` / `RequestGameState` | Разовый запрос; `start()` зовёт их сам |

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastGameConfig` | `unknown` | Последний конфиг (`null` до первого) |
| `lastGameState` | `unknown` | Последнее состояние; бросок и шаг тоже его обновляют |
| `lastDropResult` | `unknown` | Последний ответ броска |
| `lastStepResult` | `unknown` | Последний ответ шага бонуса |
| `currentBallsAmount` | `number` | Число шариков следующего броска; `0`, пока хост не прислал выбор |
| `currentBetPerBall` | `string \| null` | Ставка за шар следующего броска строкой бэкенда; `null` до первой |

Кэш нужен коду, который подписался позже пуша: прочитать поле, а не ждать смены.

## Полный пример

Сцена, которая проигрывает режим целиком: бросок, колесо, бонусная игра по тапам, восстановление бонуса после
перезагрузки, выбор бет-бара. Анимации спрятаны за интерфейсом `AztecBoard` — это ваш рендер. Пример — сжатая
версия `PlinkoAztecController` из демо.

```ts
import {
  BridgeLogger,
  createWebBoot,
  registerWebBoot,
  PlinkoAztecBridge,
  type BallsAmountChange,
} from '@omega/webbridge-js';

/** Рендер доски. Каждое движение резолвится, когда доиграло. */
interface AztecBoard {
  setLine(coefficients: readonly number[]): void;
  showTray(balls: number): void;
  dropBalls(positions: readonly string[]): Promise<void>;
  spinWheel(sector: string): Promise<void>;
  showBonus(level: number, stepsLeft: number, winAmount: string): void;
  hideBonus(): void;
  showError(message: string): void;
  destroy(): void;
}

interface AztecRound {
  readonly positions: readonly string[];
  readonly wheelSector: string | null;
  readonly bonus: { level: number; ballsAmount: number; winAmount: string } | null;
}

class AztecPayloadError extends Error {}

const recordOf = (value: unknown, what: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) throw new AztecPayloadError(`${what} is not an object`);
  return value as Record<string, unknown>; // checked right above
};

const readRound = (state: unknown): AztecRound => {
  const record = recordOf(state, 'game state');
  const balls = Array.isArray(record.ballsResult) ? record.ballsResult : [];
  const bonusState = record.bonusGameState === undefined ? {} : recordOf(record.bonusGameState, 'bonusGameState');
  const bonus = bonusState.result === undefined ? null : recordOf(bonusState.result, 'bonusGameState.result');
  return {
    positions: balls.map((ball, index) => String(recordOf(ball, `ballsResult[${index}]`).position)),
    wheelSector: record.freeSpinResult === undefined
      ? null
      : String(recordOf(record.freeSpinResult, 'freeSpinResult').position),
    bonus: bonus === null
      ? null
      : { level: Number(bonus.level), ballsAmount: Number(bonus.ballsAmount), winAmount: String(bonus.winAmount) },
  };
};

class AztecScene {
  private isBonusActive = false;
  private isStepRequested = false;
  /** Бросок, чей DropFinished ещё не ушёл: ждёт конца бонусной игры. */
  private isDropUnreported = false;
  /** Ответы хоста играются строго по очереди. */
  private queue: Promise<void> = Promise.resolve();
  private readonly unsubscribers: (() => void)[];

  public constructor(private readonly bridge: PlinkoAztecBridge, private readonly board: AztecBoard) {
    this.unsubscribers = [
      bridge.gameConfigReceived.add((config) => this.guard(() => this.applyConfig(config))),
      bridge.gameStateReceived.add((state) => this.guard(() => this.restore(readRound(state)))),
      bridge.dropResultReceived.add((state) => this.enqueue(() => this.playDrop(state))),
      bridge.stepResultReceived.add((state) => this.enqueue(() => this.playStep(state))),
      bridge.ballsAmountChanged.add((change) => this.onBallsAmount(change)),
    ];
    if (bridge.currentBallsAmount > 0) board.showTray(bridge.currentBallsAmount);
  }

  /** Тап по полю: в бонусе — следующий шаг, иначе — Play бара. */
  public onTap(): void {
    if (!this.isBonusActive) {
      this.bridge.requestPlay();
      return;
    }
    if (this.isStepRequested) return;
    this.isStepRequested = true;
    this.bridge.requestStep();
  }

  public destroy(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.board.destroy();
  }

  private applyConfig(config: unknown): void {
    const positions = recordOf(config, 'config').positions;
    if (!Array.isArray(positions)) throw new AztecPayloadError('config.positions is not a list');
    this.board.setLine(positions.map((slot, index) => Number(recordOf(slot, `positions[${index}]`).coefficient)));
  }

  /** Сервер ещё ведёт бонусную игру (перезагрузка посреди бонуса): игрок шагает дальше. */
  private restore(round: AztecRound): void {
    if (round.bonus === null || this.isBonusActive) return;
    this.enterBonus(round.bonus);
  }

  private async playDrop(state: unknown): Promise<void> {
    const round = this.guard(() => readRound(state));
    if (round === null) return;
    this.isDropUnreported = true;
    await this.board.dropBalls(round.positions);
    if (round.wheelSector !== null) await this.board.spinWheel(round.wheelSector);
    this.settle(round);
  }

  private async playStep(state: unknown): Promise<void> {
    const round = this.guard(() => readRound(state));
    if (round === null) return;
    await this.board.dropBalls(round.positions);
    this.isStepRequested = false;
    this.settle(round);
  }

  /** После броска или шага: бонус идёт дальше — ждём тапа; кончился — бросок доигран. */
  private settle(round: AztecRound): void {
    if (round.bonus !== null) {
      this.enterBonus(round.bonus);
      return;
    }
    this.isBonusActive = false;
    this.board.hideBonus();
    if (this.isDropUnreported) this.bridge.notifyDropFinished();
    this.isDropUnreported = false;
  }

  private enterBonus(bonus: NonNullable<AztecRound['bonus']>): void {
    this.isBonusActive = true;
    this.board.showBonus(bonus.level, bonus.ballsAmount, bonus.winAmount);
  }

  private onBallsAmount({ amount }: BallsAmountChange): void {
    this.board.showTray(amount);
  }

  private enqueue(move: () => Promise<void>): void {
    this.queue = this.queue.then(move);
  }

  /** Граница с сырым JSON хоста: битый payload — видимая ошибка, а не тишина. */
  private guard<T>(read: () => T): T | null {
    try {
      return read();
    } catch (error) {
      if (!(error instanceof AztecPayloadError)) throw error;
      BridgeLogger.error(`[plinko-aztec] ${error.message}`);
      this.board.showError(error.message);
      return null;
    }
  }
}

declare function createBoard(container: HTMLElement): AztecBoard & { canvas: HTMLCanvasElement };

registerWebBoot(
  createWebBoot<PlinkoAztecBridge, { scene: AztecScene; dispose: () => void }>({
    createBridge: (transport) => new PlinkoAztecBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const board = createBoard(container);
      const scene = new AztecScene(bridge, board);
      const onTap = (): void => scene.onTap();
      board.canvas.addEventListener('pointerdown', onTap);
      const readyTimerId = window.setTimeout(() => {
        host.ready();
        bridge.setUiVisibility({
          hideDesktopBetBar: false,
          hideMobileBetBar: false,
          desktopBetBarInteractable: true,
          mobileBetBarInteractable: true,
        });
        bridge.start();
      }, 0);
      return {
        scene,
        dispose: () => {
          window.clearTimeout(readyTimerId);
          board.canvas.removeEventListener('pointerdown', onTap);
          scene.destroy();
        },
      };
    },
    destroyGame: (game) => game.dispose(),
  }),
);
```

Что здесь важно:

- `notifyDropFinished()` зовётся из одного места — `settle`, и только для броска (`isDropUnreported`): шаги бонуса и
  восстановленный после перезагрузки бонус его не шлют.
- `isStepRequested` держит правило «один `RequestStep` на шаг»: хост шаги не дедуплицирует. Ставится **до**
  `requestStep()`: mock-хост отвечает синхронно, `stepResultReceived` срабатывает прямо внутри вызова.
- Очередь (`queue`) не даёт новому ответу прервать анимацию предыдущего. В демо то же делает `kit/MoveQueue.ts`.
- `ballsResult[].position` — коэффициент ячейки, а не индекс; какую из ячеек-близнецов выбрать, решает доска
  (демо: `slotIndexOf` в `aztecRound.ts`).

Рабочая игра целиком — `js/examples/demo-games/src/modes/plinko-aztec/`: `PlinkoAztecController.ts` (мост ↔ модель ↔
движения), `aztecRound.ts` (чтение payload'ов), `wheel.ts` (колесо по сектору сервера), `AztecView.ts`,
`WheelOverlay.ts` (рендер).

## Mock-хост: игра без шелла

`PlinkoAztecMockHost` встаёт на место шелла и сервера: держит выбор бет-бара, отвечает на запросы игры, бросает по
клавише и ведёт бонусную игру. Игра идёт по настоящему пути — та же фабрика, тот же мост, те же команды.
Подробнее о mock-режиме — в [концепции](../../concepts/mock-mode.md).

### Запуск

```ts
import { isMockEnabled, PlinkoAztecMockHost } from '@omega/webbridge-js';

const boot = createWebBoot({ /* createBridge, createGame, destroyGame — как выше */ });

if (isMockEnabled()) {                       // страница открыта с ?mock=1
  const host = new PlinkoAztecMockHost();
  host.attach(boot(host, document.getElementById('game')!));
  host.bindKeys();                           // возвращает функцию отвязки
} else {
  registerWebBoot(boot);
}
```

На демо-игре:

```bash
npm install                                                       # в корне репозитория, один раз
DEMO_MODE=plinko-aztec npm run dev -w js/examples/demo-games      # http://localhost:5191/?mock=1
```

В mock-режиме `bridge.start()` молчит (`isMockEnabled()`), поэтому мок сам пушит стартовые данные по
`host.ready()`: сначала `SetBallsAmount` и `SetBetPerBall` (первые варианты опций), затем `ApplyGameConfig` и
`ApplyGameState`, — тот же порядок, что у шелла.

### Клавиши и методы

| Клавиша | Метод | Что делает |
|---|---|---|
| Пробел | `drop()` | Бросок, сценарий `random` |
| T | `drop('top')` | Все шарики — в самую дорогую ячейку |
| B | `drop('bottom')` | Все шарики — в самую дешёвую **платящую** ячейку (не в ячейку колеса) |
| W | `drop('fortune-wheel')` | Первый шарик — в ячейку колеса, колесо встаёт на множитель |
| G | `drop('bonus-game')` | Первый шарик — в ячейку колеса, колесо даёт бонусную игру |
| S | `step()` | Шаг бонуса — то же, что `requestStep()` из игры |
| ↑ / ↓ | `changeBallsAmount(1 \| -1)` | Следующий / предыдущий вариант числа шариков |
| → / ← | `changeBetPerBall(1 \| -1)` | Следующий / предыдущий вариант ставки за шар |
| R | `reset()` | Новый игрок: прогресс бамперов и бонус сброшены, конфиг и состояние переотправлены |

| Свойство | Тип | Что хранит |
|---|---|---|
| `selection` | `{ ballsAmount: number; betPerBall: string }` | Текущий выбор mock-бара |
| `isBonusActive` | `boolean` | Идёт ли бонусная игра |

### Сценарии

| Сценарий | Куда падают шарики | Колесо | Бонус |
|---|---|---|---|
| `random` | Каждый — в случайную ячейку линии (равновероятно, включая ячейку колеса) | Если хоть один шарик попал в ячейку колеса — встаёт на `fortuneWheelCoefficient` | Никогда |
| `top` | Все — в ячейку с наибольшим коэффициентом | Нет | Нет |
| `bottom` | Все — в ячейку с наименьшим коэффициентом `> 0` | Нет | Нет |
| `fortune-wheel` | Первый — в ячейку колеса, остальные случайно | Встаёт на `fortuneWheelCoefficient`, выигрыш броска × множитель | Нет |
| `bonus-game` | Первый — в ячейку колеса, остальные случайно | Сектор `"bonus"`, `coeff "0"` | Начинается: уровень 1, `bonusBallsPerStep` шариков за шаг, `bonusSteps` шагов |

Как мок считает ответ:

- **Бамперы.** У каждого шарика три шанса задеть бампер, каждый с вероятностью `bumperChance`:
  `bonusBumpAmount` — от 0 до 3. Сумма бамперов броска прибавляется к счётчику своей комбинации
  `` `${currency}-${ballsAmount}-${betPerBall}` `` и уходит в `bonusGameState.progress` и в `bonusGameProgress`
  следующего конфига. Сам по себе счётчик бонус не запускает.
- **Выигрыш броска** — сумма коэффициентов шариков × ставка за шар; с колесом — ещё × множитель колеса. `coeff`
  ответа — сумма коэффициентов шариков без множителя колеса.
- **Шаг бонуса** — `ballPerDrop` шариков в случайные ячейки (колесо в бонусе не срабатывает). Выигрыш шага
  копится в `result.winAmount`, бамперы — в `result.progress`; каждые `bonusLevelThreshold` бамперов — уровень +1 и
  шарик за шаг +1. `result.ballsAmount` (шагов осталось) уменьшается на 1; на последнем шаге `result` пропадает,
  `status` — `"win"`, `isFinished: true`.
- **Состояние на загрузке** (`ApplyGameState`) — `status: "none"`, а пока бонус идёт — `"in-game"` с
  `bonusGameState.result`. Мок шлёт его на `ready()`, `reset()` и на каждый `RequestGameState` игры, так что
  восстановление бонуса проверяется без шелла: G, затем `bridge.requestGameState()` из кода сцены.
- **Конфиг**: `minBetAmount` / `defaultBetAmount` — первый вариант ставки за шар, `maxBetAmount` — ×100,
  `maxWinAmount` — ×10 000; `positions` — `slotCoefficients` с равной вероятностью.
- Суммы мок считает в `number` и форматирует `toFixed(decimalPlaces)` — они иллюстративные, не источник истины.

### Блокировки — как у шелла

- `drop()` занят, пока игра не прислала `DropFinished`, и всё время бонусной игры: повторный бросок и
  переключатели в это время игнорируются, а `requestPlay()` из сцены получает `DisabledPlayPressed`. Не прислала
  игра `DropFinished` — мок залипнет, и это видно сразу.
- `step()` вне бонусной игры ничего не делает. Повторный `RequestStep` до результата мок не отсекает (как и шелл).
- Переключатели упираются в крайний вариант, а не переходят по кругу — как стрелки бара в шелле.
- `RequestBallsAmount` / `RequestBetPerBall` мок отвечает текущим выбором; `RequestWhiteLabel` — `false`,
  `RequestFastGame` — `SetFastGame(false)`.

### Опции конструктора

`new PlinkoAztecMockHost(options?: Partial<PlinkoAztecMockHostOptions>)` — неуказанные поля берутся из умолчаний.
Те же параметры, что `PlinkoAztecMockSettings` в C#.

| Опция | Тип | По умолчанию | Что задаёт |
|---|---|---|---|
| `slotCoefficients` | `number[]` | `[1000, 130, 26, 9, 4, 2, 0.2, 0, 0.2, 2, 4, 9, 26, 130, 1000]` | Линия ячеек слева направо; `0` — ячейка колеса. Для `fortune-wheel` / `bonus-game` она обязана быть, иначе мок бросает `Error` |
| `ballsAmountOptions` | `number[]` | `[10, 20, 50]` | Варианты числа шариков; первый — выбор на старте |
| `betPerBallOptions` | `string[]` | `['1', '2', '5', '10']` | Варианты ставки за шар строками бэкенда; первый — выбор на старте. У шелла — `['0.2', '0.4', '1', '2']` |
| `currency` | `string` | `'USD'` | Валюта ответов и ключей прогресса |
| `decimalPlaces` | `number` | `2` | Знаков в суммах |
| `bumperChance` | `number` | `0.25` | Шанс бампера на каждом из трёх шансов шарика |
| `bonusLevelThreshold` | `number` | `5` | Бамперов на уровень бонусной игры |
| `bonusSteps` | `number` | `5` | Шагов в бонусной игре |
| `bonusBallsPerStep` | `number` | `3` | Шариков за шаг на первом уровне |
| `fortuneWheelCoefficient` | `number` | `2` | Множитель колеса вне бонус-сектора |
| `random` | `() => number` | `Math.random` | Источник случайности; тест подменяет его, чтобы исход был предсказуем |

## Проверка

1. **Mock.** `DEMO_MODE=plinko-aztec npm run dev -w js/examples/demo-games`, `?mock=1`: Пробел — бросок, W — колесо,
   G — бонус, S или тап — шаги, ↑↓ / →← — выбор. После каждого броска следующий принимается только когда всё
   доиграло; если бросок «не отпускает» — игра не прислала `DropFinished`.
2. **Лента моста.** Включить логи моста (`BridgeLogger.isEnabled = true` или команда `SetLoggingEnabled`): мост пишет
   предупреждения об отброшенном `SetBallsAmount` / `SetBetPerBall`. Демо показывает все команды и события в
   ленте в шапке сцены.
3. **Шелл локально.** Dev-сервер без `mock` отдаёт `/game.js`; шелл грузит его с `?localBuild=http://localhost:5191`
   (параметры шелла — в [старте на JS](../../guides/getting-started-js.md)). Проверить: бар оживает только после
   `DropFinished`, в бонусе бар заблокирован, перезагрузка посреди бонуса возвращает сцену в бонус.
4. **Стенд конфигуратора.** Игру с `gameCategory: plinko-aztec` открыть на стенде, пройти бросок, колесо и
   бонусную игру против dev-бэкенда.
5. **Тесты.** Логику сцены — с ручными движениями вместо аниматора, как `js/examples/demo-games/test`; мост и мок —
   `js/webbridge/test/PlinkoAztecBridge.test.ts`, `PlinkoAztecMockHost.test.ts`.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бар не разблокируется после броска | Нет `notifyDropFinished()` или он остался в ветке, которая не выполнилась (ошибка разбора, оборванная анимация) | Звать из одного места после всей анимации; ошибку разбора показывать, а не глотать |
| Бар оживает посреди бонусной игры | `notifyDropFinished()` ушёл после шариков броска, до бонуса | Слать, только когда в ответе нет `bonusGameState.result` |
| Шаг бонуса списан дважды / два шага подряд | Повторный тап до результата отправил второй `requestStep()` | Флаг «шаг запрошен» до `stepResultReceived` |
| Бонус залип после ошибки сервера на `step` | Хост показал тост и ничего не прислал; игра ждёт шаг вечно | Снимать флаг «шаг запрошен» по таймауту ожидания или по следующему тапу — решение игры (демо этого пока не делает) |
| Лоток пустой после загрузки | Подписка на `ballsAmountChanged` после первого пуша | Прочитать `currentBallsAmount` при подписке |
| Тап по полю ничего не делает в шелле во время броска | Хост молча отклоняет повторный бросок: `DisabledPlayPressed` во время летящего броска не приходит | Не рассчитывать на `disabledPlayPressed` в этот момент; показывать занятость по своей анимации |
| Шарики падают не в те ячейки | `position` прочитан как индекс | Искать ячейку по коэффициенту; `"spin"` — ячейка колеса |
| Ключ прогресса не совпадает с сервером | Ставка прошла через `number` и форматирование (`"1"` → `"1.00"`, `"0.4"` → `"0.40"`) | Брать `betPerBall` строкой как есть |
| Mock не присылает стартовые данные | `host.ready()` позван синхронно внутри `createGame`, до `attach` | Звать `ready()` на тик позже (`setTimeout(…, 0)`) |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `js/webbridge/src/plinko-aztec/` (`PlinkoAztecBridge.ts`, `PlinkoAztecMockHost.ts`,
  `PlinkoAztecMockSession.ts`, `plinkoAztecMockOptions.ts`, `betPerBallAmount.ts`, `selectionChange.ts`)
- Демо: `js/examples/demo-games/src/modes/plinko-aztec/`
