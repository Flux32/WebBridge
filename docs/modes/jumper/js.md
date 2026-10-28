# Jumper — JS

> Как подключить режим jumper к веб-игре на любом JS-движке: Phaser, Pixi, three.js, Canvas.
> Контракт режима — что значат команды и события и в каком порядке они идут — описан в [обзоре](README.md).

## Коротко

```ts
import { createWebBoot, JumperBridge, registerWebBoot } from '@omega/webbridge-js';
import { createLadderGame } from './ladderGame'; // your renderer: jump(), reset(), destroy()

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new JumperBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const game = createLadderGame(container);
      bridge.moveReceived.add((move) => {
        if (move.move !== 'step') return; // play and payout get no SpinReady
        void game.jump(move).then(() => bridge.notifySpinReady());
      });
      bridge.restartRequested.add(() => {
        game.reset();
        bridge.notifySpinReady(); // the host keeps the bet bar locked until this
      });
      bridge.start();
      requestAnimationFrame(() => host.ready());
      return game;
    },
    destroyGame: (game) => game.destroy(),
  }),
);
```

Два обязательных ответа: `notifySpinReady()` после каждого доигранного прыжка и после сброса сцены на
`RestartRound`. Без них бет-бар хоста не разблокируется.

## Установка и точка входа

Мост — пакет `@omega/webbridge-js` (типы — `@omega/webbridge-protocol`). Как поставить пакет, собрать бандл
`game.js` и запустить его в шелле, описано в [старте на JS](../../guides/getting-started-js.md). Здесь — только то,
что нужно jumper:

- `createWebBoot({ createBridge, createGame, destroyGame })` собирает фабрику игры, а `registerWebBoot(boot)`
  отдаёт её шеллу (`window.__WEB_GAME_BOOT__`).
- В `createBridge` создать `new JumperBridge(transport)`.
- В `createGame` подписаться на сигналы моста и вызвать `bridge.start()`: он запросит конфиг и состояние с
  ретраями, 10 раз через 0,5 с. Когда игра реально готова принимать команды, вызвать `host.ready()`. Делать это на
  первом кадре, а не синхронно в `createGame`: mock-хост привязывается к игре только после возврата из фабрики.
- На `SyncUiVisibility` `BridgeBase` отвечает сам. Чтобы задать видимость бет-баров, вызвать
  `bridge.setUiVisibility({...})`: первый `UiVisibility` хост считает признаком того, что мост жив.

Как команды доходят до игры: `ApplyGameConfig` и `ApplyGameState` — JSON-строки, мост разбирает их сам.
`ApplyJumperMove` и `StartBonus` приходят объектами, `SetAutoplay` — `boolean`, `SetJumperDifficulty` — строкой.
Сигналы моста всегда отдают уже разобранные типизированные значения.

## API `JumperBridge`

