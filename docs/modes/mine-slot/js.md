# Mine Slot — JS

> Как подключить Mine Slot к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas).
> Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```ts
import { createWebBoot, MineSlotBridge, registerWebBoot } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new MineSlotBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const game = new MyMineSlotGame(container);           // ваш движок
      bridge.spinResultReceived.add(async (result) => {
        await game.playRounds(result);                      // все раунды ответа, на одном поле
        bridge.notifySpinReady();                           // ровно один раз
      });
      host.ready();                                         // игра принимает команды
      bridge.setUiVisibility({ hideDesktopBetBar: false, hideMobileBetBar: false });
      bridge.start();                                       // спросить у хоста конфиг и состояние
      return game;
    },
    destroyGame: (game) => game.destroy(),
  }),
);
```

## Установка и точка входа

`MineSlotBridge` и `MineSlotMockHost` — в `@omega/webbridge-js` с версии **1.16.0** (вместе с протоколом
**1.18.0**). Как поставить пакет и собрать `game.js`, который загрузит шелл, — в
[старте на JS](../../guides/getting-started-js.md).

Бандл регистрирует фабрику через `registerWebBoot`. Шелл вызывает её, передаёт свой хост и контейнер и
дальше шлёт команды в `receive`. `createWebBoot` связывает это с мостом: события моста уходят в
`host.emit`, команды хоста — в `bridge.receive`.

Три обязательных шага после создания игры:

1. `host.ready()` — игра готова принимать команды. До этого шелл держит свой лоадер.
2. `bridge.setUiVisibility(…)` — первое `UiVisibility` шелл считает сигналом «мост поднят»: только после
   него он отправит игре восстановление сессии.
3. `bridge.start()` — стартовая синхронизация: мост повторяет `RequestGameConfig` и `RequestGameState`, пока
   хост не ответит. В mock-режиме (`?mock=1`) мост не спрашивает: отвечает mock-хост.

## API `MineSlotBridge`

