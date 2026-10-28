# Mock-режим

> Игра без шелла и без сервера: mock-хост внутри игры отвечает на её запросы так, как отвечал бы хост, и
> сам сдаёт ходы. Для разработки сцены, отладки анимаций и демонстраций.

## Что делает mock-хост

1. **Отвечает на синхронизацию.** На `RequestGameConfig` / `RequestGameState` — конфиг режима и
   состояние «нет раунда». Стартовая синхронизация моста при этом не идёт: в mock-режиме мост не
   спрашивает React.
2. **Заменяет бет-бар.** Даёт сделать ход клавишей или кнопкой отладочной панели и отвечает на
   `RequestPlay` (тап по сцене) ходом.
3. **Сдаёт ходы в форме сервера.** Шлёт игре ту же команду режима (`ApplySpinResult`, `ApplyStepResult`…)
   с payload'ом той же формы, что у бэкенда. Исходы иллюстративные: правдоподобные, но не из RNG сервера.
4. **Держит «бар» занятым до конца хода.** Пока игра не прислала событие конца хода (`SpinReady`,
   `DropFinished`…), новый ход не начинается, а `RequestPlay` получает `DisabledPlayPressed`. Так в mock-режиме
   видно, что игра забыла завершить ход, а не только в шелле.

Mock не проверяет то, что делает только хост: лимиты ставок, баланс, окна результата, магазин. Это
проверяется в шелле и на стенде конфигуратора.

## Какие есть

| Режим | JS mock-хост | Unity mock |
|---|---|---|
| [crush](../modes/crush/README.md) | `MockHost` (+ `MockPanel`) | в `RoadWebBridge`: `MockConfig`, панель `MockDebugIMGUI` |
| [twist](../modes/twist/README.md) | — (в демо: `js/examples/demo-games/src/modes/twist/TwistMockHost.ts`) | — (нет Unity-моста) |
| [slot-coin](../modes/slot-coin/README.md) | `SlotCoinMockHost` | — (нет Unity-моста) |
| [wheel](../modes/wheel/README.md) | — (в демо: `js/examples/demo-games/src/modes/wheel/WheelMockHost.ts`) | только без синхронизации, ходы не сдаёт |
| [plinko](../modes/plinko/README.md) | `PlinkoMockHost` | только без синхронизации, ходы не сдаёт |
| [plinko-aztec](../modes/plinko-aztec/README.md) | `PlinkoAztecMockHost` | `PlinkoAztecMockHost`, панель `PlinkoAztecMockDebugIMGUI` |
| [jumper](../modes/jumper/README.md) | `JumperMockHost` | `JumperMockHost`, панель `JumperMockDebugIMGUI` |
| [mine-slot](../modes/mine-slot/README.md) | `MineSlotMockHost` | `MineSlotMockHost`, панель `MineSlotMockDebugIMGUI` |

Опции, клавиши и настройки каждого — в `js.md` и `unity.md` режима.

## Как включить

### JS

Флаг — параметр URL страницы: `?mock=1` (или `?mock=true`). Его читает `isMockEnabled()` из
`@omega/webbridge-js`, и при нём `BridgeBase` не запускает стартовую синхронизацию. Сам mock-хост
подключает страница разработки игры:

```ts
const host = new MineSlotMockHost();           // любой <Mode>MockHost
host.attach(boot(host, container));            // boot — фабрика игры из createWebBoot
host.bindKeys();                               // клавиши хода
```

Так устроены демо-игры: `DEMO_MODE=<mode> npm run dev -w js/examples/demo-games` и
`http://localhost:<порт>/?mock=1`. Порты — в [README демо-игр](../../js/examples/demo-games/README.md).

### Unity

| Где | Как | Где работает |
|---|---|---|
| **Tools → WebBridge → Enable Mock** | флаг в `EditorPrefs` (`WebBridge_EnableMock`) | только Play Mode редактора |
| **Tools → WebBridge → Enable Mock In Build** | define `WEBBRIDGE_MOCK` | и в сборке |

Флаг читается из `WebBridgeUtils.IsMockEnabled`; переопределить его из кода нельзя. Mock-хост мост
создаёт сам в `Start()` и вешает на свой GameObject отладочную панель (IMGUI). Панель свёрнута в
перетаскиваемую кнопку с подписью режима.

> **Сборку с `WEBBRIDGE_MOCK` нельзя отдавать в шелл.** Она отвечает сама себе и не слушает React.
> Перед релизной сборкой снимите **Enable Mock In Build**.

Отдельно от mock есть **cheats-режим** (`?cheats=1` в JS; **Tools → WebBridge → Enable Cheats** и define
`WEBBRIDGE_CHEATS` в Unity): он включает отладочное управление RNG в настоящей игре с настоящим хостом.
См. `CheatBridge` в [ядре Unity-моста](../reference/unity-core.md).

## Смотрите также

- [Жизненный цикл раунда](round-lifecycle.md): что mock эмулирует
- [Ядро JS-моста](../reference/js-core.md) (`MockHost`, `MockPanel`, `isMockEnabled`) ·
  [Ядро Unity-моста](../reference/unity-core.md) (`MockConfig`, `DebugPanelIMGUI`)
