# Dragon Pots — Unity

> Как подключить Dragon Pots к игре на Unity (WebGL). Контракт режима — в [обзоре](README.md).

## Статус

**Unity-моста у dragon-pots пока нет.** В пакете `com.pixi.webbridge` нет ни `DragonPotsWebBridge`, ни
префаба, ни mock-хоста. Режим ведёт веб-игра на `DragonPotsBridge` ([JS](js.md)); демо —
`js/examples/demo-games/src/modes/dragon-pots`.

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
| `ApplySpinResult` | `ApplySpinResult` | `string` — ответ на `play`, JSON как есть: весь раунд |
| `ApplyGameState` | `ApplyGameState` | `string` — всегда `{}` |
| `ApplyGameConfig` | `ApplyGameConfig` | `string` — ответ `get-game-config` как есть |

Общие команды (`SetFastGame`, `ApplyWhiteLabel`, `OnDisabledPlayPressed`, переводы, метрики бет-бара,
ориентация) принимают `WebBridgeBase<T>` и компоненты префаба — см.
[ядро Unity-моста](../../reference/unity-core.md).

### Unity → React

Через `WebBridgeUtils.Send(string)` (событие `SendToReact`):

| Сообщение | Когда |
|---|---|
| `SpinReady` | один раз на ответ: после базы, котлов, джекпота, Hold & Win и итога; покупка тоже |
| `RequestGameConfig`, `RequestGameState` | на старте сцены |

Обе строки уже есть в `UNITY_PLAIN_MESSAGES` протокола (`protocol/src/unityWire.ts`). `RequestStep` режиму не
нужен.

## Как собрать мост

1. `Runtime/DragonPotsWebBridge.cs` — `[Preserve] public class DragonPotsWebBridge :
   WebBridgeBase<DragonPotsWebBridge>` в namespace `Modules.DragonPots`.
   - `public void ApplySpinResult(string payload)` → событие `SpinResultReceived`, как у `MineSlotWebBridge`.
   - `ApplyGameState` / `ApplyGameConfig` — как у `MineSlotWebBridge`; состояние `{}` ничего не запускает.
   - `public void NotifySpinReady() => WebBridgeUtils.Send("SpinReady");`
2. `Runtime/WebDragonPotsPayloads.cs` — `[Preserve] [Serializable]` классы с `[JsonName("…")]` по
   [данным режима](README.md#данные):
   - `mainGameResult.matrix` — `string[][]`, **`[row][reel]`**; `wins[].paths` — `Cell[][]`. Парсер пакета
     (`Json.cs`) разбирает вложенные массивы и `List<List<T>>`, `JsonUtility` — нет: через него не читать.
   - `jackpotResult` и `holdAndWinResult` бывают не всегда: после разбора проверять на `null` и по ним
     решать, какие фичи играть. `bonusTypeName` у покупки пустой.
   - Клетки Hold & Win — `rowIndex` / `colIndex`, монеты на барабанах — `reelIndex` / `rowIndex`.
   - Деньги — `string`. `Json.cs` читает `double` через `float`: `coeff` вроде `0.41818181818181815` теряет
     точность, поэтому суммы на экран брать только из строк (`winAmount`, `currentWinAmount`). Верхний
     `coeff` на prod — строка: поле объявлять так, чтобы читалось и число, и строка.
3. Mock, префаб и пункт меню — по [новому режиму](../../guides/adding-a-mode.md#3-unity-мост--unityassetswebbridge).
   Модель mock-раунда можно перенести с `js/webbridge/src/dragon-pots/` (способы, пик, Hold & Win).

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бар ожил посреди Hold & Win | `SpinReady` после базы или после фичи | один вызов после итога раунда |
| Матрица пустая | ответ разобран `JsonUtility` | `WebBridgeUtils.DeserializePayload<T>` (парсер пакета) |
| Символы не в тех клетках | `matrix` прочитана как `[reel][row]` | `matrix[row][reel]` |
| Купленный бонус не играется | фича выбрана по `bonusTypeName` | по наличию `holdAndWinResult` |
| Итог на цент больше баланса | показан `roundResult.winAmount` или сумма из `coeff` | верхний `winAmount` |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md)
- Образец в пакете: `unity/Assets/WebBridge/Runtime/MineSlotWebBridge.cs`
