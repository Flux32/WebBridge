# Twist — JS

> Как подключить Twist к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas).
> Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```ts
import { createWebBoot, registerWebBoot, TwistBridge } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new TwistBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const game = new MyTotemGame(container);                // ваш движок
      bridge.spinResultReceived.add(async (spin) => {
        await game.playSpin(spin);                            // тотемы встали, поле показало progress
        bridge.notifySpinReady();
      });
      bridge.gameStateReceived.add((state) => game.showState(state)); // рестор, частичный кэшаут: без ответа
      bridge.restartRequested.add(async () => {
        await game.clearBoard();                              // полный кэшаут или конец серии
        bridge.notifySpinReady();
      });
      host.ready();                                           // игра принимает команды
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      bridge.start();                                         // спросить у хоста конфиг и состояние
      return game;
    },
    destroyGame: (game) => game.destroy(),
  }),
);
```

Купленную серию (`bonusStartRequested` + `freeGamesIntroFinished`) обрабатывает [полный пример](#полный-пример).

## Установка и точка входа

`TwistBridge` — в `@omega/webbridge-js` с версии **1.15.0** (протокол **1.17.0** и новее). Как поставить
пакет и собрать `game.js`, который загрузит шелл, — в [старте на JS](../../guides/getting-started-js.md).

Бандл регистрирует фабрику через `registerWebBoot`. Шелл вызывает её, передаёт свой хост и контейнер, а
дальше шлёт команды в `receive`. `createWebBoot` связывает это с мостом: события моста уходят в
`host.emit`, команды хоста — в `bridge.receive`.

Три обязательных шага после создания игры:

1. `host.ready()` — игра готова принимать команды. До этого шелл держит свой лоадер.
2. `bridge.setUiVisibility(…)` — шелл узнаёт, что мост поднят, по первому `UiVisibility`. Мост отвечает
   им и сам, на `SyncUiVisibility` хоста, но явный вызов задаёт видимость бет-бара.
3. `bridge.start()` — стартовая синхронизация: мост повторяет `RequestGameConfig` и `RequestGameState`
   каждые 500 мс, пока не придёт `ApplyGameConfig` (не больше 10 раз). С `?mock=1` мост не спрашивает:
   отвечает mock-хост.

## API `TwistBridge`

`TwistBridge extends BridgeBase`. Общие сигналы и методы (`fastGameChanged`, `cashoutPressed`,
`winWindowOpened`, `transitionScreen*`, `disabledPlayPressed`, `requestPlay`, звуки, `setUiVisibility`…) —
в [ядре JS-моста](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `spinResultReceived` | `unknown` — разобранный GameState | `ApplySpinResult`: спин живой сессии |
| `gameStateReceived` | `unknown` — разобранный GameState | `ApplyGameState`: рестор, частичный кэшаут, вывод бонуса сектора |
| `gameConfigReceived` | `unknown` — конфиг сервера как есть | `ApplyGameConfig` |
| `restartRequested` | `RestartRequest` — `{ reason, amount }` | `RestartRound`: `cashout` после полного кэшаута, `bonus` после серии |
| `autoplayChanged` | `boolean` | `SetAutoplay` |
| `bonusStartRequested` | `TwistBonusSeries` — `{ totalRounds, spins }`, спины уже разобраны из строк | `StartBonus` с серией twist |
| `freeGamesIntroFinished` | — | `FreeGamesIntroFinished`: можно крутить первый фри-спин |

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `start()` | `RequestGameConfig` + `RequestGameState` с повтором | один раз, когда сцена готова |
| `notifySpinReady()` | `SpinReady` | после спина и после очистки поля на `RestartRound`; **не** во фри-спинах |
| `notifyBonusActive()` | `BonusActive` | серия началась |
| `saveBonusProgress({ completedIterations, totalIterations })` | `BonusProgressSave` с этим JSON в `raw` | сразу после `notifyBonusActive()` (0) и после каждого фри-спина |
| `notifyBonusEnded()` | `BonusEnded` | последний фри-спин доигран — обязательно |
| `requestPlay()` | `RequestPlay` | тап по сцене вместо Play (из `BridgeBase`) |

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastGameState` | `unknown` | последний GameState — из `ApplyGameState` **или** `ApplySpinResult` |
| `lastGameConfig` | `unknown` | последний конфиг |

Типы `TwistBonusSeries` и `RestartRequest` экспортирует пакет.

Как мост разбирает команды:

- Payload'ы разбираются `JSON.parse` без проверки формы. Форма — у игры: демо читает её в `twistSpin.ts`
  и бросает `TwistStateError` на непонятном значении, а не рисует мусор.
- `RestartRound` делится по первому `|`: `"cashout|$3.90"` → `{ reason: 'cashout', amount: '$3.90' }`.
  Пустая сумма — пустая строка.
- `StartBonus` без массива `spins` — не серия twist: мост пишет предупреждение и сигнал не зовёт.
- `UpdateCoeffs` (лесенку road шлёт общая синхронизация хоста) мост молча игнорирует. Любая другая чужая
  команда — предупреждение `[TwistBridge] <type> does not belong to twist`. Предупреждения видны, только
  когда логи моста включены (`SetLoggingEnabled`, чит-панель).

## Полный пример

Контроллер раунда без движка: очередь команд, спин, рестарт, серия с защёлкой интро. Отрисовку
подставляет движок через `motions`. Это сокращённый `TwistController` демо-игры
(`js/examples/demo-games/src/modes/twist/`).

```ts
import {
  BridgeLogger,
  createWebBoot,
  registerWebBoot,
  TwistBridge,
  type RestartRequest,
  type TwistBonusSeries,
} from '@omega/webbridge-js';

type Sector = 'fire' | 'earth' | 'water';
type Outcome = Sector | 'air' | 'death';
type Progress = Readonly<Record<Sector, number>>;

interface TwistSpin {
  readonly outcome: Outcome;
  readonly progress: Progress;
  readonly isSessionFinished: boolean;
}

/** The engine's half. Every motion resolves `false` once the game was destroyed mid-motion. */
export interface TwistMotions {
  spin(outcome: Outcome): Promise<boolean>;
  fill(progress: Progress): Promise<boolean>;
  wipe(): Promise<boolean>;
  banner(text: string): void;
}

const OUTCOMES: readonly Outcome[] = ['fire', 'earth', 'water', 'air', 'death'];
const EMPTY: Progress = { fire: 0, earth: 0, water: 0 };

class TwistStateError extends Error {}

const recordOf = (raw: unknown, what: string): Record<string, unknown> => {
  if (typeof raw !== 'object' || raw === null) throw new TwistStateError(`${what} is not an object`);
  return raw as Record<string, unknown>;
};

/** Server numbers reach the game as numbers or as decimal strings. */
const readCells = (value: unknown, sector: Sector): number => {
  const cells = typeof value === 'string' ? Number(value) : value;
  if (typeof cells !== 'number' || !Number.isInteger(cells) || cells < 0) {
    throw new TwistStateError(`progress.${sector} is not a cell count: ${JSON.stringify(value)}`);
  }
  return cells;
};

const readProgress = (raw: unknown): Progress => {
  const progress = recordOf(raw, 'progress');
  return {
    fire: readCells(progress.fire, 'fire'),
    earth: readCells(progress.earth, 'earth'),
    water: readCells(progress.water, 'water'),
  };
};

const readSpin = (raw: unknown): TwistSpin => {
  const spin = recordOf(raw, 'spin');
  const outcome = OUTCOMES.find((candidate) => candidate === spin.outcome);
  if (outcome === undefined) throw new TwistStateError(`unknown outcome ${JSON.stringify(spin.outcome)}`);
  return { outcome, progress: readProgress(spin.progress), isSessionFinished: spin.sessionIsFinished === true };
};

/** A closed session's progress is a leftover: the board is empty. */
const readBoard = (raw: unknown): Progress => {
  const state = recordOf(raw, 'game state');
  return state.sessionIsFinished === true || state.progress === undefined ? EMPTY : readProgress(state.progress);
};

/** Plays the host's commands one after another: a restart waits for the spin in flight to land. */
class MoveQueue {
  private tail: Promise<void> = Promise.resolve();
  private isClosed = false;

  public enqueue(move: () => Promise<boolean>): void {
    this.tail = this.tail.then(async () => {
      if (this.isClosed) return;
      if (!(await move())) this.isClosed = true;
    });
  }

  public close(): void {
    this.isClosed = true;
  }
}

/** `FreeGamesIntroFinished` may land while the series still waits in the queue: a latch, not an event. */
class IntroLatch {
  private isOpen = false;
  private readonly waiters: ((isOpened: boolean) => void)[] = [];

  public open(): void {
    this.isOpen = true;
    this.waiters.splice(0).forEach((resolve) => resolve(true));
  }

  public wait(): Promise<boolean> {
    if (this.isOpen) return Promise.resolve(true);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  public rearm(): void {
    this.isOpen = false;
  }

  public close(): void {
    this.waiters.splice(0).forEach((resolve) => resolve(false));
  }
}

export class TwistRound {
  private readonly queue = new MoveQueue();
  private readonly intro = new IntroLatch();
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: TwistBridge,
    private readonly motions: TwistMotions,
  ) {
    this.unsubscribers = [
      bridge.gameStateReceived.add((state) => this.play('ApplyGameState', () => this.motions.fill(readBoard(state)))),
      bridge.spinResultReceived.add((spin) => this.play('ApplySpinResult', () => this.playSpin(readSpin(spin)))),
      bridge.restartRequested.add((request) => this.play('RestartRound', () => this.restart(request))),
      bridge.bonusStartRequested.add((series) => this.play('StartBonus', () => this.playSeries(series))),
      bridge.freeGamesIntroFinished.add(() => this.intro.open()),
    ];
  }

  public destroy(): void {
    this.queue.close();
    this.intro.close();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private async playSpin(spin: TwistSpin): Promise<boolean> {
    if (!(await this.motions.spin(spin.outcome))) return false;
    const isShown = spin.outcome === 'death'
      ? await this.motions.wipe()
      : await this.motions.fill(spin.isSessionFinished ? EMPTY : spin.progress);
    if (!isShown) return false;
    this.bridge.notifySpinReady();
    return true;
  }

  private async restart({ reason, amount }: RestartRequest): Promise<boolean> {
    if (amount !== '') this.motions.banner(`${reason} ${amount}`);
    if (!(await this.motions.fill(EMPTY))) return false;
    this.bridge.notifySpinReady();
    return true;
  }

  /** Free spins are never reported by SpinReady: the host would unlock the bar mid-series. */
  private async playSeries(series: TwistBonusSeries): Promise<boolean> {
    const spins = series.spins.map(readSpin);
    const total = Math.max(series.totalRounds, spins.length);
    this.bridge.notifyBonusActive();
    this.bridge.saveBonusProgress({ completedIterations: 0, totalIterations: total });
    if (!(await this.intro.wait())) return false;
    this.intro.rearm();
    for (const [index, spin] of spins.entries()) {
      if (!(await this.motions.spin(spin.outcome))) return false;
      if (!(await this.motions.fill(spin.progress))) return false;
      this.bridge.saveBonusProgress({ completedIterations: index + 1, totalIterations: total });
    }
    this.bridge.notifyBonusEnded();
    return true;
  }

  /** The boundary of a command: a payload the scene cannot show truthfully is logged and left unanswered. */
  private play(command: string, move: () => Promise<boolean>): void {
    this.queue.enqueue(async () => {
      try {
        return await move();
      } catch (error) {
        if (!(error instanceof TwistStateError)) throw error;
        BridgeLogger.error(`[twist] ${command} rejected: ${error.message}`);
        this.motions.banner(error.message);
        return true;
      }
    });
  }
}

/** The engine's scene (Phaser, Pixi, three.js…): it draws the totems and the board. */
declare class MyTotemScene implements TwistMotions {
  public constructor(container: HTMLElement, devicePixelRatio?: number);
  public spin(outcome: Outcome): Promise<boolean>;
  public fill(progress: Progress): Promise<boolean>;
  public wipe(): Promise<boolean>;
  public banner(text: string): void;
  public destroy(): void;
}

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new TwistBridge(transport),
    createGame: (bridge, container, options, host) => {
      const scene = new MyTotemScene(container, options.devicePixelRatio);
      const round = new TwistRound(bridge, scene);
      host.ready();
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      bridge.start();
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

- `SpinReady` уходит только после `await` анимации — никогда синхронно внутри `receive()`.
- Сломанный payload не роняет очередь: ошибка в логе и на сцене, `SpinReady` не уходит, бар остаётся
  залоченным, и это видно.
- Движение, вернувшее `false`, значит «игру уничтожили»: очередь закрывается, больше ничего не шлётся.

## Mock-хост: игра без шелла

**В пакете mock-хоста для twist нет.** Он есть в демо-игре: `TwistMockHost` + `TwistMockSession`
(`js/examples/demo-games/src/modes/twist/`). Отвечает как шелл:

| Действие | Клавиша | Что шлёт игре |
|---|---|---|
| спин | Space | `ApplySpinResult` с сырым ответом (веса исходов: fire 0.18, earth 0.22, water 0.26, air 0.24, death 0.07) |
| частичный кэшаут | P | `ApplyGameState` с полем без верхних делений (когда в каком-то секторе ≥ 2) |
| полный кэшаут | C | `RestartRound "cashout|$<сумма>"` |
| купить серию | B | `StartBonus` из 6 фри-спинов, через 1,2 с — `FreeGamesIntroFinished` |

На `SpinReady` мок открывает «бар» и, если сектор заполнен до бонуса, сам присылает `ApplyGameState` с
пустым сектором — как хост. На `BonusEnded` через 0,9 с — `RestartRound "bonus|$<сумма>"`. Пока игра не
ответила, новый спин мок не делает, а `RequestPlay` получает `DisabledPlayPressed`: молчащая игра залипает
так же, как в шелле. Суммы иллюстративные, ставка 1.

Запустить демо:

```bash
npm install                                               # в корне репозитория, один раз
DEMO_MODE=twist npm run dev -w js/examples/demo-games     # http://localhost:5193/?mock=1
```

В своей игре — скопировать `TwistMockHost.ts`, `twistMockSession.ts` и `twistTable.ts` (и тип
`TwistOutcome` из `twistSpin.ts`) и подключить так же, как моки пакета:

```ts
import { createWebBoot, isMockEnabled, registerWebBoot } from '@omega/webbridge-js';
import { TwistMockHost } from './dev/TwistMockHost';           // копия из demo-games

const boot = createWebBoot({ /* createBridge, createGame, destroyGame — как выше */ });

if (isMockEnabled()) {                                         // страница открыта с ?mock=1
  const host = new TwistMockHost();
  host.attach(boot(host, document.getElementById('game')!));
  host.bindKeys();
} else {
  registerWebBoot(boot);
}
```

Mock-хост подключается к игре после `boot(…)`. Демо поэтому зовёт `host.ready()`, `setUiVisibility` и
`start()` через `setTimeout(…, 0)`, а не прямо в `createGame`. Подробнее — в
[mock-режиме](../../concepts/mock-mode.md).

## Проверка

1. **Mock.** `?mock=1`: спин → `SpinReady` (мок снова принимает спин), смерть → пустое поле, P и C,
   серия B: первый фри-спин стартует только после интро, счётчик доходит до конца, после `BonusEnded`
   приходит рестарт.
2. **Логи моста.** Включить `SetLoggingEnabled` (чит-панель шелла). Предупреждение
   `does not belong to twist` на чём-то, кроме служебных команд, — повод проверить версию пакета.
3. **Шелл локально.** Без `?mock` dev-сервер отдаёт `/game.js`. Открыть стенд с
   `?localBuild=http://localhost:<порт>` (плагин `localBuildServer` с `mode: 'twist'`). Проверить:
   бар оживает только после посадки тотемов; CASHOUT и PART CASHOUT показывают суммы после посадки, а не
   раньше; PART CASHOUT меняет поле без спина.
4. **Стенд конфигуратора.** Игра режима `twist`; для покупки бонуса — включённый бонус-режим
   (`twist-san-quentin`). Купить серию, перезагрузить страницу посреди неё: серия доигрывается с того же
   спина, итог показан один раз.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бар не оживает после спина | `notifySpinReady()` не позван, или позван до `await` анимации и потерялся в исключении | слать после посадки тотемов, по одному на `ApplySpinResult` |
| Бар не оживает после кэшаута | на `RestartRound` не прислан `SpinReady` | очистить поле и позвать `notifySpinReady()` |
| Бар ожил посреди серии | `notifySpinReady()` во фри-спине | во фри-спинах — только `saveBonusProgress` |
| Серия не заканчивается, итога нет | нет `notifyBonusEnded()` | звать после последнего фри-спина, всегда |
| Тотемы крутятся под иконкой фри-спинов | первый спин не ждёт `freeGamesIntroFinished` | защёлка интро, как `IntroLatch` |
| Серия зависла на старте | `freeGamesIntroFinished` пришёл раньше, чем игра начала ждать | защёлка, а не подписка «на следующий раз» |
| Поле пустеет после частичного кэшаута | игра сбросила поле на `isFinished: true` | живость — только `sessionIsFinished` |
| Поле разъехалось с суммой CASHOUT | игра прибавляет деления сама | рисовать `progress` из ответа |
| `JSON.parse` падает на спине серии | спины разобраны дважды | `bonusStartRequested` отдаёт спины уже объектами |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `js/webbridge/src/twist/TwistBridge.ts`, тесты `js/webbridge/test/TwistBridge.test.ts`,
  демо `js/examples/demo-games/src/modes/twist/`
