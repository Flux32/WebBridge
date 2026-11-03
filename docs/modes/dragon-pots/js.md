# Dragon Pots — JS

> Как подключить Dragon Pots к веб-игре на любом JS-движке (Phaser, Pixi, three.js, Canvas).
> Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```ts
import { createWebBoot, DragonPotsBridge, registerWebBoot } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new DragonPotsBridge(transport),
    createGame: (bridge, container, _options, host) => {
      const game = new MyDragonGame(container);               // ваш движок
      bridge.spinResultReceived.add(async (reply) => {
        const { roundResult } = reply;
        await game.spin(roundResult.mainGameResult);           // барабаны и способы
        await game.dropCoins(roundResult);                     // монеты в котлы, лопнувшие котлы
        if (roundResult.jackpotResult) await game.jackpotPick(roundResult.jackpotResult);
        if (roundResult.holdAndWinResult) await game.holdAndWin(roundResult.holdAndWinResult);
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

Очередь ответов и Hold & Win по попыткам — в [полном примере](#полный-пример).

## Установка и точка входа

`DragonPotsBridge` и `DragonPotsMockHost` — в `@omega/webbridge-js` с версии **1.18.0** (вместе с протоколом
**1.20.0**). Как поставить пакет и собрать `game.js`, который загрузит шелл, — в
[старте на JS](../../guides/getting-started-js.md).

Три обязательных шага после создания игры — как у любого режима:

1. `host.ready()` — игра готова принимать команды. До этого шелл держит свой лоадер.
2. `bridge.setUiVisibility(…)` — первое `UiVisibility` шелл считает сигналом «мост поднят».
3. `bridge.start()` — стартовая синхронизация: мост повторяет `RequestGameConfig` и `RequestGameState`, пока
   хост не ответит. В mock-режиме (`?mock=1`) мост не спрашивает: отвечает mock-хост.

## API `DragonPotsBridge`

`DragonPotsBridge extends BridgeBase`. Общие сигналы и методы (`fastGameChanged`, `isFastGameEnabled`,
`disabledPlayPressed`, `requestPlay`, звуки, `setUiVisibility`…) описаны в
[ядре JS-моста](../../reference/js-core.md).

### Сигналы (хост → игра)

| Сигнал | Тип значения | Когда срабатывает |
|---|---|---|
| `spinResultReceived` | `DragonPotsSpinResult` | пришёл `ApplySpinResult`: весь раунд — спин или покупка |
| `gameConfigReceived` | `unknown` | пришёл `ApplyGameConfig`: конфиг платформы как есть |
| `gameStateReceived` | `DragonPotsGameState` (`{}`) | пришёл `ApplyGameState`; восстанавливать нечего |

### Методы (игра → хост)

| Метод | Что отправляет | Когда звать |
|---|---|---|
| `start()` | `RequestGameConfig` + `RequestGameState`, с повтором до ответа | один раз, когда сцена готова |
| `notifySpinReady()` | `SpinReady` | когда раунд доигран целиком и показан итог — ровно один раз на `ApplySpinResult` |
| `requestPlay()` | `RequestPlay` | игрок тапнул по сцене вместо кнопки Play (из `BridgeBase`) |

`requestStep()` у моста нет: шагов у режима не бывает.

### Состояние

| Свойство | Тип | Что хранит |
|---|---|---|
| `lastSpinResult` | `DragonPotsSpinResult \| null` | последний ответ на спин |
| `lastGameConfig` | `unknown` | последний конфиг |
| `lastGameState` | `DragonPotsGameState \| null` | последнее состояние (`{}`) |

Мост разбирает payload'ы `JSON.parse` без проверки формы: форму держит сервер платформы. Демо-игра читает
поля через свои читатели (`js/examples/demo-games/src/modes/dragon-pots/dragonPotsRead.ts`) и падает с
`DragonPotsRoundError` на непонятном значении, вместо того чтобы молча рисовать мусор.

Команда `UpdateCoeffs` из общей синхронизации хоста мостом игнорируется. Любая другая чужая команда, в том
числе `ApplyBonusStepResult`, пишется в лог как предупреждение:
`[DragonPotsBridge] <type> does not belong to dragon-pots`.

## Полный пример

Контроллер раунда без движка: очередь ответов, фазы в порядке сервера, Hold & Win по попыткам и один
`SpinReady`. Отрисовку подставляет движок через `motions`. Это сокращённый `DragonPotsController`
демо-игры: в нём ещё проверка ответа и сломанное состояние вместо `SpinReady` на битом ответе
([правило](README.md#восстановление-и-ошибки)).

```ts
import type { DragonPotsBridge } from '@omega/webbridge-js';
import type {
  DragonPotsHoldAndWinCoin,
  DragonPotsHoldAndWinResult,
  DragonPotsJackpotResult,
  DragonPotsSpinResult,
} from '@omega/webbridge-protocol';
import { DRAGON_POTS_BONUS_BUYS, DRAGON_POTS_BONUS_TYPES, type DragonPotsPotColor } from '@omega/webbridge-protocol';

