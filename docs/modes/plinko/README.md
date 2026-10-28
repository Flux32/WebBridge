# Plinko

> Шарик падает по доске штырьков в одну из ячеек нижнего ряда, ячейка платит свой коэффициент. Одна
> ставка — один шарик. Хост присылает уже разыгранный сервером бросок, игра роняет шарик в названную
> ячейку и, когда он сел, отвечает `DropFinished`.

|  |  |
|---|---|
| **Id режима** | протокол `ModeProtocols['plinko']` · шелл `plinko` · конфигуратор `plinko` · бэкенд `gameMode=plinko` |
| **JS-мост** | [`PlinkoBridge`](js.md) · mock: `PlinkoMockHost` |
| **Unity-мост** | [`PlinkoWebBridge`](unity.md) · префаб `PlinkoWebBridge.prefab` · namespace `Modules.Plinko` |
| **Демо** | `js/examples/demo-games/src/modes/plinko` (порт 5190, `?mock=1`) |
| **С версии** | protocol `1.1.0` · js `1.13.0` · Unity-пакет `1.0.0` |
| **Исходник контракта** | [`protocol/src/modes.ts`](../../../protocol/src/modes.ts) (`ModeProtocols['plinko']`), [`commands.ts`](../../../protocol/src/commands.ts) (`PlinkoCommand`), [`events.ts`](../../../protocol/src/events.ts) (`PlinkoEvent`) |

## Механика

Доска — треугольник штырьков. Доска из `N` рядов даёт `N + 1` ячеек снизу. Под каждой ячейкой стоит
коэффициент. Края платят больше всего и выпадают реже всего.

Игрок выбирает в баре хоста ставку и **риск** — `LOW`, `MEDIUM` или `HIGH`. У каждого риска своя линия
коэффициентов: конфиг (`coefficients`) несёт все три. Сервер разыгрывает бросок целиком в ответе на
`play`. Номер ячейки — `resultPosition`, это индекс в линии риска этого броска. Падение по штырькам —
только оформление: шарик обязан сесть в `resultPosition`.

Бонусов, колеса и нескольких шариков на ставку у режима нет. Это режим [`plinko-aztec`](../plinko-aztec/README.md).

## Раунд по шагам

```mermaid
sequenceDiagram
    autonumber
    participant S as Сервер
    participant H as Хост (React-шелл)
    participant G as Игра
    Note over H: игрок жмёт ставку в баре; бар занят
    H->>S: play {gameType: plinko, amount, currency, value: {risk}}
    S-->>H: GameState {status, coeff, resultPosition, risk, winAmount, bet}
    H->>G: ApplyDropResult (ответ сервера как есть, JSON)
    G->>G: шарик падает в resultPosition
    G-->>H: DropFinished (ровно один)
    Note over H: бар свободен, можно бросать снова
```

1. Нажатие ставки сразу делает бар занятым — до первого `await`, чтобы двойной тап на медленном телефоне
   не отправил два `play`.
2. Сервер отвечает готовым `GameState` с полями режима на верхнем уровне. Хост пересылает его в игру
   **без изменений** командой `ApplyDropResult`.
3. Игра роняет шарик и после посадки шлёт **одно** событие `DropFinished`. На нём хост освобождает бар.
4. Отказ сервера (нет денег, ставка вне лимитов, обрыв) — бар освобождается сразу, игрок видит тост.
   Игра в этом случае ничего не получает и `DropFinished` не шлёт.

## Команды хоста → игра

