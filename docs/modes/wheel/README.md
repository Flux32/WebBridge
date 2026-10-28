# Wheel

> Общее для всех игроков колесо цветов. Сервер сам по расписанию открывает приём ставок, крутит колесо и
> объявляет цвет. Хост пересылает каждую смену фазы снимком `ApplyRound`. Игра крутит колесо к выпавшей
> ячейке и один раз за раунд отвечает `RoundShown`, когда исход показан.

|  |  |
|---|---|
| **Id режима** | протокол `ModeProtocols['wheel']` · шелл `wheel` · конфигуратор `wheel` · бэкенд `gameMode=wheel` |
| **JS-мост** | [`WheelBridge`](js.md) · mock-хоста в пакете нет (есть в демо: `WheelMockHost`) |
| **Unity-мост** | [`WheelWebBridge`](unity.md) · префаба нет · namespace `Modules.Wheel` |
| **Демо** | `js/examples/demo-games/src/modes/wheel` (порт 5195, `?mock=1`) |
| **С версии** | protocol `1.1.0` (`SetWheelBetBarMetrics` — с `1.13.0`) · js `1.15.0` · Unity-пакет `1.0.0` |
| **Исходник контракта** | [`protocol/src/commands.ts`](../../../protocol/src/commands.ts) (`WheelCommand`), [`events.ts`](../../../protocol/src/events.ts) (`WheelEvent`), [`payloads.ts`](../../../protocol/src/payloads.ts) (`WheelBetBarMetricsPayload`) |

## Механика

Колесо из 54 ячеек четырёх цветов. Множитель закреплён за цветом: `BLACK` ×2, `RED` ×3, `BLUE` ×5,
`GREEN` ×50. Игрок ставит на цвет в баре колеса (хост). Ставку принимают только в фазе приёма ставок,
одну на раунд. Ставка, сделанная во время вращения, уходит в следующий раунд.

Раунд идёт на сервере **с игроком или без него** и один на всех. Игра раунд не начинает и ни о чём не
спрашивает сервер. Она показывает фазу, о которой ей сказали:

| Фаза (`status`) | Что на экране | Что приходит в снимке |
|---|---|---|
| `WAIT_GAME` | приём ставок, отсчёт до старта | `msToNextPhase` — сколько осталось до вращения |
| `IN_GAME` | колесо крутится к выпавшей ячейке | `cellIndex`, `inCellOffset` |
| `FINISH_GAME` | колесо стоит, цвет объявлен | `winnerColor` |
| `STOPPED` | раунды остановлены на бэкенде | — |

Раскладку ячеек хост не присылает: её знает игра. Индекс `cellIndex` — номер ячейки в раскладке колеса
бэкенда. Продовый клиент начинает её с `GREEN, BLUE, RED, BLACK, …`
(RoadFrontent `src/modes/wheel/PROTOCOL.md`). Полный порядок ячеек нужно взять у бэкенда (см. правило 6).

## Раунд по шагам

```mermaid
sequenceDiagram
    autonumber
    participant S as Сервер
    participant H as Хост (React-шелл)
    participant G as Игра
    S-->>H: game-status-changed {status: WAIT_GAME, nextChangeInMs, gameId}
    H->>G: ApplyRound {status: WAIT_GAME, msToNextPhase}
    Note over H: игрок ставит на цвет в баре колеса
    H->>S: play {amount, currency, value: {color}}
    S-->>H: принятая ставка; bet-list-updated
    H->>G: ApplyRound (повтор WAIT_GAME)
    S-->>H: game-status-changed {status: IN_GAME, cellIndex, inCellOffset}
    H->>G: ApplyRound {status: IN_GAME, cellIndex, inCellOffset}
    G->>G: колесо крутится к ячейке
    S-->>H: game-status-changed {status: FINISH_GAME, cellColor}
    H->>G: ApplyRound {status: FINISH_GAME, winnerColor}
    S-->>H: withdraw-result {winAmount, currency}
    Note over H: выплата паркуется
    G-->>H: RoundShown (один раз за раунд)
    Note over H: выплата видна, окно результата, баннер над баром
```

1. Хост следит за раундом сам. Он подписан на события сервера и спрашивает `get-game-state` на старте и
   после переподключения. В игру уходит только то, что нужно сцене: фаза, номер раунда, остаток времени,
   ячейка, цвет.
