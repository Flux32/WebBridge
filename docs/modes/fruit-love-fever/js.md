# Fruit Love Fever — JS

> Как подключить Fruit Love Fever к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas).
> Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```ts
import { createWebBoot, FruitLoveFeverBridge, registerWebBoot } from '@omega/webbridge-js';
import type { FruitLoveFeverStepResult } from '@omega/webbridge-protocol';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new FruitLoveFeverBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const game = new MyFruitGame(container);                // ваш движок
      let onStep: ((step: FruitLoveFeverStepResult) => void) | null = null;
      bridge.stepResultReceived.add((step) => onStep?.(step));
      const nextStep = () =>
        new Promise<FruitLoveFeverStepResult>((resolve) => {
          onStep = resolve;                                   // до запроса: хост может ответить сразу
          bridge.requestStep();
        });
      bridge.spinResultReceived.add(async (reply) => {
        await game.spin(reply);                               // базовый спин
        if (!reply.isFinished) {
          await game.bonusIntro(reply);
          for (let step = await nextStep(); ; step = await nextStep()) {
            await game.spin(step);                            // фри-спин, прилипшие вайлды стоят
            if (step.isFinished) break;
          }
        }
        bridge.notifySpinReady();                             // один раз на раунд
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

Восстановление после перезагрузки и переподключение во время ожидания шага — в
[полном примере](#полный-пример).

## Установка и точка входа

`FruitLoveFeverBridge` и `FruitLoveFeverMockHost` — в `@omega/webbridge-js` с версии **1.17.0** (вместе с
протоколом **1.19.0**). Как поставить пакет и собрать `game.js`, который загрузит шелл, — в
[старте на JS](../../guides/getting-started-js.md).

Три обязательных шага после создания игры — как у любого режима:

1. `host.ready()` — игра готова принимать команды. До этого шелл держит свой лоадер.
2. `bridge.setUiVisibility(…)` — первое `UiVisibility` шелл считает сигналом «мост поднят»: только после
   него он отправит игре восстановление сессии.
3. `bridge.start()` — стартовая синхронизация: мост повторяет `RequestGameConfig` и `RequestGameState`, пока
   хост не ответит. В mock-режиме (`?mock=1`) мост не спрашивает: отвечает mock-хост.

## API `FruitLoveFeverBridge`

`FruitLoveFeverBridge extends BridgeBase`. Общие сигналы и методы (`fastGameChanged`, `isFastGameEnabled`,
`disabledPlayPressed`, `requestPlay`, звуки, `setUiVisibility`…) описаны в
[ядре JS-моста](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `spinResultReceived` | `FruitLoveFeverSpinResult` | пришёл `ApplySpinResult`: ответ на спин или покупку бонуса |
| `stepResultReceived` | `FruitLoveFeverStepResult` | пришёл `ApplyBonusStepResult`: один фри-спин |
| `gameConfigReceived` | `unknown` | пришёл `ApplyGameConfig`: конфиг платформы как есть |
| `gameStateReceived` | `FruitLoveFeverGameState` | пришёл `ApplyGameState`: незавершённый раунд или `{"status":"none"}` |

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `start()` | `RequestGameConfig` + `RequestGameState`, с повтором до ответа | один раз, когда сцена готова |
| `requestStep()` | `RequestStep` | бонус: когда предыдущий фри-спин доигран; ещё раз — на `ApplyGameState` с тем же фри-спином во время ожидания |
| `notifySpinReady()` | `SpinReady` | после базового спина без бонуса или после последнего фри-спина — ровно один раз |
| `requestPlay()` | `RequestPlay` | игрок тапнул по сцене вместо кнопки Play (из `BridgeBase`) |

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastSpinResult` | `FruitLoveFeverSpinResult \| null` | последний ответ на спин |
| `lastStepResult` | `FruitLoveFeverStepResult \| null` | последний фри-спин |
| `lastGameConfig` | `unknown` | последний конфиг |
| `lastGameState` | `FruitLoveFeverGameState \| null` | последнее состояние |

Мост разбирает payload'ы `JSON.parse` без проверки формы: форму держит сервер платформы. Сервер шлёт
`coeff` и `line` то числом, то строкой, деньги — строками. Демо-игра читает поля через свои читатели
(`js/examples/demo-games/src/modes/fruit-love-fever/fruitLoveFeverRead.ts`) и падает с
`FruitLoveFeverRoundError` на непонятном значении, вместо того чтобы молча рисовать мусор.

Команда `UpdateCoeffs` из общей синхронизации хоста мостом игнорируется. Любая другая чужая команда
пишется в лог как предупреждение: `[FruitLoveFeverBridge] <type> does not belong to fruit-love-fever`.

## Полный пример

