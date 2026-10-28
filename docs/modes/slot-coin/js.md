# Slot Coin — JS

> Как подключить Slot Coin к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas).
> Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```ts
import { createWebBoot, registerWebBoot, SlotCoinBridge } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new SlotCoinBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const game = new MySlotGame(container);                // ваш движок
      bridge.spinResultReceived.add(async (result) => {
        for (const [index, board] of result.boards.entries()) {
          await game.playBoard(board, result.actions[index] ?? []); // доски по порядку
        }
        bridge.notifySpinReady();                            // ровно один раз, после последней
      });
      host.ready();                                          // игра принимает команды
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      return game;
    },
    destroyGame: (game) => game.destroy(),
  }),
);
```

## Установка и точка входа

`SlotCoinBridge` и `SlotCoinMockHost` — в `@omega/webbridge-js` с версии **1.15.0** (протокол **1.17.0** и
новее). Как поставить пакет и собрать `game.js`, который загрузит шелл, — в
[старте на JS](../../guides/getting-started-js.md).

Бандл регистрирует фабрику через `registerWebBoot`. Шелл вызывает её, передаёт свой хост и контейнер, а
дальше шлёт команды в `receive`. `createWebBoot` связывает это с мостом.

После создания игры:

1. `host.ready()` — игра готова принимать команды. До этого шелл держит свой лоадер.
2. `bridge.setUiVisibility(…)` — видимость бет-бара; первое `UiVisibility` шелл считает сигналом «мост
   поднят».