`JumperBridge extends BridgeBase`, исходник — `js/webbridge/src/jumper/JumperBridge.ts`. Общие сигналы и методы
базы — `cashoutPressed`, `disabledPlayPressed`, `winWindowOpened` / `winWindowClosed`, `transitionScreen*`,
`fastGameChanged`, `requestPlay()`, `setUiVisibility()`, `playSound()` и т. д. — описаны в
[ядре JS-моста](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `gameConfigReceived` | `JumperGameConfigPayload` | `ApplyGameConfig`: лесенки всех сложностей |
| `difficultyChanged` | `JumperDifficulty` | `SetJumperDifficulty`. Срабатывает на **каждую** команду, в том числе с той же сложностью: хост повторяет её при ресинке и восстановлении сессии |
| `gameStateReceived` | `JumperRoundState` | `ApplyGameState`: поставить сцену в раунд, без анимации и без `SpinReady` |
| `moveReceived` | `JumperMovePayload` | `ApplyJumperMove`: живой ход `play` / `step` / `payout` |
| `restartRequested` | `RestartRequest` — `{ reason, amount }` | `RestartRound "<reason>\|<amount>"`, разобранный по первой `\|`: `{ reason: 'lose', amount: '' }`, `{ reason: 'cashout', amount: '$2.47' }` |
| `autoplayChanged` | `boolean` | `SetAutoplay`. Срабатывает на каждую команду, без сравнения с прошлым значением |
| `bonusStartRequested` | `JumperStartBonusPayload` | `StartBonus` с серией jumper. Payload без `games` и `totalCoefficient` (бонус другого режима) — предупреждение в лог, сигнал не срабатывает |

Команда другого режима, например `ApplyBonusPurchaseResult`, сигналов не поднимает: мост пишет в лог
`[JumperBridge] <type> does not belong to jumper`.

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `start()` | `RequestGameConfig` + `RequestGameState` с ретраями до конфига | Один раз, когда сцена готова принимать данные. В mock-режиме (`?mock=1`) ретраев нет: данные пушит mock-хост по `host.ready()` |
| `notifySpinReady()` | `SpinReady` | Прыжок `step` доигран (приземление или падение). И сцена сброшена после `RestartRound` |
| `notifyBonusActive()` | `BonusActive` | Серия начала играть |
| `saveBonusProgress(progress)` | `BonusProgressSave` с `JSON.stringify(progress)` | После каждого фри-гейма. Передавать ровно `{ completedIterations, totalIterations }`: другую форму хост не примет |
| `notifyBonusEnded()` | `BonusEnded` | Последний фри-гейм доигран |
| `requestPlay()` (база) | `RequestPlay` | Тап по сцене. Хост ответит ходом или `DisabledPlayPressed` |
| `requestGameConfig()` / `requestGameState()` | `RequestGameConfig` / `RequestGameState` | Переспросить вручную. Обычно хватает `start()` |

### Состояние

Значения сохраняются в мосте до подписки, так что подписчик, поднятый позже, их не теряет.

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastGameConfig` | `JumperGameConfigPayload \| null` | Последний конфиг |
| `lastDifficulty` | `JumperDifficulty \| null` | Последняя сложность. `null`, пока хост её не прислал |
| `lastGameState` | `JumperRoundState \| null` | Последний раунд: из `ApplyGameState` или из последнего `ApplyJumperMove` |

## Полный пример

Игра целиком: очередь ходов, прыжок по цепочке, падение, перезапуск, бонус и восстановление. Вид — интерфейс
`LadderView`, его реализует рендерер игры (Canvas, Phaser-сцена, Pixi-контейнер). Каждое движение возвращает
`Promise<boolean>`: `false` значит, что движение оборвано (игру уничтожили) и дальше ничего не шлётся. Код
следует демо-игре `js/examples/demo-games/src/modes/jumper`.

```ts
// jumperGame.ts
import type { JumperBridge, RestartRequest } from '@omega/webbridge-js';
import {
  JUMPER_START_STEP,
  type JumperBonusGame,
  type JumperDifficulty,
  type JumperGameConfigPayload,
  type JumperLadder,
  type JumperMovePayload,
  type JumperRoundState,
  type JumperStartBonusPayload,
} from '@omega/webbridge-protocol';

/** What the renderer does. A motion resolves `false` when it was cut short: the game is being destroyed. */
export interface LadderView {
  showLadder(ladder: JumperLadder): void;
  /** Slots, coefficient and win of a round as the host describes it. */
  showRound(round: JumperRoundState): void;
  place(step: number): void;
  jump(waypoints: readonly number[]): Promise<boolean>;
  fall(): Promise<boolean>;
  reset(caption: string): void;
  shake(): void;
  destroy(): void;
}

const withoutRepeats = (steps: readonly number[]): number[] =>
  steps.filter((step, index) => index === 0 || step !== steps[index - 1]);

/** The aimed step, every accelerator, the landing. A lost round's landingStep is the chain's aim: cut it at the fall. */
export const jumpWaypoints = (round: JumperRoundState): number[] => {
  const chain = withoutRepeats([round.lineNumber, ...round.visitedSteps.map((visited) => visited.step), round.landingStep]);
  const fall = round.collisionPosition;
  if (round.status !== 'lose' || fall === undefined) return chain;
  return [...chain.filter((step) => step < fall), fall];
};

/** A free game from step 0: every platform jumped from, then the final step. */
export const freeGameWaypoints = (game: JumperBonusGame): number[] =>
  withoutRepeats([...game.route.map((point) => point.step), game.finalStep]);

export class JumperGame {
  private queue: Promise<void> = Promise.resolve();
  private isDestroyed = false;
  private config: JumperGameConfigPayload | null;
  private difficulty: JumperDifficulty | null;
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: JumperBridge,
    private readonly view: LadderView,
    private readonly tapTarget: HTMLElement,
  ) {
    this.config = bridge.lastGameConfig;
    this.difficulty = bridge.lastDifficulty;
    this.unsubscribers = [
      bridge.gameConfigReceived.add((config) => this.showLadder(config, this.difficulty)),
      bridge.difficultyChanged.add((difficulty) => this.showLadder(this.config, difficulty)),
      bridge.gameStateReceived.add((state) => this.enqueue(async () => this.restore(state))),
      bridge.moveReceived.add((move) => this.enqueue(() => this.playMove(move))),
      bridge.restartRequested.add((request) => this.enqueue(async () => this.restart(request))),
      bridge.bonusStartRequested.add((bonus) => this.enqueue(() => this.playBonus(bonus))),
      bridge.disabledPlayPressed.add(() => view.shake()),
    ];
    tapTarget.addEventListener('pointerdown', this.onTap);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.tapTarget.removeEventListener('pointerdown', this.onTap);
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.view.destroy();
  }

  private readonly onTap = (): void => this.bridge.requestPlay();

  /** Host commands play one after another: a move never tears the scene from under the previous one. */
  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue
      .then(async () => {
        if (!this.isDestroyed) await task();
      })
      .catch((error: unknown) => console.error('[jumper] a move failed', error));
  }

  /** The host sends the ladders before the difficulty, the mock hosts after it: draw once both are known. */
  private showLadder(config: JumperGameConfigPayload | null, difficulty: JumperDifficulty | null): void {
    this.config = config;
    this.difficulty = difficulty;
    const ladder = config?.ladders.find((entry) => entry.difficulty === difficulty);
    if (ladder !== undefined) this.view.showLadder(ladder);
  }

  private restore(state: JumperRoundState): void {
    if (state.status === 'none') {
      this.view.reset('');
      this.view.place(JUMPER_START_STEP);
      return;
    }
    this.view.showRound(state);
    this.view.place(state.status === 'lose' ? (state.collisionPosition ?? state.landingStep) : state.landingStep);
  }

  private async playMove(move: JumperMovePayload): Promise<void> {
    switch (move.move) {
      case 'play': // the round is open, every slot HIDDEN; no SpinReady — the first jump follows at once
        this.view.showRound(move);
        this.view.place(JUMPER_START_STEP);
        return;
      case 'step':
        await this.playJump(move);
        return;
      case 'payout': // cashed out: collisionPosition shows where the player would have fallen; wait for RestartRound
        this.view.showRound(move);
        return;
    }
  }

  private async playJump(move: JumperMovePayload): Promise<void> {
    if (!(await this.view.jump(jumpWaypoints(move)))) return;
    if (move.status === 'lose' && !(await this.view.fall())) return;
    this.view.showRound(move); // the coefficient shows only now: the host reveals the win on SpinReady
    this.bridge.notifySpinReady();
  }

  private restart({ reason, amount }: RestartRequest): void {
    this.view.reset(amount === '' ? reason : `${reason} ${amount}`); // amount is the host's display string
    this.view.place(JUMPER_START_STEP);
    this.bridge.notifySpinReady();
  }

  private async playBonus(bonus: JumperStartBonusPayload): Promise<void> {
    this.bridge.notifyBonusActive();
    const totalIterations = bonus.games.length;
    for (const [index, game] of bonus.games.entries()) {
      this.view.place(JUMPER_START_STEP);
      if (!(await this.view.jump(freeGameWaypoints(game)))) return;
      this.bridge.saveBonusProgress({ completedIterations: index + 1, totalIterations });
    }
    this.view.reset(`x${bonus.totalCoefficient} · ${bonus.totalWin} ${bonus.currency}`);
    this.bridge.notifyBonusEnded();
  }
}
```

```ts
// boot.ts — the bundle entry: the shell's game.js, or the same game against JumperMockHost with ?mock=1
import { createWebBoot, isMockEnabled, JumperBridge, JumperMockHost, registerWebBoot } from '@omega/webbridge-js';
import { createCanvasLadderView } from './canvasLadderView'; // implements LadderView
import { JumperGame } from './jumperGame';

