# Архитектура

> WebBridge — контракт и две его реализации на стороне игры. По нему React-шелл (хост) управляет игрой на
> Unity WebGL или на любом JS-движке, а игра отвечает событиями.

## Три участника

```mermaid
flowchart LR
    subgraph Platform["Платформа"]
        S[(Игровой сервер<br/>WebSocket)]
        C[games-configurator<br/>сборки, раскладка, тексты]
    end
    subgraph Host["Хост — React-шелл (RoadFrontent)"]
        M[Режим<br/>src/modes/&lt;id&gt;]
        A[Адаптер движка<br/>src/engine/unity · web]
    end
    subgraph Game["Игра"]
        U[Unity WebGL<br/>com.pixi.webbridge]
        W[Веб-игра<br/>@omega/webbridge-js]
    end
    S <--> M
    C --> Host
    M -- EngineCommand --> A
    A -- EngineEvent --> M
    A <-- "SendMessage / SendToReact" --> U
    A <-- "receive / host.emit" --> W
```

| Кто | Чем владеет | Чего не делает |
|---|---|---|
| **Хост** (React-шелл) | ставка, баланс, лимиты, бет-бар, автоплей, магазин, окна результата, запросы к серверу, проверка ответов | не рисует раунд |
| **Игра** (Unity или JS) | сцена: анимация хода, раскрытие исхода, звуки по ходу, свой UI на поле | не ходит на сервер, не решает, можно ли ставить |
| **WebBridge** | контракт между ними и мосты на стороне игры | не знает ни про геймплей, ни про React |

Главное правило зависимостей: **игра зависит от моста, мост — ни от игры, ни от движка**. Unity-мост не
ссылается на игровые объекты, JS-мост не импортирует Phaser или Pixi.

## Репозиторий

```
protocol/            @omega/webbridge-protocol — контракт: команды, события, payload'ы (TypeScript)
js/webbridge/        @omega/webbridge-js — мост для веб-игр: BridgeBase, мосты режимов, mock-хосты, web boot, vite-плагин
js/examples/         демо-игры на Canvas 2D (по одной на режим), заглушки
unity/Assets/WebBridge/  UPM-пакет com.pixi.webbridge — мост для Unity: WebBridgeBase<T>, мосты режимов, mock, сервисы
docs/                эта документация
```

1. **Контракт правится только в `protocol/`.** JS-мост и фронтенд импортируют типы оттуда. Unity-мост
   повторяет их в C# вручную: автоматической сверки имён пока нет, поэтому новое сообщение проверяется
   живым прогоном в шелле.
2. **JS-мост зеркалит C#.** Имена соответствуют друг другу: `WebBridgeBase<T>` → `BridgeBase`,
   `RoadWebBridge` → `CrushBridge`, `MineSlotWebBridge` → `MineSlotBridge`, `event Action<T>` → `Signal<T>`.
3. **Хост — отдельный репозиторий** (RoadFrontent). Он импортирует `@omega/webbridge-protocol` и знает
   проводной формат Unity (`src/engine/unity/unityProtocol.ts`) и веб-игры (`src/engine/web`).

## Один контракт — два провода

Команды и события — дискриминированные союзы `EngineCommand` и `EngineEvent` с полем `type`. По проводу
они идут по-разному:

| | Unity WebGL | Веб-игра (JS) |
|---|---|---|
| Хост → игра | `unityInstance.SendMessage("WebBridge", <метод>, <payload>)`; payload — строка (часто JSON) или число. Метод обычно совпадает с `type`; уведомления UI-слоя идут в `On<type>` (`CashoutPressed` → `OnCashoutPressed`), `ApplyBonusStepResult` — в `ApplyStepResult` | `game.receive(command)` — структура, без сериализации |
| Игра → хост | `WebBridgeUtils.Send(message)` → функция `SendToReact` из `.jslib` **игры** → событие `SendToReact` у react-unity-webgl, со строкой | `host.emit(event)` — структура |
| Формат событий | строка: `SpinReady`, `PlaySound_<key>`, `UiVisibility_<json>`… ([`unityWire.ts`](../../protocol/src/unityWire.ts)) | объект `{ type, … }` |
| Готовность игры | `isLoaded` загрузчика Unity | `host.ready()` |
| Точка входа | сцена с объектом `WebBridge` | `window.__WEB_GAME_BOOT__` (`registerWebBoot`) |

