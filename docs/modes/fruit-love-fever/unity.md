# Fruit Love Fever — Unity

> Как подключить Fruit Love Fever к игре на Unity (WebGL). Контракт режима — в [обзоре](README.md).

## Статус

**Unity-моста у fruit-love-fever пока нет.** В пакете `com.pixi.webbridge` нет ни `FruitLoveFeverWebBridge`,
ни префаба, ни mock-хоста. Режим ведёт веб-игра на `FruitLoveFeverBridge` ([JS](js.md)); демо —
`js/examples/demo-games/src/modes/fruit-love-fever`.

Шелл выбирает движок по сборке, а не по режиму: дескриптор релиза (`build.engine`), манифест
(`meta.engine`) или `?engine=unity` для отладки. Команды он переводит в
`SendMessage("WebBridge", <метод>, <параметр>)` (`RoadFrontent/src/engine/unity/unityProtocol.ts`). Значит,
Unity-игре режима нужен только мост с методами ниже. Оба куска уже есть в пакете: спин одним ответом —
у `MineSlotWebBridge`, шаг бонуса по `RequestStep` — у `PlinkoAztecWebBridge`.

## Провод

Хост адресует один GameObject по имени — **`WebBridge`** — и вызывает публичный метод по имени.

### React → Unity

| Команда протокола | Метод `SendMessage` | Параметр |
|---|---|---|
| `ApplySpinResult` | `ApplySpinResult` | `string` — ответ на `play`, JSON как есть |
| `ApplyBonusStepResult` | `ApplyStepResult` | `string` — ответ на `step`, JSON как есть; имя метода шелл берёт у plinko-aztec |
| `ApplyGameState` | `ApplyGameState` | `string` — ответ `get-game-state` как есть |
| `ApplyGameConfig` | `ApplyGameConfig` | `string` — ответ `get-game-config` как есть |

Общие команды (`SetFastGame`, `ApplyWhiteLabel`, `OnDisabledPlayPressed`, переводы, метрики бет-бара,
ориентация) принимают `WebBridgeBase<T>` и компоненты префаба — см.
[ядро Unity-моста](../../reference/unity-core.md).

### Unity → React

Через `WebBridgeUtils.Send(string)` (событие `SendToReact`):

| Сообщение | Когда |
|---|---|
| `RequestStep` | бонус: один раз на фри-спин, когда предыдущий доигран; ещё раз — на `ApplyGameState` во время ожидания шага |
| `SpinReady` | один раз на раунд: после базового спина без бонуса или после последнего фри-спина |
| `RequestGameConfig`, `RequestGameState` | на старте сцены |

Обе строки уже есть в `UNITY_PLAIN_MESSAGES` протокола (`protocol/src/unityWire.ts`).

## Как собрать мост

1. `Runtime/FruitLoveFeverWebBridge.cs` — `[Preserve] public class FruitLoveFeverWebBridge :
   WebBridgeBase<FruitLoveFeverWebBridge>` в namespace `Modules.FruitLoveFever`.
   - `public void ApplySpinResult(string payload)` → событие `SpinResultReceived`.
   - `public void ApplyStepResult(string payload)` → событие `StepResultReceived`.
   - `ApplyGameState` / `ApplyGameConfig` — как у `MineSlotWebBridge`; состояние с `IsFinished == false` —
     бонус, который игра продолжает.
   - `public void RequestStep() => WebBridgeUtils.Send("RequestStep");`
   - `public void NotifySpinReady() => WebBridgeUtils.Send("SpinReady");`
2. `Runtime/WebFruitLoveFeverPayloads.cs` — `[Preserve] [Serializable]` классы с `[JsonName("…")]` по
   [данным режима](README.md#данные). `slot.reelsCells` — объект с ключами `"1"`…`"5"`, не массив. `coeff` и
   `line` читать и из числа, и из строки. Символ — по `outcomeNumber`, не по `outcome`.
3. Mock, префаб и пункт меню — по [новому режиму](../../guides/adding-a-mode.md#3-unity-мост--unityassetswebbridge).

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Шаги бонуса не доходят до моста | метод назван `ApplyBonusStepResult` | шелл вызывает `ApplyStepResult` |
| Бар ожил посреди бонуса | `SpinReady` после каждого фри-спина | один вызов после ответа с `isFinished: true` |
| Барабаны пустые или «не те» символы | доска разобрана по `outcome` или `reelsCells` читается как массив | `outcomeNumber`; ключи `"1"`…`"5"` |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md)
- Образцы в пакете: `unity/Assets/WebBridge/Runtime/MineSlotWebBridge.cs`,
  `unity/Assets/WebBridge/Runtime/PlinkoAztecWebBridge.cs`