const boot = createWebBoot({
  createBridge: (transport) => new JumperBridge(transport),
  createGame: (bridge, container, options, host) => {
    const game = new JumperGame(bridge, createCanvasLadderView(container, options.devicePixelRatio), container);
    bridge.setUiVisibility({
      hideDesktopBetBar: false,
      hideMobileBetBar: false,
      desktopBetBarInteractable: true,
      mobileBetBarInteractable: true,
    });
    bridge.start();
    requestAnimationFrame(() => host.ready()); // by then a mock host has attached to the returned game
    return game;
  },
  destroyGame: (game) => game.destroy(),
});

if (isMockEnabled()) {
  const container = document.getElementById('game');
  if (container === null) throw new Error('[jumper] index.html lacks #game');
  const host = new JumperMockHost();
  host.attach(boot(host, container));
  host.bindKeys();
} else {
  registerWebBoot(boot);
}
```

Почему так:

- **Очередь.** `play` и первый `step` приходят подряд, а `RestartRound` может прийти, пока прыжок ещё доигрывает
  свой хвост. Очередь гарантирует, что каждое движение закончится до начала следующего.
- **`notifySpinReady()` только после `await`.** Событие конца хода уходит, когда анимация реально доиграла.
  Синхронный `SpinReady` прямо внутри `receive()` хост примет, но на `step` это значит, что игрок увидел исход
  без прыжка.
- **Сигналы синхронные.** `Signal` ловит только синхронные исключения обработчика. Ошибка в async-цепочке станет
  unhandled rejection, поэтому у очереди есть `.catch`.

## Mock-хост: игра без шелла

`JumperMockHost` заменяет шелл и dev-бэкенд. Игра идёт по настоящему пути: та же фабрика, тот же мост, те же
команды, подменяется только собеседник. Общий принцип mock-хостов — в [mock-режиме](../../concepts/mock-mode.md).

```ts
const host = new JumperMockHost({ difficulty: 'HARD', loseChance: 0.3 });
host.attach(boot(host, container));
const unbind = host.bindKeys(); // returns the unsubscribe
```

| Клавиша | Метод | Что делает |
|---|---|---|
| Пробел | `play()` | Без раунда — `play` (слоты скрыты) и сразу прыжок на ступень 0. В раунде — прыжок на `landingStep + 1`. Пока бар залочен — `DisabledPlayPressed` |
| C | `cashout()` | После первого приземления: `CashoutPressed` → ход `payout` → `RestartRound "cashout\|<сумма>"` |
| B | `buyBonus()` | Между раундами: `StartBonus` с 3–10 фри-геймами. Бар залочен до `BonusEnded` |
| D | `setDifficulty(next)` | Между раундами: следующая сложность — `SetJumperDifficulty` |

Остальное API: `ready()` пушит сложность, конфиг и состояние, `emit(event)` принимает события игры,
`difficulty` — текущая сложность, `isBonusActive` — идёт ли серия. `RequestPlay` из сцены — то же, что `play()`.
Падение и верх лесенки закрывают раунд. `RestartRound` (`"lose|"`, `"win|<сумма>"`) мок шлёт после `SpinReady`
прыжка и потом ждёт ещё один `SpinReady` — сброс сцены.

| Опция | По умолчанию | Что задаёт |
|---|---|---|
| `ladders` | лесенки dev-бэка: EASY 40, MEDIUM 38, HARD 35 ступеней; 2 / 4 / 8; бонус 100 ставок | Лесенки по сложностям (`JumperLadder[]`) |
| `difficulty` | `'EASY'` | Стартовая сложность. Сложность без лесенки — `RangeError` сразу в конструкторе |
| `loseChance` | `0.15` | Шанс упасть на прыжке. В фри-гейме — шанс, что прыжок последний |
| `slotCount` | `{ min: 5, max: 18 }` | Сколько слотов раскладывать по лесенке (кроме верхней ступени) |
| `slotWeights` | `{ NONE: 4, TRAMPOLINE: 3, JETPACK: 2, ROCKET: 1 }` | Веса содержимого слота и действия прыжка в фри-гейме |
| `bonusGameCount` | `{ min: 3, max: 10 }` | Фри-геймов в серии |
| `betAmount` / `currency` / `decimalPlaces` | `'1.00'` / `'USD'` / `2` | Ставка и формат денег. Арифметика точная, по десятичным строкам |
| `random` | `Math.random` | Источник случайности. В тестах подменяется |

Чем mock отличается от настоящего хоста — это стоит помнить, когда игра в моке работает, а в шелле нет:

| Mock | Шелл |
|---|---|
| `ready()`: сложность → конфиг → состояние | конфиг → сложность → состояние, и только после первого `UiVisibility` |
| Деньги с хвостовыми нулями (`"1.00"`, `"2.70"`), `RestartRound "win\|2.47 USD"` | Канонические строки (`"2.7"`), `RestartRound "win\|$2.47"` |
| Падение всегда на `landingStep` (`collisionPosition === landingStep`) | Падение бывает посреди цепочки: `landingStep` 12, `collisionPosition` 10 |
| После кэшаута `collisionPosition = landingStep + 1` | Любая ступень, в том числе ниже `landingStep` |
| Ни окон выигрыша, ни шторки перехода, ни `SetAutoplay` | `WinWindowOpened` / `WinWindowClosed`, `TransitionScreen*` вокруг серии, автоплей |
| `BonusProgressSave` не проверяет | Проверяет счётчик против серии |

Готовые игры на моке:

```bash
npm install                                                    # в корне репозитория, один раз
DEMO_MODE=jumper npm run dev -w js/examples/demo-games         # http://localhost:5196/?mock=1
npm run dev -w js/examples/jumper-stub                         # http://localhost:5181/?mock=1
```

`demo-games` — витрина режима для вкладки «Демо игры» конфигуратора. `jumper-stub` — минимальная заглушка на
Canvas 2D, ею проверяют режим jumper в шелле.

## Проверка

1. **Mock.** `?mock=1`: ставка, несколько прыжков с ускорителями, падение, кэшаут, бонус, смена сложности.
   После каждого прыжка и каждого сброса Пробел снова работает. Если «залипло», значит не ушёл `SpinReady`.
2. **Логи моста.** Шелл включает их командой `SetLoggingEnabled`, локально — `BridgeLogger.isEnabled = true`.
   Предупреждения `[JumperBridge] … does not belong to jumper` и `StartBonus without free-game routes` значат, что
   пришла команда не того режима.
3. **Шелл локально.** Dev-сервер игры отдаёт `/game.js`, шелл запускают с параметрами
   `?operatorId=…&authToken=…&currency=USD&lang=en&gameMode=jumper&gameCategory=jumper&configuratorGameId=…&localBuild=http://localhost:5196`.
   `localBuild` принимает только `localhost` / `127.0.0.1` / `[::1]`, а `engine=web` он ставит сам. Ссылку на
   админку dev-сервер печатает в консоль (`WebBridge admin: …`).