| Команда | Когда приходит | Payload | Что делает игра |
|---|---|---|---|
| `ApplyDropResult` | ответ сервера на `play` | JSON-строка [`PlinkoGameState`](#plinkogamestate) | ставит доску на линию `risk` броска, роняет шарик в `resultPosition`, после посадки шлёт `DropFinished` |
| `ApplyGameConfig` | после загрузки движка; в ответ на `RequestGameConfig` и `RequestGameState`; после переподключения | JSON-строка [конфига](#конфиг) с `coefficients` по риску | строит доску по линии коэффициентов |
| `ApplyGameState` | вместе с `ApplyGameConfig`, сразу после него | JSON-строка ответа `get-game-state` | приводит сцену в покой. Это **не** бросок: шарик не ронять, `DropFinished` не слать |

На `RequestGameConfig` plinko отвечает так же, как на `RequestGameState`: полной пересинхронизацией
сессии (`ApplyGameConfig`, затем `ApplyGameState`).

Хост шлёт `ApplyGameConfig` и `ApplyGameState`, только когда мост поднят: после первого `UiVisibility` от
игры или через 10 с без него. Игра, которая не шлёт `UiVisibility`, получает конфиг на 10 секунд позже.

Остальное — общие команды: `SetFastGame`, `ApplyWhiteLabel`, `ApplyTranslations`, `DisabledPlayPressed`
и прочие ([общий протокол](../../concepts/core-protocol.md)).

### Чего в канале plinko нет

Союзы `PlinkoCommand` и `PlinkoEvent` в `protocol/src` общие для двух режимов. Канал plinko —
`ModeProtocols['plinko']` — берёт из них только `ApplyDropResult` и `DropFinished`. Остальное
принадлежит [`plinko-aztec`](../plinko-aztec/README.md):

| Член союза | Чей | Plinko-мосты |
|---|---|---|
| `SetBallsAmount` (команда) | plinko-aztec | нет метода; `PlinkoBridge` пишет предупреждение |
| `SetBetPerBall` (команда) | plinko-aztec | то же |
| `RequestBallsAmount`, `RequestBetPerBall`, `RequestStep` (события) | plinko-aztec | не шлют |

## События игры → хост

| Событие | Когда слать | Что делает хост |
|---|---|---|
| `DropFinished` | ровно один раз на `ApplyDropResult`, когда шарик сел | освобождает бар: можно бросать снова |
| `RequestGameConfig`, `RequestGameState` | на старте сцены, повторяя до ответа | `ApplyGameConfig` + `ApplyGameState` |
| `UiVisibility` | на старте сцены | знак хосту, что мост поднят: после него приходят конфиг и состояние ([общий протокол](../../concepts/core-protocol.md)) |

`RequestPlay` (бросок тапом по сцене) в нынешнем шелле plinko не работает. Бар plinko в шелле —
временная заглушка, и Play для общего маршрута она не регистрирует. Поэтому на `RequestPlay` всегда
приходит `DisabledPlayPressed`. `PlinkoMockHost` ведёт себя иначе: на `RequestPlay` он бросает шарик.

## Данные

### `PlinkoGameState`

Ответ сервера на `play` и `get-game-state` — `GameState` платформы с полями режима на верхнем уровне.
Отдельного типа в `protocol/src` у него нет: форма — RoadFrontent `src/modes/plinko/types.ts`
(`PlinkoGameState`) и C#-класс `WebPlinkoStatePayload`.

```ts
interface PlinkoGameState {
  status: 'none' | 'in-game' | 'win' | 'lose';
  bet?: { amount: string; currency: string; decimalPlaces: number };
  isFinished?: boolean;
  isWin?: boolean;
  coeff?: number;            // коэффициент ячейки; может прийти десятичной строкой
  resultPosition?: number;   // индекс ячейки в coefficients[risk], слева направо, с 0
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
  winAmount?: string;        // выплата строкой; проигрыш — "0"
  betAmount?: string;        // дубль bet.amount на верхнем уровне
  currency?: string;         // дубль bet.currency
  error?: string;
}
```

`coeff`, `resultPosition` и `risk` приходят, когда бросок разыгран, то есть в каждом ответе на `play`.
Деньги (`winAmount`, `betAmount`, `bet.amount`) — строки: игра их показывает, но не складывает.

Пример — бросок `PlinkoMockHost` (форма по коду хоста и мока, суммы иллюстративные, не запись с
dev-бэка):

```json
{
  "bet": { "amount": "1.00", "currency": "USD", "decimalPlaces": 2 },
  "betAmount": "1.00",
  "currency": "USD",
  "status": "win",
  "isFinished": true,
  "isWin": true,
  "coeff": 2.1,
  "resultPosition": 1,
  "risk": "LOW",
  "winAmount": "2.10"
}
```

### Конфиг

`ApplyGameConfig` — ответ `get-game-config`, прошедший общую проверку хоста. Поля, которых хост не знает,
проходят как есть. Игре нужны:

```ts
interface PlinkoGameConfig {
  /** Линия ячеек слева направо для каждого риска; числа могут прийти десятичными строками. */
  coefficients: Record<'LOW' | 'MEDIUM' | 'HIGH', Array<number | string>>;
  currency?: string;
  minBetAmount?: number;
  maxBetAmount?: number;
  balance?: number;
}
```

Число ячеек — длина линии, число рядов доски — длина минус один. Пример (линия мока: 9 ячеек, 8 рядов;
коэффициенты иллюстративные):

```json
{
  "currency": "USD",
  "minBetAmount": 1,
  "maxBetAmount": 100,
  "balance": 1000,
  "coefficients": {
    "LOW": [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    "MEDIUM": [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    "HIGH": [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29]
  }
}
```

## Правила и инварианты

1. **Один `DropFinished` на один `ApplyDropResult`, после посадки шарика.** Раньше — бар освободится под
   падающим шариком, и игрок сделает ставку поверх недоигранной анимации. Лишний `DropFinished` на
   `ApplyGameState` освободит бар, пока следующий `play` ещё в пути. Не прислать — бар залочен навсегда:
   сторожа по таймауту нет.
2. **Броски играются по очереди.** Хост не шлёт второй бросок до `DropFinished`, но игра всё равно
   ставит команды в очередь: команда не должна рвать анимацию, которая ещё идёт.
3. **`resultPosition` — индекс в линии риска броска**, а не той, что сейчас на доске. Выбранный в баре
   риск игра узнаёт только из броска: отдельной команды для него в канале нет. До первого броска доска
   показывает линию `LOW`.
4. **Исход не показывать раньше посадки.** Коэффициент и выигрыш появляются, когда шарик сел.
5. **Путь шарика считает игра.** Ячейка `k` доски из `N` рядов достигается ровно `k` отскоками вправо
   из `N`. Порядок отскоков — оформление (у демо — перемешан сидом, `ballPath.ts`).
6. **Деньги — строками.** `winAmount` и `betAmount` не переводить в `number` для арифметики.
7. **Битый бросок — видимая ошибка.** `resultPosition` вне линии, неизвестный `risk` — шарик не падает, ошибка
   уходит в лог и на экран. Демо в этом случае `DropFinished` не шлёт, и бар остаётся залоченным.

## Восстановление и ошибки

- **Перезагрузка посреди падения.** Бросок закрыт на сервере уже в ответе на `play` (`isFinished: true`),
  выплата в балансе. После перезагрузки хост шлёт только `ApplyGameConfig` + `ApplyGameState`.
  Доигрывать нечего, сцена встаёт в покой.
- **Отказ сервера.** Бар свободен сразу, игрок видит тост. Игре ничего не приходит.
- **Переподключение сокета.** Хост пересинхронизирует сессию: `ApplyGameConfig` и `ApplyGameState`
  приходят повторно. Конфиг применять идемпотентно.
- **Повтор `ApplyGameConfig` во время падения.** Доску не перестраивать под летящим шариком: новую линию
  применить после посадки.
- **Стенд без сборки движка.** Заглушка движка в шелле отвечает на `ApplyDropResult` событием
  `DropFinished` через 1 с, так что бар на стенде не залипает и без игры.

## Смотрите также

- [JS: как встроить](js.md) · [Unity: как встроить](unity.md) · [Plinko Aztec](../plinko-aztec/README.md)
- [Жизненный цикл раунда](../../concepts/round-lifecycle.md) · [Общий протокол](../../concepts/core-protocol.md)
- Исходники контракта: `protocol/src/modes.ts` (`ModeProtocols['plinko']`), `protocol/src/commands.ts`
  (`PlinkoCommand`), `protocol/src/events.ts` (`PlinkoEvent`)
- Хост: RoadFrontent `src/modes/plinko/` — `usePlinko.ts` (`play` → `ApplyDropResult`),
  `plinkoEngineEvents.ts` (`DropFinished`), `src/domain/round/drop/dropRound.ts` (занятость бара)