Поэтому многие payload'ы в протоколе — строки. Хост сериализует их один раз, Unity разбирает сам, а
JS-мост делает `JSON.parse`. Подробности обоих проводов — в [общем протоколе](core-protocol.md).

Какой движок поднять, хост решает по сборке: конфигуратор пишет `engine` (`unity` или `web`) в
конфигурацию релиза. Для отладки движок можно переопределить параметром `?engine=web`.

## Режим

Режим — механика с собственным каналом команд и событий: `crush`, `twist`, `slot-coin`, `wheel`,
`plinko`, `plinko-aztec`, `jumper`, `mine-slot`. Канал режима — тип `ModeProtocols[id]`
([`modes.ts`](../../protocol/src/modes.ts)), поверх общего `CoreCommand` / `CoreEvent`.

У каждого режима:

- **в протоколе** — свои команды и события (часто это общие `ApplySpinResult` и `SpinReady`) и типы
  payload'ов;
- **в JS** — класс `<Mode>Bridge extends BridgeBase` и, обычно, `<Mode>MockHost`;
- **в Unity** — компонент `<Mode>WebBridge : WebBridgeBase<T>` с префабом и mock-хостом (не у всех
  режимов, см. таблицу в [README](../../README.md#режимы));
- **в хосте** — модуль `src/modes/<id>` в RoadFrontent: раунд, запросы к серверу, экран;
- **в конфигураторе** — `GameMode` и launch identity (`gameMode` бэкенда + `gameCategory` шелла).

Один и тот же режим в разных местах называется немного по-разному:

| Протокол (`ModeProtocols`) | Шелл (`gameCategory`) | Конфигуратор (`GameMode`) | Бэкенд (`gameMode`) | JS | Unity |
|---|---|---|---|---|---|
| `crush` | `road` | `crush` | `chicken-road-two` (бонус — `peperoad`) | `CrushBridge` | `RoadWebBridge` |
| `twist` | `twist` | `twist` | `twist` (бонус — `twist-san-quentin`) | `TwistBridge` | — |
| `slotCoin` | `slot-coin` | `slot-coin` | `chicken-coin` | `SlotCoinBridge` | — |
| `wheel` | `wheel` | `wheel` | `wheel` | `WheelBridge` | `WheelWebBridge` |
| `plinko` | `plinko` | `plinko` | `plinko` | `PlinkoBridge` | `PlinkoWebBridge` |
| `plinkoAztec` | `plinko-aztec` | `plinko-aztec` | `plinko-aztec` | `PlinkoAztecBridge` | `PlinkoAztecWebBridge` |
| `jumper` | `jumper` | `jumper` | `jumper` | `JumperBridge` | `JumperWebBridge` |
| `mineSlot` | `mine-slot` | `mine-slot` | `mine-slot` | `MineSlotBridge` | `MineSlotWebBridge` |

## Кто задаёт темп

Сервер отвечает раньше, чем игра доиграет анимацию. Если хост сразу покажет выигрыш или разблокирует
бар, он раскроет исход раньше, чем игрок увидит его на экране. Поэтому:

- хост **паркует** ответ сервера и держит бар залоченным;
- игра проигрывает ход и сообщает «доиграно» событием режима: `SpinReady`, `DropFinished`, `RoundShown`;
- хост раскрывает выигрыш **на этом событии** и только потом оживляет бар.

Таймаута на стороне хоста нет. Событие конца хода — обязанность игры: если оно не пришло, это ошибка
сборки игры, а не повод для таймера. Подробно — в [жизненном цикле раунда](round-lifecycle.md).

## Версии и совместимость

| Пакет | Где версия | Как выходит |
|---|---|---|
| `@omega/webbridge-protocol` | `protocol/package.json` | тег `protocol-v<x.y.z>` + GitHub Release с tarball |
| `@omega/webbridge-js` | `js/webbridge/package.json` | GitHub Release `js-v<x.y.z>`; зависит от tarball протокола |
| `com.pixi.webbridge` | `unity/Assets/WebBridge/package.json` | тег `unity-v<x.y.z>` |

Протокол меняется **только добавлением**: выпущенные игры и шеллы живут со старыми версиями. Новая
команда или поле добавляются, удаление — только через новую версию с переходным периодом.
Переименования оставляют `@deprecated`-псевдонимы: `legacySlotNames.ts` (`slot` → `slot-coin`) и
`legacyPhaserNames.ts` (`__PHASER_BOOT__` → `__WEB_GAME_BOOT__`). Как выпускать — в
[релизах](../guides/releasing.md).