4. **Консоль шелла.** `[jumper] The engine sent an event jumper does not handle` значит, что игра шлёт событие
   чужого режима. `The bonus progress does not fit the series` — счётчик бонуса не той формы.
5. **Стенд конфигуратора.** Игра с GameMode `jumper` и сборкой `game.js`: настоящий dev-бэк, окна выигрыша,
   шторка бонуса, перезагрузка посреди раунда и посреди серии.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| После первого прыжка бар не разблокируется | `notifySpinReady()` не вызван на `step`, или вызван на `play`, а на `step` пропущен | Слать `SpinReady` только на `step` и на `RestartRound`, после анимации |
| После падения или кэшаута новая ставка не проходит | Нет `notifySpinReady()` после сброса сцены на `restartRequested` | Сбросить сцену и ответить `notifySpinReady()` |
| Игрок долетает до конца цепочки и «падает» назад | Анимация падения строится по `landingStep` | У `status: 'lose'` путь обрезать на `collisionPosition` (`jumpWaypoints` выше) |
| В моке всё работает, в шелле поле пустое | Поле строится в `difficultyChanged`, а конфиг приходит позже (или наоборот) | Строить поле, когда известны и конфиг, и сложность |
| В шелле нет ни конфига, ни раунда | Игра не шлёт `UiVisibility`, и хост считает мост не готовым | `bridge.setUiVisibility({...})` на старте; на `SyncUiVisibility` база отвечает сама |
| Mock не присылает стартовые данные | `host.ready()` вызван синхронно в `createGame`, до `attach` | Вызывать `ready()` на первом кадре (`requestAnimationFrame`) |
| Бонус «завис» после последнего фри-гейма | Не ушёл `notifyBonusEnded()`, или игра ждёт `BonusCleared`, которого у jumper нет | `BonusEnded` после последнего фри-гейма. Серию закрывает хост |
| Хост пишет `does not fit the series` | В `saveBonusProgress` передан не `{ completedIterations, totalIterations }`, или счёт идёт по всей серии, а не по этому `StartBonus` | Считать от 1 по `bonus.games` текущего `StartBonus` |
| Коэффициент на экране — `2.6999999` | Деньги посчитаны через `number` | Показывать строки как есть, считать в десятичных |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `js/webbridge/src/jumper/` (`JumperBridge.ts`, `JumperMockHost.ts`, `JumperMockRound.ts`,
  `jumperMockBonus.ts`, `jumperMockLadders.ts`, `jumperMockMoney.ts`, `jumperMockRandom.ts`, `jumperMockOptions.ts`)
- Тесты: `js/webbridge/test/JumperBridge.test.ts`, `JumperMockHost.test.ts`, `JumperMockHostBonus.test.ts`
- Примеры: `js/examples/demo-games/src/modes/jumper`, `js/examples/jumper-stub`