3. `bridge.start()` — **по желанию.** Барабану между спинами хранить нечего, поэтому стартовая
   синхронизация нужна только сцене, которой нужен конфиг. Мост повторяет `RequestGameConfig` и
   `RequestGameState` каждые 500 мс, пока не придёт `ApplyGameConfig`, но не больше 10 раз. Хост slot-coin
   конфиг шлёт не всегда (см. [команды](README.md#команды-хоста--игра)), и тогда мост просто перестаёт
   спрашивать через 5 с.

Прежние имена — `SlotBridge`, `SlotMockHost`, `SlotMockHostOptions` — остаются `@deprecated`-синонимами:
`SlotBridge === SlotCoinBridge`. Новый код пишется на `SlotCoin*`.

## API `SlotCoinBridge`

`SlotCoinBridge extends BridgeBase`. Общие сигналы и методы (`fastGameChanged`, `disabledPlayPressed`,
`requestPlay`, звуки, `setUiVisibility`…) — в [ядре JS-моста](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `spinResultReceived` | `SlotCoinSpinResult` | `ApplySpinResult`: весь раунд, бонусные доски включительно |
| `gameConfigReceived` | `unknown` | `ApplyGameConfig` |
| `gameStateReceived` | `unknown` | `ApplyGameState` — от mock-хоста; настоящий хост slot-coin его не шлёт |

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `notifySpinReady()` | `SpinReady` | после последней доски `ApplySpinResult` — ровно один раз |
| `start()` | `RequestGameConfig` + `RequestGameState` с повтором | один раз, если сцене нужен конфиг |
| `requestPlay()` | `RequestPlay` | тап по сцене вместо Play (из `BridgeBase`) |

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastSpinResult` | `SlotCoinSpinResult \| null` | последний раунд |
| `lastGameConfig` | `unknown` | последний конфиг |
| `lastGameState` | `unknown` | последнее состояние |

Как мост разбирает команды:

- `ApplySpinResult` — `JSON.parse` с приведением к `SlotCoinSpinResult`, без проверки формы. Хост уже
  проверил ответ на границе, но доски и действия игра всё равно читает сама: символ — по таблице,
  индексы — в пределах доски, числа — из строк.
- Любая другая команда режима (`UpdateCoeffs`, `SetAutoplay` из общей синхронизации хоста) уходит в
  предупреждение `[SlotCoinBridge] <type> не относится к slot-coin`. Это безвредно: предупреждения видны
  только при включённых логах моста (`SetLoggingEnabled`).

## Полный пример

Контроллер раунда без движка: очередь раундов, проверка досок, сбор монет, один `SpinReady` в конце.
Отрисовку подставляет движок через `motions`. Это сокращённые `SlotCoinController` и `slotCoinRound.ts`
демо-игры (`js/examples/demo-games/src/modes/slot-coin/`).

```ts
import { BridgeLogger, createWebBoot, registerWebBoot, SlotCoinBridge } from '@omega/webbridge-js';
import { SLOT_COIN_ACTIONS, type SlotCoinAction, type SlotCoinSpinResult } from '@omega/webbridge-protocol';

/** The cabinet's shape: the payload does not carry it. */
const REELS = 3;
const ROWS = 4;
const CELL_COUNT = REELS * ROWS;
/** A symbol is a key, not a number: `0`…`9`, then `a`…`m`. */
const ALPHABET = new Set('0123456789abcdefghijklm');

export interface CoinCollection {
  readonly triggerIndex: number;
  readonly coinIndexes: readonly number[];
}

export interface BoardPlan {
  readonly cells: readonly string[];
  readonly collection: CoinCollection | null;
}

/** The engine's half. Every motion resolves `false` once the game was destroyed mid-motion. */
export interface SlotCoinMotions {
  spin(board: BoardPlan): Promise<boolean>;
  collect(collection: CoinCollection): Promise<boolean>;
  showResult(text: string): void;
}

class SlotCoinRoundError extends Error {}

const readIndex = (value: unknown, field: string): number => {
  const index = typeof value === 'string' ? Number(value) : value;
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    throw new SlotCoinRoundError(`${field} ${JSON.stringify(value)} is off the ${REELS}x${ROWS} board`);
  }
  return index;
};

const readCells = (board: string, boardNumber: number): readonly string[] => {
  if (board.length !== CELL_COUNT) throw new SlotCoinRoundError(`board ${boardNumber} has ${board.length} cells`);
  const cells = [...board];
  const unknown = cells.find((code) => !ALPHABET.has(code));
  if (unknown !== undefined) throw new SlotCoinRoundError(`board ${boardNumber} holds unknown symbol "${unknown}"`);
  return cells;
};

/** Only the coin collection is drawn here; the action list is open, so other actions are passed over. */
const readCollection = (actions: readonly SlotCoinAction[]): CoinCollection | null => {
  const action = actions.find((candidate) => candidate.action === SLOT_COIN_ACTIONS.strikeCoinsCollection);
  if (action === undefined) return null;
  if (!Array.isArray(action.coins)) throw new SlotCoinRoundError('coin collection without a coins list');
  return {
    triggerIndex: readIndex(action.triggerIndex, 'trigger index'),
    coinIndexes: action.coins.map((coin: unknown) => readIndex((coin as { index?: unknown }).index, 'coin index')),
  };
};

const planRound = (result: SlotCoinSpinResult): readonly BoardPlan[] => {
  if (result.boards.length === 0) throw new SlotCoinRoundError('round without boards');
  return result.boards.map((board, index) => ({
    cells: readCells(board, index + 1),
    collection: readCollection(result.actions[index] ?? []),
  }));
};

export class SlotCoinRound {
  private tail: Promise<void> = Promise.resolve();
  private isClosed = false;
  private readonly unsubscribe: () => void;

  public constructor(
    private readonly bridge: SlotCoinBridge,
    private readonly motions: SlotCoinMotions,
  ) {
    this.unsubscribe = bridge.spinResultReceived.add((result) => {
      this.tail = this.tail.then(() => this.play(result));
    });
  }

  public destroy(): void {
    this.isClosed = true;
    this.unsubscribe();
  }

  private async play(result: SlotCoinSpinResult): Promise<void> {
    if (this.isClosed) return;
    const boards = this.plan(result);
    if (boards === null) return;
    for (const board of boards) {
      if (!(await this.playBoard(board))) {
        this.isClosed = true;
        return;
      }
    }
    this.motions.showResult(Number(result.winAmount) > 0 ? `Won ${result.winAmount} ${result.currency}` : 'No win');
    this.bridge.notifySpinReady();
  }

  private async playBoard(board: BoardPlan): Promise<boolean> {
    if (!(await this.motions.spin(board))) return false;
    return board.collection === null || this.motions.collect(board.collection);
  }

  /** A round the scene cannot draw truthfully is shown as broken: no SpinReady, the bar stays locked, in sight. */
  private plan(result: SlotCoinSpinResult): readonly BoardPlan[] | null {
    try {
      return planRound(result);
    } catch (error) {
      if (!(error instanceof SlotCoinRoundError)) throw error;
      BridgeLogger.error(`[slot-coin] ApplySpinResult rejected: ${error.message}`);
      this.motions.showResult(error.message);
      return null;
    }
  }
}

/** The engine's scene (Phaser, Pixi, three.js…): it draws the reels and the coins. */
declare class MySlotScene implements SlotCoinMotions {
  public constructor(container: HTMLElement, devicePixelRatio?: number);
  public spin(board: BoardPlan): Promise<boolean>;
  public collect(collection: CoinCollection): Promise<boolean>;
  public showResult(text: string): void;
  public destroy(): void;
}

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new SlotCoinBridge(transport),
    createGame: (bridge, container, options, host) => {
      const scene = new MySlotScene(container, options.devicePixelRatio);
      const round = new SlotCoinRound(bridge, scene);
      host.ready();
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      return { scene, round };
    },
    destroyGame: ({ scene, round }) => {
      round.destroy();
      scene.destroy();
    },
  }),
);
```

Что здесь важно:

- `SpinReady` уходит только после `await` последней анимации — никогда синхронно внутри `receive()`.
- Раунды стоят в очереди: новый `ApplySpinResult` не перебивает доигрывающий.
- `actions[index] ?? []` — массив действий бывает короче досок.

## Mock-хост: игра без шелла

`SlotCoinMockHost` встаёт на место шелла. Игра идёт по настоящему пути: та же фабрика, тот же мост, те же
команды. Доски генерируются **настоящим алфавитом** бэка: мок с выдуманными символами не поймал бы ошибку
разбора доски.

```ts
import { createWebBoot, isMockEnabled, registerWebBoot, SlotCoinMockHost } from '@omega/webbridge-js';

