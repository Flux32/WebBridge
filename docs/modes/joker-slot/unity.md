# Joker Slot — Unity

> Как подключить Joker Slot к игре на Unity (WebGL). Контракт режима — в [обзоре](README.md).

## Статус

**Unity-моста у joker-slot пока нет.** В пакете `com.pixi.webbridge` нет ни `JokerSlotWebBridge`, ни
префаба, ни mock-хоста. Режим ведёт веб-игра на `JokerSlotBridge` ([JS](js.md)); демо —
`js/examples/demo-games/src/modes/joker-slot`.

Шелл выбирает движок по сборке, а не по режиму: дескриптор релиза (`build.engine`), манифест
(`meta.engine`) или `?engine=unity` для отладки. Команды он переводит в
`SendMessage("WebBridge", <метод>, <параметр>)` (`RoadFrontent/src/engine/unity/unityProtocol.ts`). Значит,
Unity-игре режима нужен только мост с методами ниже. Раунд атомарный, как у mine-slot, поэтому образец —
`MineSlotWebBridge`: тот же провод, другой payload.

## Провод

Хост адресует один GameObject по имени — **`WebBridge`** — и вызывает публичный метод по имени.

### React → Unity

| Команда протокола | Метод `SendMessage` | Параметр |
|---|---|---|
| `ApplySpinResult` | `ApplySpinResult` | `string` — ответ на `play`, JSON как есть: все доски раунда |
| `ApplyGameState` | `ApplyGameState` | `string` — всегда `{"status":"none"}` |
| `ApplyGameConfig` | `ApplyGameConfig` | `string` — ответ `get-game-config` как есть |

Общие команды (`SetFastGame`, `ApplyWhiteLabel`, `OnDisabledPlayPressed`, переводы, метрики бет-бара,
ориентация) принимают `WebBridgeBase<T>` и компоненты префаба — см.
[ядро Unity-моста](../../reference/unity-core.md).

### Unity → React

Через `WebBridgeUtils.Send(string)` (событие `SendToReact`):

| Сообщение | Когда |
|---|---|
| `SpinReady` | один раз на ответ: после последней доски бонуса и итога; покупка тоже |
| `RequestGameConfig`, `RequestGameState` | на старте сцены |

Обе строки уже есть в `UNITY_PLAIN_MESSAGES` протокола (`protocol/src/unityWire.ts`). `RequestStep` режиму не
нужен.

## Как собрать мост

1. `Runtime/JokerSlotWebBridge.cs` — `[Preserve] public class JokerSlotWebBridge :
   WebBridgeBase<JokerSlotWebBridge>` в namespace `Modules.JokerSlot`.
   - `public void ApplySpinResult(string payload)` → событие `SpinResultReceived`, как у `MineSlotWebBridge`.
   - `ApplyGameState` / `ApplyGameConfig` — как у `MineSlotWebBridge`; состояние `none` ничего не запускает.
   - `public void NotifySpinReady() => WebBridgeUtils.Send("SpinReady");`
2. `Runtime/WebJokerSlotPayloads.cs` — `[Preserve] [Serializable]` классы с `[JsonName("…")]` по
   [данным режима](README.md#данные):
   - `boards` — `string[]`, ячейка `reel * 4 + row`; символ — ключ (`0`…`9`, `a`…`m`), не число.
   - `actions` — `List<List<Action>>`, где `Action` несёт все поля известных шагов (`triggerIndex`, `coins`,
     `strikes`, `winLines`, `board`, `count`, `multiplier`); каких полей нет у шага, те пустые. Шаг
     распознавать по `action`, неизвестный пропускать.
   - `BONUS_RUN.board` — `string[][]` (12 ячеек по одному коду). Парсер пакета (`Json.cs`) разбирает
     вложенные массивы, `JsonUtility` — нет: через него не читать.
   - Деньги — `string`. Верхний `coeff` на stage — число, на prod может быть строкой: поле объявлять так,
     чтобы читалось и то и другое. Итог на экран — только верхний `winAmount`.
3. Mock, префаб и пункт меню — по [новому режиму](../../guides/adding-a-mode.md#3-unity-мост--unityassetswebbridge).
   Модель mock-раунда можно перенести с `js/webbridge/src/joker-slot/` (базовая доска, бонус, покупки).

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бар ожил посреди бонуса | `SpinReady` после базовой доски | один вызов после последней доски |
| Доска бонуса пустая | `BONUS_RUN.board` разобран `JsonUtility` | `WebBridgeUtils.DeserializePayload<T>` (парсер пакета) |
| Монеты Super Joker'а не на доске | их искали в строке доски | они в `SUPER_STRIKE_COINS_ADDED` |
| Итог на цент больше баланса | показана сумма `totalPayout` | верхний `winAmount` |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md)
- Образец в пакете: `unity/Assets/WebBridge/Runtime/MineSlotWebBridge.cs`
