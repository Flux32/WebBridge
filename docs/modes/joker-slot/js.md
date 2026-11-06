# Joker Slot — JS

> Как подключить Joker Slot к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas).
> Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```ts
import { createWebBoot, JokerSlotBridge, registerWebBoot } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new JokerSlotBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const game = new MyJokerGame(container);                 // ваш движок
      bridge.spinResultReceived.add(async (reply) => {
        for (const [index, board] of reply.boards.entries()) {
          await game.spin(board);                              // барабаны встают
          for (const step of reply.actions[index] ?? []) await game.play(step); // линии, сборы, бонус
        }
        await game.showTotal(reply.winAmount);                 // верхний winAmount — итог раунда
        bridge.notifySpinReady();                              // один раз на ответ, покупка тоже
      });
      host.ready();                                            // игра принимает команды
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      bridge.start();                                          // спросить у хоста конфиг и состояние
      return game;
    },
    destroyGame: (game) => game.destroy(),
  }),
);
```

Очередь ответов и разбор шагов — в [полном примере](#полный-пример).

## Установка и точка входа

`JokerSlotBridge` и `JokerSlotMockHost` — в `@omega/webbridge-js` с версии **1.19.0** (вместе с протоколом
**1.21.0**). Как поставить пакет и собрать `game.js`, который загрузит шелл, — в
[старте на JS](../../guides/getting-started-js.md).

Три обязательных шага после создания игры — как у любого режима:

1. `host.ready()` — игра готова принимать команды. До этого шелл держит свой лоадер.
2. `bridge.setUiVisibility(…)` — первое `UiVisibility` шелл считает сигналом «мост поднят».
3. `bridge.start()` — стартовая синхронизация: мост повторяет `RequestGameConfig` и `RequestGameState`, пока
   хост не ответит. В mock-режиме (`?mock=1`) мост не спрашивает: отвечает mock-хост.

## API `JokerSlotBridge`

`JokerSlotBridge extends BridgeBase`. Общие сигналы и методы (`fastGameChanged`, `isFastGameEnabled`,
`disabledPlayPressed`, `requestPlay`, звуки, `setUiVisibility`…) описаны в
[ядре JS-моста](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `spinResultReceived` | `JokerSlotSpinResult` | пришёл `ApplySpinResult`: весь раунд — спин или покупка |
| `gameConfigReceived` | `unknown` | пришёл `ApplyGameConfig`: конфиг платформы как есть |
| `gameStateReceived` | `JokerSlotGameState` (`{ status: 'none' }`) | пришёл `ApplyGameState`; восстанавливать нечего |

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `start()` | `RequestGameConfig` + `RequestGameState`, с повтором до ответа | один раз, когда сцена готова |
| `notifySpinReady()` | `SpinReady` | когда доиграна последняя доска и показан итог — ровно один раз на `ApplySpinResult` |
| `requestPlay()` | `RequestPlay` | игрок тапнул по сцене вместо кнопки Play (из `BridgeBase`) |

`requestStep()` у моста нет: шагов у режима не бывает.

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastSpinResult` | `JokerSlotSpinResult \| null` | последний ответ на спин |
| `lastGameConfig` | `unknown` | последний конфиг |
| `lastGameState` | `JokerSlotGameState \| null` | последнее состояние |

Мост разбирает payload'ы `JSON.parse` без проверки формы: форму держит сервер платформы. Демо-игра читает
ответ своим планировщиком (`js/examples/demo-games/src/modes/joker-slot/jokerSlotRound.ts`) и падает с
`JokerSlotRoundError` на непонятном значении, вместо того чтобы молча рисовать мусор.

Команда `UpdateCoeffs` из общей синхронизации хоста мостом игнорируется. Любая другая чужая команда, в том
числе `ApplyBonusStepResult`, пишется в лог как предупреждение:
`[JokerSlotBridge] <type> does not belong to joker-slot`.

## Полный пример

Контроллер раунда без движка: очередь ответов, доски и их шаги по порядку, один `SpinReady`. Отрисовку
подставляет движок через `motions`. Это сокращённый `JokerSlotController` демо-игры: в нём ещё проверка
ответа и сломанное состояние вместо `SpinReady` на битом ответе ([правило](README.md#восстановление-и-ошибки)).

```ts
import type { JokerSlotBridge } from '@omega/webbridge-js';
import type { JokerSlotAction, JokerSlotCell, JokerSlotPaidCell, JokerSlotSpinResult } from '@omega/webbridge-protocol';
import { JOKER_SLOT_WIN_LINES } from '@omega/webbridge-protocol';

export interface JokerMotions {
  spin(board: string): Promise<void>;
  showLine(cells: readonly number[]): Promise<void>;
  place(cells: readonly JokerSlotCell[]): Promise<void>;          // старт бонуса, монеты Super Joker'а
  showBonusBoard(codes: readonly string[]): Promise<void>;       // доска BONUS_RUN
  collect(triggerIndex: number, coins: readonly JokerSlotPaidCell[]): Promise<void>;
  showSpinsLeft(count: number): void;
  showTotal(winAmount: string): Promise<void>;
}

export class JokerRound {
  private queue: Promise<void> = Promise.resolve();

  public constructor(private readonly bridge: JokerSlotBridge, private readonly motions: JokerMotions) {
    bridge.spinResultReceived.add((reply) => (this.queue = this.queue.then(() => this.play(reply))));
  }

  private async play(reply: JokerSlotSpinResult): Promise<void> {
    for (const [index, board] of reply.boards.entries()) {
      await this.motions.spin(board);
      for (const step of reply.actions[index] ?? []) await this.playStep(step);
    }
    await this.motions.showTotal(reply.winAmount);                // верхний winAmount, не сумма частей
    this.bridge.notifySpinReady();                                // один раз на ответ
  }

  private async playStep(step: JokerSlotAction): Promise<void> {
    switch (step.action) {
      case 'WIN_LINES':
        for (const line of step.winLines as { winLineNumber: number }[]) {
          await this.motions.showLine(JOKER_SLOT_WIN_LINES[line.winLineNumber]!);
        }
        return;
      case 'PILE_OF_GOLD':
      case 'BONUS_BUY':
        return this.motions.place([...(step.coins as JokerSlotCell[]), ...(step.strikes as JokerSlotCell[])]);
      case 'SUPER_STRIKE_COINS_ADDED':
        return this.motions.place(step.coins as JokerSlotCell[]);
      case 'BONUS_RUN':
        return this.motions.showBonusBoard((step.board as string[][]).map(([code]) => code!));
      case 'STRIKE_COINS_COLLECTION':
        return this.motions.collect(step.triggerIndex as number, step.coins as JokerSlotPaidCell[]);
      case 'ENHANCED_SUPER_STRIKE':
        return this.motions.collect(step.triggerIndex as number, step.strikes as JokerSlotPaidCell[]);
      case 'BONUS_SPINS_COUNT':
        return this.motions.showSpinsLeft(step.count as number);
      default:
        return;                                                   // список открыт: неизвестное пропускаем
    }
  }
}
```

`JokerSlotAction` — объединение известных форм с открытым `JokerSlotOtherAction`, поэтому сравнение по
`action` не сужает тип до конца: поля читаются с приведением, а в настоящей игре — через свой читатель.

Полная игра с анимацией на Canvas 2D — `js/examples/demo-games/src/modes/joker-slot`
(`JokerSlotController.ts` — логика раунда, `JokerSlotView.ts` — отрисовка, `jokerSlotRound.ts` — разбор
ответа). Барабаны, монеты и алфавит демо берёт у slot-coin; свои у него только джокеры.

## Mock-хост: игра без шелла

`JokerSlotMockHost` заменяет шелл и сервер. Он отвечает на синхронизацию, сдаёт раунды в форме stage-бэка и
держит «бар» занятым до `SpinReady`, как настоящий хост. Бонус идёт по правилам stage: джокеры липнут к
среднему барабану, каждый собирает монеты спина, новый Super Joker сначала докладывает монеты, счётчик снова
3 на новом и 0 в конце. Верхний `winAmount` — `coeff × betAmount` в десятичной арифметике, обрезанный до
центов; так сходятся все записанные ответы. Выплаты линий (кроме cherry ×1 из записей), веса и частоты —
иллюстративные.

```ts
import { JokerSlotMockHost } from '@omega/webbridge-js';

const host = new JokerSlotMockHost({ currency: 'USD', bet: 1 });
const game = boot(host, document.getElementById('web-game-root')!);  // boot — ваша фабрика из createWebBoot
host.attach(game);
host.bindKeys();
```

| Опция | По умолчанию | Что задаёт |
|---|---|---|
| `currency` | `'USD'` | валюта в конфиге и ответах |
| `bet` | `1` | ставка; покупка стоит `bet × 75` / `× 200` |
| `random` | `Math.random` | источник случайности; подставьте сид, чтобы раунды повторялись в тестах |

| Метод / клавиша | Что делает |
|---|---|
| `attach(game)` | подключить игру, которой хост шлёт команды |
| `spin()` · Space | обычный спин (Space шлёт `RequestPlay`) |
| `spin('lines')` · L | спин с линией |
| `spin('collect')` · C | Joker Coin собирает монеты |
| `spin('superJoker')` · S | Super Joker докладывает монеты и собирает |
| `spin('bonus')` · B | бонус от выпавших джокеров (`PILE_OF_GOLD`) |
| `buyBonus('x75' \| 'x200')` · X / Z | покупка по полной цене |
| `resync()` · G | `ApplyGameState` — всегда `{ status: 'none' }` |
| `toggleFastGame()` · F | переключает `SetFastGame`, как тумблер бет-бара |

Пока игра не прислала `SpinReady`, `spin()` и покупки ничего не делают и пишут предупреждение (сервер
ответил бы `Active round already exist`), а `RequestPlay` получает `DisabledPlayPressed`. Тип исхода для
`spin()` — `JokerSlotMockOutcome`.

Демо-игру с mock-хостом можно запустить из корня WebBridge:

```bash
DEMO_MODE=joker-slot npm run dev -w js/examples/demo-games
```

Страница — `http://localhost:5200/?mock=1`. Подробнее о mock-хостах — в
[mock-режиме](../../concepts/mock-mode.md).

## Проверка

1. **Mock.** `?mock=1`: Space — спин, L / C / S / B — фичи, X / Z — покупки. На каждый `ApplySpinResult` —
   ровно один `SpinReady`, и только после последней доски бонуса.
2. **Шелл локально.** Шелл RoadFrontent с `gameMode=joker-pyre&gameCategory=joker-slot` и
   `localBuild=<url вашего dev-сервера>`: stage-бэк, бет-бар, магазин из двух покупок.
3. **Стенд тестировщика.** `/admin/games/<id>/playtest` в games-configurator: та же игра в iframe шелла,
   с логом команд и событий поверх.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бет-бар не оживает после бонуса | не пришёл `SpinReady`: исключение в анимации, `return` до вызова или битый ответ | найти ошибку в логе моста; таймером или `finally` её не закрывать |
| Бар ожил посреди бонуса | `SpinReady` после базовой доски | один вызов после последней доски |
| Монеты Super Joker'а летят из пустых ячеек | их искали в строке доски | они в `SUPER_STRIKE_COINS_ADDED`, а не в `boards[i]` |
| Сбор после `BONUS_RUN` не сходится с доской | шаги играются по базовой доске | после `BONUS_RUN` — доска бонуса |
| Итог на цент больше баланса | показана сумма `totalPayout` | итог — верхний `winAmount` |
| `[JokerSlotBridge] X does not belong to joker-slot` в логе | хост шлёт команду другого режима | у игры не тот `gameCategory` в URL шелла |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md)
- Исходники: `js/webbridge/src/joker-slot/` · демо `js/examples/demo-games/src/modes/joker-slot/`