const boot = createWebBoot({ /* createBridge, createGame, destroyGame — как выше */ });

if (isMockEnabled()) {                                   // страница открыта с ?mock=1
  const host = new SlotCoinMockHost({ jackpotChance: 0.3 });
  host.attach(boot(host, document.getElementById('game')!));
  host.bindKeys();
} else {
  registerWebBoot(boot);
}
```

### Опции `SlotCoinMockHostOptions`

Все поля необязательны (`Partial<SlotCoinMockHostOptions>`).

| Опция | По умолчанию | Что задаёт |
|---|---|---|
| `reels` | `3` | барабанов |
| `rows` | `4` | символов на барабане |
| `coinChance` | `0.35` | доля ячеек крайних барабанов под монетами |
| `collectChance` | `0.45` | вероятность, что спин закончится сбором монет |
| `jackpotChance` | `0.12` | вероятность джекпот-медальона вместо монеты |
| `currency` | `'USD'` | валюта в конфиге и в ответе |
| `betAmount` | `1` | ставка, от которой считаются иллюстративные суммы |

### Что мок делает

| Метод / клавиша | Что шлёт игре |
|---|---|
| `spin()` · Space | одна доска; со сбором — с вероятностью `collectChance` |
| `spinWithCollect()` · C | одна доска, гарантированно со сбором |
| `spinBonusRound(boards = 3)` · B | несколько досок (не меньше двух), сбор — на последней |
| `bindKeys(target = window)` | вешает клавиши, возвращает функцию снятия |

- На `RequestGameConfig` — `ApplyGameConfig {"currency":"USD"}`, на `RequestGameState` — `ApplyGameState
  {"status":"none"}`, на `RequestWhiteLabel` / `RequestFastGame` — `false`.
- Пока игра не прислала `SpinReady`, мок занят: новые спины игнорирует, а `RequestPlay` получает
  `DisabledPlayPressed` — как бар шелла. Игра, которая молчит, залипает и в моке.
- Триггер ставится в середину среднего барабана (`triggerIndex = 6` для 3 × 4), сбор берёт все монеты и
  джекпоты доски.
- Суммы (`coeff`, `winAmount`) — сумма коэффициентов собранных монет × ставка. Это иллюстрация, а не
  второй источник истины по выплатам.

Демо — с тем же моком:

```bash
npm install                                                 # в корне репозитория, один раз
DEMO_MODE=slot-coin npm run dev -w js/examples/demo-games   # http://localhost:5194/?mock=1
```

Подробнее — в [mock-режиме](../../concepts/mock-mode.md).

## Проверка

1. **Mock.** `?mock=1`: Space — один `SpinReady` на спин; B — доски идут по очереди, `SpinReady` один, в
   конце; повторное нажатие Space во время вращения ничего не делает.
2. **Логи моста.** `SetLoggingEnabled` (чит-панель шелла): предупреждения про `UpdateCoeffs` и
   `SetAutoplay` ожидаемы, про `ApplySpinResult` — нет.
3. **Шелл локально.** Без `?mock` dev-сервер отдаёт `/game.js`. Открыть стенд с
   `?localBuild=http://localhost:<порт>` (плагин `localBuildServer` с `mode: 'slot-coin'`). Проверить: бар
   оживает только после последней доски; автоплей идёт спин за спином и останавливается кнопкой.
4. **Стенд конфигуратора.** Игра режима `slot-coin` (бэкенд `chicken-coin`). Старые ссылки с
   `gameCategory=slot` открывают тот же режим.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бар не оживает после спина | `notifySpinReady()` не позван или упал до него | звать после последней доски, в одном месте |
| Бар ожил посреди бонусных досок | `notifySpinReady()` на каждой доске | один раз на `ApplySpinResult` |
| Доска нарисована мусором | символы разобраны как числа (`parseInt`) | символ — ключ таблицы, `a`…`m` не числа |
| Монеты летят не из тех ячеек | индекс считан по строкам | доска по барабанам: `reel * 4 + row` |
| `TypeError` на `actions[i]` | действий меньше, чем досок | `result.actions[i] ?? []` |
| Раунд падает на новом действии сервера | неизвестный `action` считается ошибкой | пропускать: список открыт |
| После спина открылась шторка перехода | игра шлёт `BonusActive` / `BonusEnded` | у slot-coin событий бонуса нет |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `js/webbridge/src/slot-coin/` (`SlotCoinBridge.ts`, `SlotCoinMockHost.ts`, `legacySlotNames.ts`),
  тест `js/webbridge/test/legacySlotNames.test.ts`, демо `js/examples/demo-games/src/modes/slot-coin/`