2. `ApplyRound` уходит на **каждое** изменение состояния раунда у хоста, а не только на смену фазы. Это
   и ставка любого игрока (`bet-list-updated`), и своя ставка, и выплата, и раскрытие после `RoundShown`.
   Поэтому одна фаза приходит много раз подряд.
3. На `IN_GAME` игра узнаёт ячейку и крутит колесо. Цвета в этом снимке ещё нет.
4. На `FINISH_GAME` приходит цвет. Ячейки в этом снимке может не быть: хост кладёт в него только то, что
   прислал сервер в этой фазе. Ячейку из `IN_GAME` игра помнит сама.
5. Выплату (`withdraw-result`) хост держит у себя, пока игра не скажет `RoundShown`. Показать её раньше —
   значит раскрыть исход до того, как колесо встало.
6. `RoundShown` уходит, когда колесо остановилось **и** пришёл `FINISH_GAME`. На нём хост показывает
   выплату, открывает окно результата (если админ включил его для этого исхода) и проигрывает баннер
   результата над баром.
7. Следующий `WAIT_GAME` — новый раунд. Хост убирает баннер, обнуляет доску ставок и выплату.

## Команды хоста → игра

| Команда | Когда приходит | Payload | Что делает игра |
|---|---|---|---|
| `ApplyRound` | сразу после загрузки движка; на каждое изменение раунда у хоста (повторы — норма); после `RequestGameState` | JSON-строка [`WheelRoundMessage`](#wheelroundmessage) | сливает снимок с тем, что знает о раунде; на `IN_GAME` крутит колесо; после остановки и `FINISH_GAME` показывает цвет и шлёт `RoundShown` |
| `SetWheelBetBarMetrics` | после загрузки движка; когда бар колеса сдвинулся, сменил размер или масштаб; в ответ на `RequestBetBarViewportMetrics` | JSON-строка [`WheelBetBarMetricsPayload`](#wheelbetbarmetricspayload) | раскладывает колесо над баром |

У колеса **своя** команда метрик бара, а не общие `SetDesktopBetBarViewportMetrics` /
`SetMobileBetBarViewportMetrics`. У бара колеса нет ни кнопки Play, ни панели бонуса. Его края — полоса
отсчёта раунда и лента истории.

Колесо работает на старом экране шелла (`App`), и общая синхронизация конфига road шлёт ему ещё
`UpdateCoeffs` и `ApplyGameConfig` (лесенка коэффициентов). Колесу в них брать нечего. `WheelBridge`
их молча пропускает. У `WheelWebBridge` нет приёмников под эти команды (см. [unity.md](unity.md#частые-ошибки)).
`ApplyGameState` колесу не шлют: текущий раунд приходит `ApplyRound`.

Остальное — общие команды: `SetFastGame`, `ApplyWhiteLabel`, `ApplyTranslations`, `SetCanvasSize`,
`WinWindowOpened` / `WinWindowClosed` и прочие ([общий протокол](../../concepts/core-protocol.md)).

## События игры → хост

| Событие | Когда слать | Что делает хост |
|---|---|---|
| `RoundShown` | один раз за раунд: колесо встало и пришёл `FINISH_GAME`, показ цвета доигран | раскрывает припаркованную выплату, открывает окно результата, проигрывает баннер над баром |
| `RequestGameState` | на старте сцены; когда игра потеряла раунд | перечитывает `get-game-state` и шлёт свежий `ApplyRound` |
| `RequestBetBarViewportMetrics` | на старте сцены, если первые метрики могли прийти раньше, чем сцена их ждала | шлёт `SetWheelBetBarMetrics` заново |
| `UiVisibility` | на старте сцены | первое `UiVisibility` — знак хосту, что мост поднят ([общий протокол](../../concepts/core-protocol.md)) |

`RequestGameConfig` колесу ничего полезного не даёт: ответ — лесенка road (`UpdateCoeffs`,
`ApplyGameConfig`). Unity-мост всё равно шлёт его вместе с `RequestGameState` в стартовой синхронизации,
это безвредно.

`SpinReady` колесо **не шлёт**. Бар колеса управляется фазой раунда, а не движком: ставку принимают в
`WAIT_GAME`, в остальных фазах кнопка закрыта. `RequestPlay` в контракт колеса не входит. Ставка на цвет
делается только в баре колеса.

## Данные

### `WheelRoundMessage`

JSON-строка `ApplyRound`. Отдельного типа в `protocol/src` у неё нет: форма задана хостом
(RoadFrontent `src/modes/wheel/engineMessage.ts`, `WheelRoundMessage`) и C#-классом `WebWheelRoundPayload`.

```ts
interface WheelRoundMessage {
  status: 'WAIT_GAME' | 'IN_GAME' | 'FINISH_GAME' | 'STOPPED';
  /** Номер раунда бэкенда (`gameId`) строкой; на экране — «Round ID». null — бэкенд не прислал. */
  roundId: string | null;
  /** Сколько мс осталось до смены фазы на момент отправки. null — срока нет. */
  msToNextPhase: number | null;
  /** Выпавший цвет. Приходит с FINISH_GAME, до этого null. */
  winnerColor: 'BLACK' | 'RED' | 'BLUE' | 'GREEN' | null;
  /** Индекс выпавшей ячейки в раскладке колеса. Приходит с IN_GAME. */
  cellIndex: number | null;
  /** Точка остановки стрелки внутри ячейки, доля ячейки 0..1. Приходит с IN_GAME. */
  inCellOffset: number | null;
}
```

Как хост собирает поля:

| Поле | Откуда | Тонкости |
|---|---|---|
| `status` | `status` снимка сервера | всегда есть: снимок без статуса хост отбрасывает |
| `roundId` | `gameId` (строка или число) → строка | — |
| `msToNextPhase` | `nextChangeInMs` → дедлайн у хоста → остаток `max(0, дедлайн − сейчас)` в момент отправки | каждый повтор пересчитывает остаток заново. Если сервер не назвал срок новой фазы (кроме `WAIT_GAME`), хост оставляет дедлайн прошлой фазы, и приходит `0` |
| `winnerColor` | `cellColor` снимка | в верхнем регистре, как у бэкенда |
| `cellIndex`, `inCellOffset` | `cellIndex`, `inCellOffset` снимка | хост не переносит их между фазами: в `FINISH_GAME` их может не быть |

Пример: снимки одного раунда. Форма — по коду хоста; значения иллюстративные (так их шлёт демо-мок
`WheelMockHost`), а не запись с dev-бэка.

```json
{"status":"WAIT_GAME","roundId":"1842","msToNextPhase":4870,"winnerColor":null,"cellIndex":null,"inCellOffset":null}
{"status":"IN_GAME","roundId":"1842","msToNextPhase":3990,"winnerColor":null,"cellIndex":17,"inCellOffset":0.42}
{"status":"FINISH_GAME","roundId":"1842","msToNextPhase":2990,"winnerColor":"RED","cellIndex":null,"inCellOffset":null}
{"status":"STOPPED","roundId":"1842","msToNextPhase":null,"winnerColor":null,"cellIndex":null,"inCellOffset":null}
```

### `WheelBetBarMetricsPayload`

JSON-строка `SetWheelBetBarMetrics` (`protocol/src/payloads.ts`). Высоты — доли холста движка от его
**нижнего** края (0..1, как Unity viewport).

```ts
interface WheelBetBarMetricsPayload {
  /** Ширина колонки бара (полоса отсчёта, панель ставок, доска) в долях ширины холста. */
  widthViewport: number;
  /** До верхней кромки бара: надпись «PLACE YOUR BETS» над полосой отсчёта раунда. */
  betBarTopViewport: number;
  /** До верхней кромки ленты истории (шарики прошлых раундов) под полосой отсчёта. */
  historyTopViewport: number;
  /** Масштаб бара относительно макета 1920×1080: 1 — дизайн-размер, 0.5 — вдвое меньше. */
  betBarScale: number;
}
```

Хост меряет бар по DOM и округляет доли до 4 знаков: колебания раскладки меньше пикселя метрики не
меняют. Повтор с теми же числами он не шлёт, кроме ответа на `RequestBetBarViewportMetrics`.

```json
{"widthViewport":1,"betBarTopViewport":0.36,"historyTopViewport":0.3,"betBarScale":0.5}
```

Колесо раскладывается над `betBarTopViewport`. Полоса отсчёта видна только во время приёма ставок. В
другие фазы бар заканчивается на `historyTopViewport`, и то, что может уйти под полосу отсчёта,
можно раскладывать над ним.

## Правила и инварианты

1. **Раунд начинает сервер, а не игра.** Команды «крути» нет. Вращение — реакция на снимок `IN_GAME`.
   Иначе колёса разных игроков разойдутся с общим раундом.
2. **`ApplyRound` идемпотентен.** Повтор той же фазы ничего не меняет на экране. Новый раунд — это новый
   `roundId` или переход в `WAIT_GAME` из другой фазы. Хост шлёт снимок на каждую ставку любого игрока,
   и колесо, которое перезапускает вращение на повторе, дёргается десятки раз за раунд.
3. **Отсчёт берётся из первого снимка фазы.** Повторы пересчитывают остаток от «сейчас» хоста, и с
   задержкой доставки он прыгает назад. Новый дедлайн принимать только при смене фазы.
4. **Ячейку из `IN_GAME` запомнить.** `FINISH_GAME` может прийти без `cellIndex`: хост не переносит его
   из прошлой фазы.
5. **`RoundShown` — ровно один раз за раунд**, после остановки колеса **и** прихода `FINISH_GAME`. Раньше —
   спойлер: хост раскроет выплату и откроет окно, пока колесо ещё крутится. Повтор — второе окно и
   второй баннер. `RoundShown` шлётся и тогда, когда игрок в раунде не ставил: окно для исхода `noBet`
   включает админ.
6. **Раскладка ячеек у игры совпадает с бэкендом.** `cellIndex` — индекс в раскладке бэкенда. Если у
   игры она другая, стрелка встанет на ячейку не того цвета, что `winnerColor`. На `FINISH_GAME` прав
   `winnerColor`: игра сверяет цвет ячейки под стрелкой и сообщает о расхождении в лог.
7. **`SpinReady` не слать.** Он не входит в канал колеса. Бар колеса открывает и закрывает фаза
   раунда.
8. **Сторожа по таймауту нет.** Не пришёл `RoundShown` — выплата не появится и окно не откроется. Это
   ошибка движка, её чинят в игре, а не таймером в хосте.

## Восстановление и ошибки

- **Перезагрузка посреди раунда.** Восстанавливать нечего: ставка живёт на бэкенде, колесо общее. Хост
  читает `get-game-state` и шлёт текущую фазу. Страница, открытая в `IN_GAME`, получает ячейку и
  крутит колесо на остаток фазы (у демо — не меньше 600 мс). Открытая в `FINISH_GAME` — может
  получить только цвет: игра ставит колесо на любую ячейку этого цвета без вращения, показывает цвет и
  шлёт `RoundShown`.
- **Первый `ApplyRound` пропал.** Хост шлёт его, как только движок загрузился, не дожидаясь
  `UiVisibility`. Unity-сцена в этот момент может ещё не подняться. Unity-мост поэтому спрашивает
  `RequestGameState`, пока не получит первый `ApplyRound`. В веб-игре потерь нет: хост копит команды до
  `host.ready()`.
- **Переподключение сокета.** Хост сам перечитывает `get-game-state` и шлёт свежий снимок.
- **Битый снимок от сервера.** Хост проверяет события сервера схемой. Невалидное он пишет в лог
  (`WheelMessageError`) и в игру не пересылает. Игра проверяет снимок у себя и битый не применяет.
  Демо так и делает: `WheelSnapshotError` → `BridgeLogger.error`.
- **`STOPPED`.** Раунды остановлены. Игра показывает паузу и `RoundShown` не шлёт. Продолжение
  придёт снимком `WAIT_GAME` нового раунда.
- **Стенд без сборки движка.** Заглушка движка в шелле на `ApplyRound` не отвечает: на стенде без
  игры у колеса нет ни раскрытия выплаты, ни окна результата.

## Смотрите также

- [JS: как встроить](js.md) · [Unity: как встроить](unity.md)
- [Жизненный цикл раунда](../../concepts/round-lifecycle.md) · [Общий протокол](../../concepts/core-protocol.md)
- Исходники контракта: `protocol/src/commands.ts` (`WheelCommand`), `protocol/src/events.ts` (`WheelEvent`),
  `protocol/src/payloads.ts` (`WheelBetBarMetricsPayload`)
- Хост: RoadFrontent `src/modes/wheel/` — `engineMessage.ts` (снимок для игры), `useWheelRoundSync.ts`
  (отправка), `wheelEngineEvents.ts` (`RoundShown`), `view/bet-bar/useWheelBarViewportMetrics.ts` (метрики)