Контроллер раунда без движка: очередь ответов, базовый спин, бонус шаг за шагом с прилипшими вайлдами,
восстановление и [переподключение во время ожидания шага](README.md#восстановление-и-ошибки). Отрисовку подставляет движок через `motions`. Это сокращённый
`FruitLoveFeverController` демо-игры: в нём ещё проверка ответа и сломанное состояние вместо
`SpinReady` на битом ответе ([правило](README.md#восстановление-и-ошибки)).

```ts
import type { FruitLoveFeverBridge } from '@omega/webbridge-js';
import type { FruitLoveFeverGameState, FruitLoveFeverSpinResult, FruitLoveFeverStepResult } from '@omega/webbridge-protocol';

export interface FruitMotions {
  spin(reply: FruitLoveFeverSpinResult, locked: ReadonlySet<string>): Promise<void>;  // и линии выигрыша
  place(reply: FruitLoveFeverSpinResult): void;                                       // доска без вращения
  bonusIntro(reply: FruitLoveFeverSpinResult): Promise<void>;
  bonusOutro(reply: FruitLoveFeverSpinResult): Promise<void>;
}

/** Клетки вайлдов ответа: "барабан:ряд". */
const wildsOf = (reply: FruitLoveFeverSpinResult): string[] =>
  Object.entries(reply.slot.reelsCells).flatMap(([reel, cells]) =>
    cells.filter((cell) => cell.outcomeNumber === 0).map((cell) => `${reel}:${cell.index}`),
  );

/** Ответ на ожидание шага: шаг (или состояние, которое и есть потерянный шаг) либо раунд, закрытый сервером. */
type StepAnswer = FruitLoveFeverSpinResult | 'ended';

export class FruitRound {
  private queue: Promise<void> = Promise.resolve();
  private stepWaiter: ((answer: StepAnswer) => void) | null = null;
  private played = 0;                                             // последний сыгранный фри-спин
  private isRoundInHand = false;
  private sticky = new Set<string>();

  public constructor(private readonly bridge: FruitLoveFeverBridge, private readonly motions: FruitMotions) {
    bridge.spinResultReceived.add((reply) => this.enqueue(() => this.play(reply)));
    bridge.stepResultReceived.add((step) => this.takeStep(step));
    bridge.gameStateReceived.add((state) => this.onGameState(state));
  }

  private enqueue(round: () => Promise<void>): void {
    this.isRoundInHand = true;
    this.queue = this.queue.then(round);
  }

  private async play(reply: FruitLoveFeverSpinResult): Promise<void> {
    this.sticky = new Set();
    this.played = 0;
    await this.motions.spin(reply, this.sticky);
    if (!reply.isFinished) {
      await this.motions.bonusIntro(reply);
      await this.playBonus();
    }
    this.finish();
  }

  /** Бонус после перезагрузки: доска стоит, фри-спины идут дальше. */
  private async resume(state: FruitLoveFeverSpinResult): Promise<void> {
    const played = state.bonusGame?.currentGameNumber ?? null;     // null — фри-спинов ещё не было
    this.sticky = new Set(played === null ? [] : wildsOf(state));
    this.played = played ?? 0;
    this.motions.place(state);
    await this.playBonus();
    this.finish();
  }

  private async playBonus(): Promise<void> {
    for (;;) {
      const step = await this.nextStep();
      if (step === 'ended') return;                               // сервер закрыл раунд, ответ потерян
      this.played = step.bonusGame?.currentGameNumber ?? this.played;
      await this.motions.spin(step, this.sticky);
      wildsOf(step).forEach((cell) => this.sticky.add(cell));     // вайлд фри-спина прилипает
      if (step.isFinished) return this.motions.bonusOutro(step);
    }
  }

  private finish(): void {
    this.isRoundInHand = false;
    this.bridge.notifySpinReady();                                 // один раз на раунд
  }

  private nextStep(): Promise<StepAnswer> {
    return new Promise((resolve) => {
      this.stepWaiter = resolve;                                   // до запроса: хост может ответить сразу
      this.bridge.requestStep();
    });
  }

  private takeStep(answer: StepAnswer): void {
    const waiter = this.stepWaiter;
    this.stepWaiter = null;
    waiter?.(answer);
  }

  private onGameState(state: FruitLoveFeverGameState): void {
    if (this.stepWaiter !== null) {                                // переподключение во время ожидания шага
      if (state.status === 'none') this.takeStep('ended');        // раунд закончен на сервере
      else if ((state.bonusGame?.currentGameNumber ?? 0) > this.played) this.takeStep(state);  // потерян ответ
      else this.bridge.requestStep();                              // потерян запрос
      return;
    }
    if (state.status === 'none' || state.isFinished || this.isRoundInHand) return;
    this.enqueue(() => this.resume(state));
  }
}
```

Полная игра с анимацией на Canvas 2D — `js/examples/demo-games/src/modes/fruit-love-fever`
(`FruitLoveFeverController.ts` — логика раунда, `FruitLoveFeverView.ts` — отрисовка, `fruitLoveFeverRound.ts`
— разбор ответа в доску и линии). Fast game демо берёт из `bridge.isFastGameEnabled`: все движения идут за 40 %
своего времени.

## Mock-хост: игра без шелла

`FruitLoveFeverMockHost` заменяет шелл и сервер. Он отвечает на синхронизацию, сдаёт спины и шаги в форме
dev-бэка и держит «бар» занятым до `SpinReady`, как настоящий хост. Модель линий повторяет сервер
(20 линий, сумма множителей вайлдов), веса символов и выплата скаттеров — иллюстративные.

```ts
import { FruitLoveFeverMockHost } from '@omega/webbridge-js';

const host = new FruitLoveFeverMockHost({ currency: 'USD', betAmount: 1 });
const game = boot(host, document.getElementById('web-game-root')!);  // boot — ваша фабрика из createWebBoot
host.attach(game);
host.bindKeys();
```

| Опция | По умолчанию | Что задаёт |
|---|---|---|
| `currency` | `'USD'` | валюта в конфиге и ответах |
| `betAmount` | `1` | ставка; покупка стоит `betAmount × 75` или `× 200` |
| `random` | `Math.random` | источник случайности; подставьте сид, чтобы раунды повторялись в тестах |

| Метод / клавиша | Что делает |
|---|---|
| `attach(game)` | подключить игру, которой хост шлёт команды |
| `spin()` · Space | обычный спин (Space шлёт `RequestPlay`); три скаттера — бонус |
| `buyBonus('x75')` · B, `buyBonus('x200')` · H | купленный бонус по полной цене |
| `resync()` · G | `ApplyGameState` с текущей сессией — как после переподключения |
| `toggleFastGame()` · F | переключает `SetFastGame`, как тумблер бет-бара |
| `isBonusActive` | у бонуса остались фри-спины |

На `RequestStep` mock отвечает следующим фри-спином, без бонуса — пишет предупреждение (сервер ответил бы
`Active round not found`). `SpinReady` при оставшихся фри-спинах тоже даёт предупреждение. Пока игра не
прислала `SpinReady`, `spin()` и покупки ничего не делают, а `RequestPlay` получает `DisabledPlayPressed`.

Демо-игру с mock-хостом можно запустить из корня WebBridge:

```bash
DEMO_MODE=fruit-love-fever npm run dev -w js/examples/demo-games
```

Страница — `http://localhost:5198/?mock=1`. Подробнее о mock-хостах — в
[mock-режиме](../../concepts/mock-mode.md).

## Проверка

1. **Mock.** `?mock=1`: Space — спин, B / H — покупка. В логе моста на бонус — `RequestStep` на каждый
   фри-спин и ровно один `SpinReady` в конце. Клавиша G во время бонуса не ломает раунд.
2. **Шелл локально.** Шелл RoadFrontent с `gameMode=fruit-love-fever&gameCategory=fruit-love-fever` и
   `localBuild=<url вашего dev-сервера>`: настоящий dev-бэк, бет-бар, покупки. Перезагрузка посреди бонуса
   должна продолжить его с того же фри-спина.
3. **Стенд тестировщика.** `/admin/games/<id>/playtest` в games-configurator: та же игра в iframe шелла,
   с логом команд и событий поверх.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бет-бар не оживает после бонуса | не пришёл `SpinReady`: исключение в анимации, `return` до вызова или битый ответ | найти ошибку в логе моста; таймером или `finally` её не закрывать |
| Бар ожил посреди бонуса | `SpinReady` после каждого фри-спина или после базового спина бонуса | один вызов после ответа с `isFinished: true` |
| Бонус встал после переподключения | игра ждёт шаг, а потерялся запрос или ответ | на `ApplyGameState` во время ожидания: фри-спин впереди — сыграть состояние как шаг; тот же — `requestStep()`; `{"status":"none"}` — закрыть бонус и `notifySpinReady()` |
| Первый шаг «пропал» | ответ хоста пришёл внутри `requestStep()`, до подписки ожидания | ставить ожидание до вызова `requestStep()` |
| На барабанах «hydrant» и «police» | символ взят из `outcome` | брать `outcomeNumber` |
| Итог бонуса меньше, чем выиграно | показан `bonusGame.winAmount` | итог — верхний `winAmount` |
| `[FruitLoveFeverBridge] X does not belong to fruit-love-fever` в логе | хост шлёт команду другого режима | у игры не тот `gameCategory` в URL шелла |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md)
- Исходники: `js/webbridge/src/fruit-love-fever/` · демо `js/examples/demo-games/src/modes/fruit-love-fever/`