export interface DragonMotions {
  spin(reply: DragonPotsSpinResult): Promise<void>;               // и подсветка winsHighlight
  dropCoins(reply: DragonPotsSpinResult, burst: readonly DragonPotsPotColor[]): Promise<void>;
  revealTile(index: number, jackpot: DragonPotsJackpotResult): Promise<void>;
  openHoldAndWin(holdAndWin: DragonPotsHoldAndWinResult): Promise<void>;
  respin(respinsLeft: number): Promise<void>;
  landCoin(coin: DragonPotsHoldAndWinCoin): Promise<void>;       // итог — coin.currentWinAmount
  showTotal(winAmount: string): Promise<void>;
}

/** Котлы, которые лопаются: по имени исхода, а у покупки — по доске Hold & Win. */
const burstPots = ({ roundResult }: DragonPotsSpinResult): readonly DragonPotsPotColor[] => {
  const { bonusTypeName, holdAndWinResult } = roundResult;
  if (bonusTypeName !== '') return DRAGON_POTS_BONUS_TYPES[bonusTypeName].pots;
  if (holdAndWinResult === undefined) return [];
  const bought = Object.values(DRAGON_POTS_BONUS_BUYS).find((buy) => buy.boardSize === holdAndWinResult.boardSize);
  return bought?.pots ?? [];
};

export class DragonRound {
  private queue: Promise<void> = Promise.resolve();

  public constructor(private readonly bridge: DragonPotsBridge, private readonly motions: DragonMotions) {
    bridge.spinResultReceived.add((reply) => (this.queue = this.queue.then(() => this.play(reply))));
  }

  private async play(reply: DragonPotsSpinResult): Promise<void> {
    const { roundResult } = reply;
    await this.motions.spin(reply);
    if (roundResult.coins.length > 0) await this.motions.dropCoins(reply, burstPots(reply));
    const jackpot = roundResult.jackpotResult;
    if (jackpot !== undefined) {
      for (let index = 0; index < jackpot.scenario.length; index += 1) await this.motions.revealTile(index, jackpot);
    }
    if (roundResult.holdAndWinResult !== undefined) await this.playHoldAndWin(roundResult.holdAndWinResult);
    await this.motions.showTotal(reply.winAmount);                // верхний winAmount, не roundResult.winAmount
    this.bridge.notifySpinReady();                                // один раз на ответ
  }

  private async playHoldAndWin(holdAndWin: DragonPotsHoldAndWinResult): Promise<void> {
    await this.motions.openHoldAndWin(holdAndWin);                // initial.coins уже на доске
    for (const spin of holdAndWin.spins) {
      let respinsLeft = 3;
      for (const attempt of spin.tries) {
        await this.motions.respin(respinsLeft);
        if (attempt.openedCoins.length === 0) respinsLeft -= 1;
        for (const coin of attempt.openedCoins) await this.motions.landCoin(coin);
      }
    }
  }
}
```

Полная игра с анимацией на Canvas 2D — `js/examples/demo-games/src/modes/dragon-pots`
(`DragonPotsController.ts` — логика раунда, `DragonPotsView.ts` — отрисовка, `dragonPotsRound.ts` и
`dragonPotsFeatures.ts` — разбор ответа). Fast game демо берёт из `bridge.isFastGameEnabled`: все движения
идут за 40 % своего времени.

## Mock-хост: игра без шелла

`DragonPotsMockHost` заменяет шелл и сервер. Он отвечает на синхронизацию, сдаёт раунды в форме stage-бэка
и держит «бар» занятым до `SpinReady`, как настоящий хост. Сначала он выбирает исход котлов (случайно,
по клавише или покупкой), потом раскладывает монеты под этот исход. Способы mock считает по готовой
матрице и повторяет `wins` и `winsHighlight` всех 13 записанных досок. Пик кончается третьей плиткой
уровня, Hold & Win идёт по правилу «монета собирает доску». Таблица выплат кроме записанных значений,
веса и номиналы монет — иллюстративные.

```ts
import { DragonPotsMockHost } from '@omega/webbridge-js';

