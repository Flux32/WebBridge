# Crush — JS

> Как подключить режим crush к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas): мост
> `CrushBridge` из `@omega/webbridge-js`. Контракт режима — что значат команды и события, в каком порядке они
> идут — в [обзоре](README.md).

## Коротко

```ts
import { CrushBridge, createWebBoot, registerWebBoot } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new CrushBridge(transport),
    createGame: (bridge, container, options, host) => {
      const scene = createScene(container, options.devicePixelRatio); // ваш рендерер

      // Шаг: проиграть и только потом сказать «доиграно».
      bridge.stepResultReceived.add(async (step) => {
        if (step.isWinMain) {
          await scene.hop();
        } else {
          await scene.crush();
          await scene.reset(); // после проигрыша RestartRound не придёт — сцену сбрасывает игра
        }
        bridge.notifySpinReady();
      });

      // Кэшаут и выигрыш на вершине: показать сумму, сбросить сцену, сказать «готово».
      bridge.restartRequested.add(async ({ reason, amount }) => {
        if (reason === 'cashout' || reason === 'win') await scene.showWin(amount);
        await scene.reset();
        bridge.notifySpinReady();
      });

      // Мост ждёт следующего тика: хост сначала получает приёмник команд, потом слышит ready().
      window.setTimeout(() => {
        host.ready();
        bridge.setUiVisibility({
          hideDesktopBetBar: false,
          hideMobileBetBar: false,
          desktopBetBarInteractable: true,
          mobileBetBarInteractable: true,
        });
        bridge.start(); // RequestGameConfig + RequestGameState с повторами
      }, 0);
      return scene;
    },
    destroyGame: (scene) => scene.destroy(),
  }),
);

declare function createScene(container: HTMLElement, devicePixelRatio?: number): {
  hop(): Promise<void>;
  crush(): Promise<void>;
  reset(): Promise<void>;
  showWin(amount: string): Promise<void>;
  destroy(): void;
};
```