`MineSlotBridge extends BridgeBase`. Общие сигналы и методы (`fastGameChanged`, `disabledPlayPressed`,
`requestPlay`, звуки, `setUiVisibility`…) описаны в [ядре JS-моста](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `spinResultReceived` | `MineSlotSpinResult` | пришёл `ApplySpinResult`: ответ сервера на спин, со всеми фри-спинами |
| `gameConfigReceived` | `unknown` | пришёл `ApplyGameConfig`: конфиг платформы как есть |
| `gameStateReceived` | `unknown` | пришёл `ApplyGameState`: `{"status":"none"}` вне раунда |

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `start()` | `RequestGameConfig` + `RequestGameState`, с повтором до ответа | один раз, когда сцена готова |
| `notifySpinReady()` | `SpinReady` | после последнего раунда ответа — ровно один раз |
| `requestPlay()` | `RequestPlay` | игрок тапнул по сцене вместо кнопки Play (из `BridgeBase`) |

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastSpinResult` | `MineSlotSpinResult \| null` | последний ответ на спин |
| `lastGameConfig` | `unknown` | последний конфиг |
| `lastGameState` | `unknown` | последнее состояние |

`ApplySpinResult` мост разбирает `JSON.parse` без проверки формы: форму держит сервер платформы, а хост
проверяет ответ до отправки. Числа и деньги игра читает сама. Сервер присылает деньги строками, а
некоторые коэффициенты — то числом, то строкой. Демо-игра читает их через `readNumber` и `readIndex`
(`js/examples/demo-games/src/modes/mine-slot/mineSlotRead.ts`) и падает с `MineSlotRoundError` на
непонятном значении, вместо того чтобы молча рисовать мусор.

Команда `UpdateCoeffs` из общей синхронизации хоста мостом игнорируется. Любая другая чужая команда
пишется в лог как предупреждение: `[MineSlotBridge] <type> does not belong to mine-slot`.

## Полный пример

Контроллер раунда без движка: очередь ответов, раунды по порядку, кирки, потом динамит, потом сундуки,
один `SpinReady` в конце. Отрисовку подставляет движок через `motions`. Это сокращённый
`MineSlotController` демо-игры. Ответ, который не удалось разобрать, демо не проигрывает: пишет ошибку в
лог, показывает сломанное состояние и `SpinReady` не шлёт, чтобы сбой был виден, а не замаскирован
([правило](README.md#восстановление-и-ошибки)).

```ts
import type { MineSlotBridge } from '@omega/webbridge-js';
import { MINE_SLOT_REELS, type MineSlotHit, type MineSlotSpinResult } from '@omega/webbridge-protocol';

export interface MineSlotMotions {
  spinReels(board: string): Promise<void>;
  strike(hit: MineSlotHit): Promise<void>;            // падение кирки или динамита и урон по блокам
  openChest(column: number, coeff: number): Promise<void>;
  showField(field: string): void;
}

export class MineSlotRound {
  private queue: Promise<void> = Promise.resolve();
  private readonly unsubscribe: () => void;

  public constructor(private readonly bridge: MineSlotBridge, private readonly motions: MineSlotMotions) {
    // Ответы не перекрываются: следующий начнётся, когда доиграет текущий.
    this.unsubscribe = bridge.spinResultReceived.add((result) => {
      this.queue = this.queue.then(() => this.play(result));
    });
  }

  public destroy(): void {
    this.unsubscribe();
  }

  private async play(result: MineSlotSpinResult): Promise<void> {
    this.motions.showField(result.field);                // поле одно на все раунды ответа
    for (let round = 0; round < result.boards.length; round += 1) {
      await this.motions.spinReels(result.boards[round]);
      const ofRound = (hit: MineSlotHit) => hit.round === round;
      for (const hit of result.pickaxes.filter(ofRound)) await this.motions.strike(hit);
      for (const hit of result.tnt.filter(ofRound)) await this.motions.strike(hit);
    }
    for (const chest of result.chests) await this.motions.openChest(chest.col, Number(chest.coeff));
    this.bridge.notifySpinReady();                       // один раз, после всего
  }
}

/** Клетка барабанов → барабан и ряд (строки досок идут по колонкам). */
export const reelOf = (cell: number) => Math.floor(cell / MINE_SLOT_REELS.rows);
export const rowOf = (cell: number) => cell % MINE_SLOT_REELS.rows;
```

Полная игра с анимацией на Canvas 2D — `js/examples/demo-games/src/modes/mine-slot`
(`MineSlotController.ts` — логика раунда, `MineSlotView.ts` — отрисовка, `mineSlotRound.ts` — план ударов
по полю).

## Mock-хост: игра без шелла

`MineSlotMockHost` заменяет шелл и сервер: отвечает на синхронизацию, сам сдаёт доски и поле и держит
«бар» занятым до `SpinReady`, как настоящий хост. Ответы иллюстративные: алфавит и форма — как у бэкенда,
урон посчитан упрощённо.

```ts
import { createWebBoot, MineSlotBridge, MineSlotMockHost } from '@omega/webbridge-js';

const host = new MineSlotMockHost({ currency: 'USD', betAmount: 1 });
const game = boot(host, document.getElementById('web-game-root')!);  // boot — ваша фабрика из createWebBoot
host.attach(game);
host.bindKeys();                                                     // Space — спин, B — купить бонус
```

| Опция | По умолчанию | Что задаёт |
|---|---|---|
| `currency` | `'USD'` | валюта в конфиге и ответах |
| `betAmount` | `1` | ставка, от которой считается `winAmount` |
| `random` | `Math.random` | источник случайности; подставьте сид, чтобы раунды повторялись в тестах |

| Метод | Что делает |
|---|---|
| `attach(game)` | подключить игру, которой хост шлёт команды |
| `spin()` | обычный спин; три скаттера превращают его в бонус из 4 фри-спинов |
| `buyBonus()` | купленный бонус: базовый спин и 4 фри-спина одним ответом |
| `bindKeys(target?)` | Space → `RequestPlay`, B → `buyBonus()`; возвращает функцию отписки |

Пока игра не прислала `SpinReady`, `spin()` и `buyBonus()` ничего не делают, а `RequestPlay` получает
`DisabledPlayPressed`. Так видно, что игра не забыла завершить ход.

Демо-игру с mock-хостом можно запустить из корня WebBridge:

```bash
DEMO_MODE=mine-slot npm run dev -w js/examples/demo-games
```

Страница — `http://localhost:5197/?mock=1`. Подробнее о mock-хостах — в
[mock-режиме](../../concepts/mock-mode.md).

## Проверка

1. **Mock.** `?mock=1`: спин по Space, бонус по B. После каждого хода в логе моста ровно одна строка
   `SpinReady`, следующая клавиша снова работает.
2. **Шелл локально.** Шелл RoadFrontent с `gameMode=mine-slot&gameCategory=mine-slot` и `localBuild=<url
   вашего dev-сервера>`: настоящий dev-бэк, бет-бар, магазин (буст и покупка). Как поднять шелл и
   конфигуратор — в [старте на JS](../../guides/getting-started-js.md).
3. **Стенд тестировщика.** `/admin/games/<id>/playtest` в games-configurator: та же игра в iframe шелла,
   с логом команд и событий поверх.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бет-бар не оживает после спина | не пришёл `SpinReady`: исключение в анимации, `return` до вызова или битый ответ | найти ошибку в логе моста и исправить её; таймером или `finally` её не закрывать |
| Бар ожил посреди бонуса | `SpinReady` после каждого раунда | один вызов после последнего раунда ответа |
| Фри-спины ломают «новое» поле | поле пересоздаётся на каждый раунд | `field` — состояние на начало ответа, применять один раз |
| Выигрыш блоков не сходится | деньги сложены как `number` из строк с 18 знаками | показывать `winAmount`, `payout` — только как подпись |
| Шелл не восстанавливает игру после загрузки | не было `setUiVisibility` | вызвать после `host.ready()` |
| `[MineSlotBridge] X does not belong to mine-slot` в логе | хост шлёт команду другого режима | у игры не тот `gameCategory` в URL шелла |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md)
- Исходники: `js/webbridge/src/mine-slot/` · демо `js/examples/demo-games/src/modes/mine-slot/`