const host = new DragonPotsMockHost({ currency: 'USD', bet: 1 });
const game = boot(host, document.getElementById('web-game-root')!);  // boot — ваша фабрика из createWebBoot
host.attach(game);
host.bindKeys();
```

| Опция | По умолчанию | Что задаёт |
|---|---|---|
| `currency` | `'USD'` | валюта в конфиге и ответах |
| `bet` | `1` | ставка; покупка стоит `bet × 30` / `× 55` / `× 80` |
| `random` | `Math.random` | источник случайности; подставьте сид, чтобы раунды повторялись в тестах |

| Метод / клавиша | Что делает |
|---|---|
| `attach(game)` | подключить игру, которой хост шлёт команды |
| `spin()` · Space | обычный спин (Space шлёт `RequestPlay`) |
| `spin('Mighty')` … `spin('Ultimate')` · 1…7 | спин, в котором котлы дают этот исход; цифра = `bonusTypeIndex` + 1 |
| `spin('Lose')` · 8 | монеты падают, котлы не срабатывают |
| `buyBonus('Mighty' \| 'Mega' \| 'Super')` · B / N / M | покупка по полной цене |
| `resync()` · G | `ApplyGameState` — всегда `{}`, как `get-game-state` |
| `toggleFastGame()` · F | переключает `SetFastGame`, как тумблер бет-бара |

Пока игра не прислала `SpinReady`, `spin()` и покупки ничего не делают и пишут предупреждение (сервер
ответил бы `Active round already exist`), а `RequestPlay` получает `DisabledPlayPressed`. Тип исхода для
`spin()` — `DragonPotsMockOutcome`.

Демо-игру с mock-хостом можно запустить из корня WebBridge:

```bash
DEMO_MODE=dragon-pots npm run dev -w js/examples/demo-games
```

Страница — `http://localhost:5199/?mock=1`. Подробнее о mock-хостах — в
[mock-режиме](../../concepts/mock-mode.md).

## Проверка

1. **Mock.** `?mock=1`: Space — спин, 1…8 — исходы котлов, B / N / M — покупки. В логе моста на каждый
   `ApplySpinResult` — ровно один `SpinReady`, и только после итога. Клавиша 7 (Ultimate) показывает
   все фазы подряд.
2. **Шелл локально.** Шелл RoadFrontent с `gameMode=dragon-pots&gameCategory=dragon-pots` и
   `localBuild=<url вашего dev-сервера>`: stage-бэк, бет-бар, магазин из трёх покупок.
3. **Стенд тестировщика.** `/admin/games/<id>/playtest` в games-configurator: та же игра в iframe шелла,
   с логом команд и событий поверх.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бет-бар не оживает после Hold & Win | не пришёл `SpinReady`: исключение в анимации, `return` до вызова или битый ответ | найти ошибку в логе моста; таймером или `finally` её не закрывать |
| Бар ожил посреди Hold & Win | `SpinReady` после базы или после фичи | один вызов после итога раунда |
| Покупка ничего не запускает | фичу искали по `bonusTypeName` | у покупки имя пустое; Hold & Win — по наличию `holdAndWinResult` |
| Итог Hold & Win не сходится с ответом | сложены `coinCoeff` монет на доске | итог — `currentWinAmount` последней упавшей монеты |
| Итог раунда на цент больше баланса | показан `roundResult.winAmount` или сумма частей | итог — верхний `winAmount` |
| Символы не в тех клетках | `matrix` прочитана как `[reel][row]` | `matrix[row][reel]` |
| `[DragonPotsBridge] X does not belong to dragon-pots` в логе | хост шлёт команду другого режима | у игры не тот `gameCategory` в URL шелла |

## Смотрите также

- [Обзор режима](README.md) · [Unity-версия](unity.md)
- [Ядро JS-моста](../../reference/js-core.md) · [Старт на JS](../../guides/getting-started-js.md)
- Исходники: `js/webbridge/src/dragon-pots/` · демо `js/examples/demo-games/src/modes/dragon-pots/`