Здесь шаги и рестарты не выстроены в очередь, лесенка и восстановление не обработаны — полный вариант
[ниже](#полный-пример).

## Установка и точка входа

Пакеты — `@omega/webbridge-js` и `@omega/webbridge-protocol` (типы команд и payload'ов). Как их поставить,
как устроены `createWebBoot` / `registerWebBoot` и как запустить игру в шелле через `?localBuild=` —
в [старте на JS](../../guides/getting-started-js.md). Для crush в плагине dev-сервера указывается
`mode: 'crush'`:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { localBuildServer } from '@omega/webbridge-js/vite';

export default defineConfig({
  plugins: [localBuildServer({ entry: '/src/bridge/boot.ts', mode: 'crush' })],
  server: { port: 5180 },
});
```

Веб-хост доставляет команды структурами в том же окне — без строк и без JSON, кроме тех payload'ов,
которые протокол сам держит строкой (`ApplyGameConfig`, `ApplyGameState`, `RestartRound`).

## API `CrushBridge`

`CrushBridge` — зеркало Unity-моста `RoadWebBridge`, наследник `BridgeBase` ([ядро JS-моста](../../reference/js-core.md)).
Исходник — `js/webbridge/src/crush/CrushBridge.ts`.

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `stepResultReceived` | `StepResultPayload` | `ApplyStepResult`: ответ сервера на шаг |
| `coefficientsReceived` | `number[]` | `UpdateCoeffs`: новая лесенка. Повтор той же лесенки **не** гасится |
| `gameConfigReceived` | `GameConfigPayload` | `ApplyGameConfig`: строка разобрана `JSON.parse` |
| `gameStateReceived` | `unknown` | `ApplyGameState`: строка разобрана `JSON.parse`, форма — [состояние раунда](README.md#состояние-раунда-applygamestate) |
| `restartRequested` | `RestartRequest` (`{ reason, amount }`) | `RestartRound`: строка разрезана по `\|`; пустой payload — `{ reason: '', amount: '' }` |
| `autoplayChanged` | `boolean` | `SetAutoplay` |
| `bonusStartRequested` | `StartBonusPayload` | `StartBonus`; у crush это всегда `RoadStartBonusPayload` — сузить проверкой `'positions' in payload` |

Сигналы базы, которые crush использует:

| Сигнал | Тип значения | Зачем crush |
|---|---|---|
| `cashoutPressed` | — | `CashoutPressed`: свернуть живой раунд до окна |
| `disabledPlayPressed` | — | `DisabledPlayPressed`: Play недоступен — показать отказ |
| `transitionScreenOpenFinished`, `transitionScreenCloseStarted`, `transitionScreenCloseFinished` | — | такт бонуса: когда менять поле и когда начинать забег |
| `winWindowSignal` | `WinWindowSignalPayload` | отметки сценария окна кэшаута / выигрыша |
| `fastGameChanged` | `boolean` | ускоренная подача |

Подписка возвращает функцию отписки (`signal.add(handler)` → `() => void`). Исключение подписчика ловится
и пишется в консоль, остальные подписчики его не видят.

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `start()` | `RequestGameConfig` + `RequestGameState` раз в 500 мс, до 10 раз, пока не придёт `ApplyGameConfig` | один раз, когда сцена готова принимать данные. С `?mock=1` не шлёт ничего |
| `notifySpinReady()` | `SpinReady` | шаг доигран; сцена сброшена после проигрыша или после `restartRequested` |
| `notifyBonusActive()` | `BonusActive` | бонусное поле на экране (за шторкой) |
| `saveBonusAutoPlayProgress(progress)` | `BonusProgressSave` с `raw = JSON.stringify(progress)` | в начале каждой итерации серии; форма записи — [прогресс бонуса](README.md#прогресс-бонуса-bonusprogresssave) |
| `notifyBonusEnded()` | `BonusEnded` | последняя итерация доиграна |
| `clearBonusAutoPlayProgress()` | `BonusProgressClear` | бонус окончательно позади |
| `notifyBonusCleared()` | `BonusCleared` | сразу после `clearBonusAutoPlayProgress()` |
| `requestPlay()` | `RequestPlay` | игрок сделал ход в самой сцене (тап по полю) |
| `setUiVisibility(patch)` | `UiVisibility` | первый вызов — «мост жив» для хоста; без него хост не шлёт лесенку |
| `requestGameConfig()`, `requestGameState()` | `RequestGameConfig`, `RequestGameState` | переспросить вручную (обычно хватает `start()`) |
| `dispose()` | — | останавливает повторы `start()`; `createWebBoot` зовёт его сам на `destroy` |

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastGameConfig` | `GameConfigPayload \| null` | последний `ApplyGameConfig` |
| `lastGameState` | `unknown` | последний `ApplyGameState` |
| `isFastGameEnabled`, `currentIsWhiteLabel` | `boolean`, `boolean \| null` | из базы |

### Чего в `CrushBridge` нет

Мост покрывает раунд и запуск бонуса. Остальное хост шлёт, а мост роняет — знать заранее:

| Что | Как ведёт себя мост | Что делать |
|---|---|---|
| `SetDifficulty` | **молча игнорирует**: в `handleGameCommand` нет ветки | наследник с сигналом сложности (ниже) |
| `ApplyBonusPurchaseResult` | `BridgeLogger.warn(…)` — виден только с включёнными логами | наследник, если игра продаёт бонус сама |
| `BonusPurchaseRequest` | метода нет | наследник: `this.transport.send({ type: 'BonusPurchaseRequest', payload })` |
| повтор лесенки | `coefficientsReceived` и `gameConfigReceived` оба несут лесенку одного прохода | брать один источник |
| коэффициенты строками | значение типизировано `number[]`, но сервер шлёт `"1.03"` | привести к числу (`toLadder` ниже) |

Наследник, которого хватает на всё это:

```ts
import { CrushBridge, Signal } from '@omega/webbridge-js';
import type {
  BonusPurchaseRequestPayload,
  CoreCommand,
  CrushDifficulty,
  EngineCommand,
} from '@omega/webbridge-protocol';

/** CrushBridge plus what it does not cover yet: the difficulty and the bonus bought in the game itself. */
export class GameCrushBridge extends CrushBridge {
  public readonly difficultyChanged = new Signal<CrushDifficulty>();
  /** null until the host sends the first difficulty; a late subscriber reads it here. */
  public currentDifficulty: CrushDifficulty | null = null;

  protected override handleGameCommand(command: Exclude<EngineCommand, CoreCommand>): void {
    if (command.type !== 'SetDifficulty') {
      super.handleGameCommand(command);
      return;
    }
    if (command.payload === this.currentDifficulty) return;
    this.currentDifficulty = command.payload;
    this.difficultyChanged.invoke(command.payload);
  }

  /** `betAmount` is the whole price of the bonus; the host answers a refusal with ApplyBonusPurchaseResult. */
  public requestBonusPurchase(payload: BonusPurchaseRequestPayload): void {
    this.transport.send({ type: 'BonusPurchaseRequest', payload });
  }
}
```

## Полный пример

Сцена целиком: лесенка, шаги в очереди, проигрыш без рестарта, кэшаут, восстановление, бонусная серия по
шторке. Рисование вынесено в интерфейс `CrushMotions` — его реализует рендерер игры, а логика ниже от
движка не зависит. Это тот же подход, что в демо (`js/examples/demo-games/src/modes/crush`), плюс
сложность и бонусная серия с прогрессом.

```ts
import { BridgeLogger, createWebBoot, registerWebBoot, type Signal } from '@omega/webbridge-js';
import type { RoadStartBonusPayload, StartBonusPayload, StepResultPayload } from '@omega/webbridge-protocol';
import { GameCrushBridge } from './GameCrushBridge';

/** What the renderer plays; every motion resolves once it has played out. */
export interface CrushMotions {
  setLadder(ladder: readonly number[]): void;
  placeAt(step: number): void;
  hop(toStep: number): Promise<void>;
  crush(onStep: number): Promise<void>;
  foldRound(): void;
  showWin(amount: string): Promise<void>;
  reset(): Promise<void>;
  showBonusField(isBonus: boolean): void;
  /** One free run up to `position`; resolves with the coefficient the run reached. */
  bonusRun(position: number): Promise<number>;
  destroy(): void;
}

declare function createCrushView(container: HTMLElement, devicePixelRatio?: number): CrushMotions;

/** In front of the first step: after `play`, before the first `step` lands. */
const START_STEP = -1;

/** The protocol types the ladder as numbers, yet the shell forwards the server's decimal strings as served. */
const toLadder = (values: readonly unknown[]): number[] | null => {
  const ladder = values.map((value) => (typeof value === 'string' ? Number(value) : value));
  return ladder.every((value): value is number => typeof value === 'number' && Number.isFinite(value)) ? ladder : null;
};

const isRoadBonus = (payload: StartBonusPayload): payload is RoadStartBonusPayload => 'positions' in payload;

const once = (signal: Signal): Promise<void> =>
  new Promise((resolve) => {
    const unsubscribe = signal.add(() => {
      unsubscribe();
      resolve();
    });
  });

/** The two curtain moments a bonus swap waits for, armed when the command arrives, not when the queue gets to it. */
interface Curtain {
  readonly isClosed: Promise<void>;
  readonly isGone: Promise<void>;
}

export class CrushGame {
  private ladder: number[] = [];
  private step = START_STEP;
  private tail: Promise<void> = Promise.resolve();
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly bridge: GameCrushBridge,
    private readonly motions: CrushMotions,
  ) {
    this.unsubscribers = [
      bridge.coefficientsReceived.add((values) => this.applyLadder(values)),
      bridge.gameStateReceived.add((state) => this.restore(state)),
      bridge.stepResultReceived.add((result) => this.enqueue(() => this.playStep(result))),
      bridge.cashoutPressed.add(() => this.motions.foldRound()),
      bridge.restartRequested.add(({ reason, amount }) => this.enqueue(() => this.restart(reason, amount))),
      bridge.bonusStartRequested.add((payload) => this.startBonus(payload)),
    ];
  }

  public destroy(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  /** Host commands play one after another: a restart may arrive while a hop is still in the air. */
  private enqueue(move: () => Promise<void>): void {
    this.tail = this.tail.then(move).catch((error: unknown) => BridgeLogger.error(`[crush] move failed: ${String(error)}`));
  }

  private applyLadder(values: readonly unknown[]): void {
    const ladder = toLadder(values);
    if (ladder === null) {
      BridgeLogger.error(`[crush] the ladder is not a list of numbers: ${JSON.stringify(values)}`);
      return;
    }
    this.ladder = ladder;
    this.motions.setLadder(ladder);
  }

  /** A live round after a reload: stand on the server's line without playing the steps. */
  private restore(state: unknown): void {
    const round = state as { lineNumber?: unknown; isFinished?: unknown } | null;
    if (typeof round?.lineNumber !== 'number' || round.isFinished === true) return;
    this.step = round.lineNumber;
    this.motions.placeAt(this.step);
  }

  private async playStep(result: StepResultPayload): Promise<void> {
    this.step += 1; // a lost step still aims at the next one: that is where the block falls
    if (result.isWinMain) {
      await this.motions.hop(this.step); // the top is reached here too; RestartRound("win|…") follows
    } else {
      await this.motions.crush(this.step);
      await this.resetScene(); // the host sends no RestartRound after a loss
    }
    this.bridge.notifySpinReady();
  }

  private async restart(reason: string, amount: string): Promise<void> {
    if (reason === 'cashout' || reason === 'win') await this.motions.showWin(amount);
    await this.resetScene();
    this.bridge.notifySpinReady();
  }

  private async resetScene(): Promise<void> {
    await this.motions.reset();
    this.step = START_STEP;
  }

  private startBonus(payload: StartBonusPayload): void {
    if (!isRoadBonus(payload)) {
      BridgeLogger.error('[crush] StartBonus without positions: not a crush series');
      return;
    }
    const curtain = this.armCurtain();
    this.enqueue(() => this.playSeries(payload, curtain));
  }

  private armCurtain(): Curtain {
    return {
      isClosed: once(this.bridge.transitionScreenCloseStarted),
      isGone: once(this.bridge.transitionScreenCloseFinished),
    };
  }

  private async playSeries(bonus: RoadStartBonusPayload, opening: Curtain): Promise<void> {
    await opening.isClosed;
    this.motions.showBonusField(true);
    if (bonus.bonusCoefficients) this.applyLadder(bonus.bonusCoefficients.split(','));
    this.bridge.notifyBonusActive();
    await opening.isGone;

    let accumulatedCoefficient = bonus.accumulatedCoefficient;
    const remaining = bonus.positions.slice(bonus.completedIterations);
    for (const [offset, position] of remaining.entries()) {
      this.saveProgress(bonus, bonus.completedIterations + offset, accumulatedCoefficient);
      accumulatedCoefficient += await this.motions.bonusRun(position);
    }

    const closing = this.armCurtain();
    this.bridge.notifyBonusEnded(); // the host shows the bonus win, then brings the curtain
    await closing.isClosed;
    this.motions.showBonusField(false);
    await this.resetScene();
    await closing.isGone;
    this.bridge.clearBonusAutoPlayProgress();
    this.bridge.notifyBonusCleared(); // the host sends the regular ladder back
  }

  private saveProgress(bonus: RoadStartBonusPayload, completedIterations: number, accumulatedCoefficient: number): void {
    this.bridge.saveBonusAutoPlayProgress({
      positions: bonus.positions,
      completedIterations,
      totalIterations: bonus.positions.length,
      accumulatedCoefficient,
      accumulatedWin: accumulatedCoefficient * bonus.betAmount,
      betAmount: bonus.betAmount,
      currency: bonus.currency,
      currentStep: 0,
      difficulty: bonus.difficulty,
      bonusCoefficients: bonus.bonusCoefficients ?? null,
    });
  }
}

export const crushBoot = createWebBoot({
  createBridge: (transport) => new GameCrushBridge(transport),
  createGame: (bridge, container, options, host) => {
    const view = createCrushView(container, options.devicePixelRatio);
    const game = new CrushGame(bridge, view);
    // A tick later: the host (or a mock host) takes the returned command receiver first.
    window.setTimeout(() => {
      host.ready();
      bridge.setUiVisibility({
        hideDesktopBetBar: false,
        hideMobileBetBar: false,
        desktopBetBarInteractable: true,
        mobileBetBarInteractable: true,
      });
      bridge.start();
    }, 0);
    return { view, game };
  },
  destroyGame: ({ view, game }) => {
    game.destroy();
    view.destroy();
  },
});

registerWebBoot(crushBoot);
```

Что здесь важно:

1. **`notifySpinReady()` — строго после `await` движения**, никогда синхронно внутри обработчика команды.
2. **Очередь.** `RestartRound` может прийти, пока прыжок в воздухе; без очереди сцена сбросится из-под него.
3. **Шторку ловим при получении `StartBonus`**, а не когда очередь дошла до серии: к тому моменту
   `TransitionScreenCloseStarted` мог уже пройти.
4. **Лесенка берётся только из `coefficientsReceived`**: `ApplyGameConfig` того же прохода несёт ту же лесенку.
5. **Восстановленная серия** продолжает с `completedIterations` и накопленного коэффициента — тот же код, что
   и для свежей.

## Mock-хост: игра без шелла

`MockHost` — заменитель хоста и сервера crush внутри страницы: игра идёт тем же путём `__WEB_GAME_BOOT__`,
подменяется только собеседник. Общая идея mock-хостов — в [mock-режиме](../../concepts/mock-mode.md).

```ts
// dev.ts — страница dev-сервера; в бандл для шелла не входит
import { MockHost, MockPanel, isMockEnabled } from '@omega/webbridge-js';
import { crushBoot } from './boot'; // фабрика из полного примера выше

const container = document.getElementById('game');
if (isMockEnabled() && container !== null) {
  const host = new MockHost({ loseChance: 0.3 });
  host.attach(crushBoot(host, container));
  host.bindKeys(); // Space — шаг, C — кэшаут, R — рестарт
  new MockPanel(host).mount(); // кнопка «M»: сложность, шанс проигрыша, Step / Cashout / Restart
}
```

`?mock=1` в адресе включает mock (`isMockEnabled()`); с ним `start()` не шлёт запросов — mock сам отдаёт
конфиг и состояние на `host.ready()`.

### Опции `MockHostOptions`

| Опция | По умолчанию | Что делает |
|---|---|---|
| `difficulties` | `EASY` / `MEDIUM` / `HARD` по 9 ступеней, `DAREDEVIL` — 7 | лесенки по именам сложности |
| `difficulty` | `'EASY'` | стартовая сложность; нет в наборе — первая из набора |
| `loseChance` | `0.2` | вероятность проигрыша шага, 0..1 |
| `currency` | `'USD'` | валюта в `ApplyGameConfig` |

### Что умеет

| Метод / свойство | Что делает |
|---|---|
| `ready()` (зовёт игра) | шлёт `ApplyGameConfig` (лесенка текущей сложности, пустые `bonusModes`) и `ApplyGameState` `{status: 'none', …}` |
| `step()` | бросает исход и шлёт `ApplyStepResult` `{isWinMain, coinsTriggered: false, coinsCollected: []}`; до `SpinReady` следующий шаг игнорирует |
| `cashout()` | `CashoutPressed`, затем `RestartRound("cashout\|")` |
| `restart(reason = 'lose')` | `RestartRound("<reason>\|")` — оборвать раунд посреди лесенки |
| `setDifficulty(name)` | новая лесенка в `ApplyGameConfig` и `RestartRound("difficulty\|")` |
| `emit(RequestPlay)` | шаг, а пока шаг нельзя (идёт или раунд проигран) — `DisabledPlayPressed` |
| `emit(SpinReady)` | снимает занятость и «раунд проигран» |
| `RequestWhiteLabel`, `RequestFastGame` | `ApplyWhiteLabel(false)`, `SetFastGame(false)` |
| `bindKeys(target?)` | клавиши Space / C / R; возвращает отписку |
| `difficultyNames`, `difficulty`, `coefficients`, `loseChance` | для своих контролов |

### Чем mock отличается от настоящего хоста

| Mock | Настоящий хост |
|---|---|
| не шлёт `SetDifficulty` и `UpdateCoeffs` — лесенка только в `ApplyGameConfig` | `SetDifficulty` → `UpdateCoeffs` → `ApplyGameConfig` |
| кэшаут — `RestartRound("cashout\|")` с пустой суммой; `CashoutPressed` без запроса к серверу | сумма есть: `"cashout\|$2.40"` |
| `restart()` шлёт `"lose\|"`, смена сложности — `"difficulty\|"` | таких причин не бывает; после проигрыша `RestartRound` нет вовсе |
| вершина лесенки не заканчивает раунд | после вершины — `RestartRound("win\|…")` |
| нет монет, бонуса, `StartBonus`, автоплея, восстановления | всё это есть |

Поэтому сцену, написанную под mock, стоит проверить в шелле: проигрыш без рестарта, кэшаут с суммой,
вершина, бонус. Чтобы лесенка в mock всё же приходила, достаточно слушать и `gameConfigReceived`, как
демо.

### Демо

```bash
npm install                                            # в корне репозитория, один раз
DEMO_MODE=crush npm run dev -w js/examples/demo-games  # http://localhost:5192/?mock=1
```

Демо-crush (`CrushController`, `CrushView`, `crushRound.ts`) — рабочий образец очереди, проигрыша без
рестарта и восстановления по `lineNumber`. Бонус там упрощён: серия играется одной анимацией, без шторки и
без `BonusProgressSave`. `MockPanel` демо не монтирует — только клавиши.

## Проверка

1. **Логи моста.** `BridgeLogger.isEnabled = true` (или команда `SetLoggingEnabled` из чит-панели шелла) —
   мост пишет `log`/`warn`; `error` виден всегда.
2. **Mock.** `?mock=1`: Space шагает, проигрыш сбрасывает сцену сам, C кэшаутит, R обрывает раунд. После
   каждого шага приходит ровно один `SpinReady` — без него mock не даст шагнуть снова.
3. **Шелл.** Dev-сервер с `localBuildServer` и ссылка на игру стенда с `&localBuild=http://localhost:<порт>`
   ([старт на JS](../../guides/getting-started-js.md)). Проверить по шагам:
   - бар оживает после каждого шага, а не сразу по ответу сервера;
   - проигрыш: сцена сбрасывается сама, бар оживает без `RestartRound`;
   - кэшаут: коэффициент гаснет на `CashoutPressed`, сумма в `RestartRound` совпадает с окном;
   - вершина лесенки: окно выигрыша и `RestartRound("win|…")`;
   - смена сложности между раундами: новая лесенка, игрок на старте;
   - F5 посреди раунда: игрок стоит на той же ступени, следующий шаг идёт с неё;
   - бонус (купить в магазине): поле меняется за шторкой, счётчик «Free games left» идёт, F5 посреди серии
     доигрывает остаток.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| бар не оживает после проигрыша | игра ждёт `RestartRound("lose\|")` | после анимации проигрыша сбросить сцену самому и прислать `notifySpinReady()` |
| бар не оживает после кэшаута / вершины | на `restartRequested` нет `notifySpinReady()` | сбросить сцену и прислать `SpinReady` |
| выигрыш показывается раньше, чем блок сел | `notifySpinReady()` синхронно в обработчике команды | звать после `await` движения |
| сцена «прыгает» на кэшауте посреди прыжка | `RestartRound` обработан, не дождавшись прыжка | очередь команд (`enqueue`) |
| лесенка не приходит, бар висит на загрузке | не было `setUiVisibility(…)`: хост не считает мост живым | позвать `setUiVisibility` до `start()` |
| сложность «не меняется» | `CrushBridge` роняет `SetDifficulty` | наследник с `difficultyChanged` (выше) |
| лесенка из `NaN` | коэффициенты пришли строками | `toLadder` |
| поле бонуса мелькает до шторки | поле меняется прямо на `StartBonus` | ждать `transitionScreenCloseStarted` |
| после бонуса бар в бонусной лесенке, следующий бонус не восстанавливается после F5 | нет `notifyBonusCleared()` | `clearBonusAutoPlayProgress()`, затем `notifyBonusCleared()` |
| покупка из игры молча не работает | `ApplyBonusPurchaseResult` уходит в `warn`, а логи выключены | наследник; ждать `StartBonus` как признак успеха |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `js/webbridge/src/crush/CrushBridge.ts`, `js/webbridge/src/mock/MockHost.ts`,
  `js/webbridge/src/mock/MockPanel.ts`, `js/examples/demo-games/src/modes/crush/`
