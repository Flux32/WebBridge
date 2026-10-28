# Plinko — Unity

> Как подключить Plinko к игре на Unity (WebGL). Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```csharp
using System.Collections;
using Modules.Plinko;
using UnityEngine;

public sealed class PlinkoDropListener : MonoBehaviour
{
    private void OnEnable() => PlinkoWebBridge.Instance.DropResultReceived += OnDrop;
    private void OnDisable() => PlinkoWebBridge.Instance.DropResultReceived -= OnDrop;

    private void OnDrop(WebPlinkoStatePayload drop) => StartCoroutine(Play(drop));

    private IEnumerator Play(WebPlinkoStatePayload drop)
    {
        yield return DropBall(drop.Risk, drop.ResultPosition.Value); // шарик сел
        PlinkoWebBridge.Instance.NotifyDropFinished();               // ровно один раз
    }

    private IEnumerator DropBall(string risk, int slot) { yield break; } // ваша анимация
}
```

## Подключение

1. Пакет `com.pixi.webbridge` (UPM, `unity/Assets/WebBridge`). Установка — в
   [старте на Unity](../../guides/getting-started-unity.md).
2. На сцену — меню **`GameObject → WebBridge → Create PlinkoWebBridge`**. Пункт берёт
   `Packages/com.pixi.webbridge/Runtime/Prefabs/PlinkoWebBridge.prefab` (или тот же путь в `Assets/`),
   называет объект `WebBridge` и не даёт создать второй мост на сцене.
3. Что на префабе:

   | Компонент | Namespace | Зачем |
   |---|---|---|
   | `PlinkoWebBridge` | `Modules.Plinko` | команды и события режима |
   | `LayoutWebBridge` | `Modules.Road` | в `Start()` шлёт первое `UiVisibility` — знак хосту, что мост поднят: без него конфиг и состояние приходят через 10 с |
   | `AudioWebBridge` | `Modules.Road` | звуки через хост |
   | `ScreenOrientationWebBridge` | `Modules.Road` | `ChangeOrientation` |
   | `TranslationsWebBridge` | `Modules.Road` | `ApplyTranslations` |
   | `WebBridgeUI` | `Modules.Road` | окна и экран перехода |

4. GameObject называется строго **`WebBridge`**: хост адресует `SendMessage("WebBridge", <метод>, …)` по
   имени объекта. Имя класса роли не играет.

## API `PlinkoWebBridge`

`PlinkoWebBridge : WebBridgeBase<PlinkoWebBridge>` — синглтон (`PlinkoWebBridge.Instance`, ставится в
`Awake`). В `Start()` мост сам запускает стартовую синхронизацию: в WebGL-сборке шлёт
`RequestGameConfig` + `RequestGameState` каждые 0,5 с, до 10 раз, пока не придёт `ApplyGameConfig`. В
mock-режиме и в редакторе синхронизация не идёт.

Общие события и методы базы (`WhiteLabelReceived`, `FastGameChanged`, `DisabledPlayPressed`,
`CashoutPressed`, `WinWindowSignalReceived`, `RequestPlay`, …) — в [справочнике ядра](../../reference/unity-core.md).

### События (React → игра)

| Событие C# | Тип аргумента | Метод `SendMessage` | Когда срабатывает |
|---|---|---|---|
| `GameConfigReceived` | `WebPlinkoConfigPayload` | `ApplyGameConfig(string json)` | пришёл конфиг: линии коэффициентов по риску, лимиты, баланс |
| `BalanceReceived` | `float` | `ApplyGameConfig(string json)` | в конфиге было поле `balance`; сразу после `GameConfigReceived` |
| `GameStateReceived` | `WebPlinkoStatePayload` | `ApplyGameState(string json)` | пришло состояние сессии — **не** бросок |
| `DropResultReceived` | `WebPlinkoStatePayload` | `ApplyDropResult(string json)` | пришёл бросок: `ResultPosition`, `Risk`, `Coeff`, `WinAmount` |

Невалидный JSON мост не роняет. `WebBridgeUtils.DeserializePayload` пишет предупреждение
`[WebBridge] Failed to parse ApplyDropResult: …`, и событие не поднимается. Бар при этом остаётся
залоченным: `DropFinished` никто не пришлёт.

### Методы (игра → React)

| Метод | Сообщение в React | Когда звать |
|---|---|---|
| `NotifyDropFinished()` | `DropFinished` | ровно один раз на `DropResultReceived`, когда шарик сел |
| `RequestGameConfig()` / `RequestGameState()` | `RequestGameConfig` / `RequestGameState` | зовёт сама синхронизация; вручную — если сцена пересоздана |

### Свойства

| Свойство | Тип | Что хранит |
|---|---|---|
| `Instance` | `PlinkoWebBridge` | синглтон моста |
| `LastGameConfig` | `WebPlinkoConfigPayload` | последний конфиг; `null` до первого |
| `LastGameState` | `WebPlinkoStatePayload` | последнее состояние: `ApplyGameState` **или** последний бросок |
| `LastDropResult` | `WebPlinkoStatePayload` | последний бросок; `null` до первого |
| `LastBalance` | `float?` | баланс из последнего конфига, в котором он был |

Подписчик, поднявшийся позже, читает `Last*` и не ждёт следующего пуша.

Методов `SetBallsAmount`, `SetBetPerBall`, `RequestStep`, `RequestBallsAmount`, `RequestBetPerBall` у
`PlinkoWebBridge` нет: это канал [`plinko-aztec`](../plinko-aztec/unity.md) (`PlinkoAztecWebBridge`).

## Payload-классы

Файл `Runtime/WebPlinkoPayloads.cs`, namespace `Modules.Plinko`. Поля — в форме провода, атрибут
`[JsonName]` задаёт имя в JSON. Числа, пришедшие строкой (`"1.03"`), JSON-парсер пакета читает в
`float` сам.

### `WebPlinkoStatePayload : WebGameStateBase`

| Поле C# | JSON | Тип | Смысл |
|---|---|---|---|
| `Status` | `status` | `string` | `none` / `in-game` / `win` / `lose` (база) |
| `Bet` | `bet` | `WebBetPayload` | `Amount` (string), `Currency`, `DecimalPlaces` (int?) (база) |
| `IsFinished` | `isFinished` | `bool?` | раунд закрыт; у броска — всегда (база) |
| `IsWin` | `isWin` | `bool?` | (база) |
| `WinAmount` | `winAmount` | `string` | выплата строкой; проигрыш — `"0"` (база) |
| `Error` | `error` | `string` | (база) |
| `Coeff` | `coeff` | `float?` | коэффициент ячейки |
| `ResultPosition` | `resultPosition` | `int?` | индекс ячейки в линии `Risk`, слева направо, с 0 |
| `Risk` | `risk` | `string` | `LOW` / `MEDIUM` / `HIGH` |
| `BetAmount` | `betAmount` | `string` | дубль `bet.amount` на верхнем уровне |
| `Currency` | `currency` | `string` | дубль `bet.currency` |

### `WebPlinkoConfigPayload`

| Поле C# | JSON | Тип | Смысл |
|---|---|---|---|
| `Currency` | `currency` | `string` | валюта |
| `MinBetAmount` / `MaxBetAmount` | `minBetAmount` / `maxBetAmount` | `float?` | лимиты ставки |
| `Balance` | `balance` | `float?` | баланс; он же поднимает `BalanceReceived` |
| `Coefficients` | `coefficients` | `JsonValue` | `{ LOW: [...], MEDIUM: [...], HIGH: [...] }` как есть |

`GetCoefficients(string risk)` → `float[]` линии риска. Для отсутствующей линии, неизвестного риска или
пустого `coefficients` метод возвращает **пустой массив**, а не бросает. Игра проверяет длину сама:
линия короче двух ячеек — ошибка конфига, доску по ней не строят.

## Полный пример

Компонент строит доску по конфигу, играет броски по очереди, переводит доску на риск броска и шлёт
`NotifyDropFinished()` ровно один раз, после посадки. Логика — та же, что у JS-демо
(`js/examples/demo-games/src/modes/plinko/PlinkoController.ts`). Анимация — за абстрактным
`PlinkoBoardView`: его реализует игра.

```csharp
using System.Collections;
using System.Collections.Generic;
using Modules.Plinko;
using UnityEngine;
using WebBridge;

public abstract class PlinkoBoardView : MonoBehaviour
{
    // Builds the board for a coefficient line: line.Length - 1 peg rows.
    public abstract void ShowLine(float[] coefficients);

    // Drops a ball into the slot; finishes when the ball has landed. Slot k of a board of n rows is
    // reached by exactly k bounces to the right — the order of the bounces is decoration.
    public abstract IEnumerator DropBall(int slot);

    public abstract void ShowLanding(int slot, float coefficient, string winAmount, string currency);

    public abstract void ShowError(string message);
}

public sealed class PlinkoBoardPresenter : MonoBehaviour
{
    // The bar's risk reaches the engine only with a drop: until then the board shows the first one.
    private const string RiskBeforeFirstDrop = "LOW";

    [SerializeField] private PlinkoBoardView _board;

    private readonly Queue<WebPlinkoStatePayload> _drops = new Queue<WebPlinkoStatePayload>();
    private WebPlinkoConfigPayload _config;
    private WebPlinkoConfigPayload _pendingConfig;
    private string _risk = RiskBeforeFirstDrop;
    private bool _isDropping;

    private PlinkoWebBridge Bridge => PlinkoWebBridge.Instance;

    private void OnEnable()
    {
        Bridge.GameConfigReceived += OnGameConfig;
        Bridge.DropResultReceived += OnDropResult;

        if (Bridge.LastGameConfig != null)
            OnGameConfig(Bridge.LastGameConfig);
    }

    private void OnDisable()
    {
        Bridge.GameConfigReceived -= OnGameConfig;
        Bridge.DropResultReceived -= OnDropResult;
    }

    // A config that arrives mid-drop waits: the board is not rebuilt under a falling ball.
    private void OnGameConfig(WebPlinkoConfigPayload config)
    {
        if (_isDropping)
        {
            _pendingConfig = config;
            return;
        }

        ApplyConfig(config);
    }

    private void ApplyConfig(WebPlinkoConfigPayload config)
    {
        _config = config;
        float[] line = config.GetCoefficients(_risk);
        if (line.Length < 2)
        {
            Fail($"the config has no {_risk} coefficient line");
            return;
        }

        _board.ShowLine(line);
    }

    // GameStateReceived is deliberately not handled: the session state is not a drop.
    private void OnDropResult(WebPlinkoStatePayload drop)
    {
        _drops.Enqueue(drop);
        if (!_isDropping)
            StartCoroutine(PlayDrops());
    }

    private IEnumerator PlayDrops()
    {
        _isDropping = true;
        while (_drops.Count > 0)
            yield return PlayDrop(_drops.Dequeue());
        _isDropping = false;

        if (_pendingConfig == null)
            yield break;

        WebPlinkoConfigPayload config = _pendingConfig;
        _pendingConfig = null;
        ApplyConfig(config);
    }

    private IEnumerator PlayDrop(WebPlinkoStatePayload drop)
    {
        float[] line = _config == null ? System.Array.Empty<float>() : _config.GetCoefficients(drop.Risk);
        int slot = drop.ResultPosition ?? -1;
        if (slot < 0 || slot >= line.Length || !drop.Coeff.HasValue)
        {
            // No ball and no DropFinished: the bar stays locked, and the error is on screen and in the log.
            Fail($"resultPosition {drop.ResultPosition} / coeff {drop.Coeff} do not fit the {line.Length} {drop.Risk} slots");
            yield break;
        }

        _risk = drop.Risk;
        _board.ShowLine(line);
        yield return _board.DropBall(slot);

        _board.ShowLanding(slot, drop.Coeff.Value, drop.WinAmount, drop.Currency);
        Bridge.NotifyDropFinished();
    }

    private void Fail(string message)
    {
        WebBridgeLogger.LogError($"[Plinko] {message}");
        _board.ShowError(message);
    }
}
```

Что здесь важно:

- `NotifyDropFinished()` — после `yield return` падения, никогда прямо в обработчике `DropResultReceived`.
- Очередь: второй бросок не рвёт анимацию первого, даже если хост пришлёт его раньше времени.
- Деактивация GameObject останавливает его корутины. Объект с презентером, выключенный посреди падения,
  `DropFinished` не пришлёт, и бар останется залоченным. Во время раунда его не выключают.
- Подписка в `OnEnable` требует, чтобы `Awake` моста отработал раньше. Мост и презентер на разных
  объектах — поставить мост раньше в Script Execution Order или подписываться в `Start`.

## Mock-режим в редакторе

Mock-хоста для plinko в Unity-пакете **нет**. Он есть только у plinko-aztec (`PlinkoAztecMockHost`). Флаг
`Tools → WebBridge → Enable Mock` только отключает стартовую синхронизацию
(`HasReceivedInitialConfig = IsMockEnabled`). Конфиг и броски сами не придут, отладочной IMGUI-панели у
plinko тоже нет.

В редакторе данные подают вызовом публичного метода моста — тем же, что зовёт `SendMessage`. Тестовый
драйвер: конфиг на старте, бросок — из контекстного меню компонента (⋮ → **Drop**) в Play Mode:

```csharp
using System.Globalization;
using Modules.Plinko;
using UnityEngine;

// Dev scenes only: plays the host into the bridge, the way PlinkoMockHost does for web games.
public sealed class PlinkoDropDriver : MonoBehaviour
{
    private static readonly float[] LowLine = { 5.6f, 2.1f, 1.1f, 1f, 0.5f, 1f, 1.1f, 2.1f, 5.6f };

    [SerializeField, TextArea(3, 8)] private string _config =
        "{\"currency\":\"USD\",\"minBetAmount\":1,\"maxBetAmount\":100,\"balance\":1000,\"coefficients\":{" +
        "\"LOW\":[5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6]," +
        "\"MEDIUM\":[13,3,1.3,0.7,0.4,0.7,1.3,3,13]," +
        "\"HIGH\":[29,4,1.5,0.3,0.2,0.3,1.5,4,29]}}";

    [SerializeField, Range(0, 8)] private int _slot = 4;
    [SerializeField] private float _betAmount = 1f;

    private void Start()
    {
        PlinkoWebBridge.Instance.ApplyGameConfig(_config);
        PlinkoWebBridge.Instance.ApplyGameState("{\"status\":\"none\",\"isFinished\":true,\"isWin\":false}");
    }

    [ContextMenu("Drop")]
    private void Drop()
    {
        float coeff = LowLine[_slot];
        string win = (coeff * _betAmount).ToString("0.00", CultureInfo.InvariantCulture);
        string bet = _betAmount.ToString("0.00", CultureInfo.InvariantCulture);
        string json =
            $"{{\"bet\":{{\"amount\":\"{bet}\",\"currency\":\"USD\",\"decimalPlaces\":2}}," +
            $"\"betAmount\":\"{bet}\",\"currency\":\"USD\",\"status\":\"win\",\"isFinished\":true,\"isWin\":true," +
            $"\"risk\":\"LOW\",\"resultPosition\":{_slot}," +
            $"\"coeff\":{coeff.ToString(CultureInfo.InvariantCulture)},\"winAmount\":\"{win}\"}}";

        PlinkoWebBridge.Instance.ApplyDropResult(json);
    }
}
```

В редакторе `NotifyDropFinished()` никуда не уходит: `WebBridgeUtils.Send` пишет в консоль
`[Unity -> React] DropFinished`. По этой строке и видно, что бросок закрыт. Драйвер держат на тестовой
сцене, в сцену релизной сборки его не кладут.

## Сборка WebGL и проверка

1. Объект `WebBridge` создан пунктом меню (или из префаба) и на нём есть `LayoutWebBridge`.
2. `Enable Mock In Build` (define `WEBBRIDGE_MOCK`) выключен: с ним мост не просит у хоста конфиг и
   состояние.
3. Собрать WebGL и открыть в шелле локально (`?localBuild=…`) или на стенде конфигуратора. Игра —
   режима `plinko`, launch-URL несёт `gameMode=plinko&gameCategory=plinko`. Бар plinko в шелле пока
   заглушка: риск, сумма, кнопка ставки. Подробно — [старт на Unity](../../guides/getting-started-unity.md).
4. В сборке логи моста выключены. Включить — `SetLoggingEnabled` из чит-панели шелла. Дальше смотреть в
   консоли браузера: `[BridgeDebug][React->Unity] ApplyDropResult raw: …` и `[Unity -> React] DropFinished`
   — по одному на бросок, второй — после анимации.
5. Перезагрузить страницу во время падения: после загрузки доска в покое, шарик повторно не падает.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бар не освобождается после броска | `NotifyDropFinished()` не позван: исключение в анимации, битый payload, презентер выключен посреди падения | слать после посадки; ошибку payload — на экран и в лог; не выключать презентер во время раунда |
| Можно ставить, пока шарик летит | `NotifyDropFinished()` прямо в обработчике `DropResultReceived` | слать после `yield return` падения |
| Шарик сел не в ту ячейку | доска стоит на линии прошлого риска | перед падением перестроить доску по `GetCoefficients(drop.Risk)` |
| Доска пустая, ошибок нет | `GetCoefficients` вернул пустой массив: нет линии риска или `coefficients` в конфиге | проверять длину линии и сообщать об ошибке |
| Шарик падает при загрузке | `GameStateReceived` / `LastGameState` обрабатывается как бросок | шарик — только на `DropResultReceived` |
| Конфиг приходит через 10 с после загрузки | на объекте `WebBridge` нет `LayoutWebBridge`, первое `UiVisibility` не ушло | собрать объект из префаба `PlinkoWebBridge.prefab` |
| Тап по полю (`RequestPlay`) не бросает | в шелле plinko `RequestPlay` всегда отвечает `DisabledPlayPressed` | бросок — кнопкой бара хоста; на `DisabledPlayPressed` показать подсказку |
| `NullReferenceException` в `OnEnable` | `Awake` моста ещё не отработал, `Instance == null` | мост раньше в Script Execution Order или подписка в `Start` |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md) · [Plinko Aztec — Unity](../plinko-aztec/unity.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `unity/Assets/WebBridge/Runtime/PlinkoWebBridge.cs`, `unity/Assets/WebBridge/Runtime/WebPlinkoPayloads.cs`,
  `unity/Assets/WebBridge/Runtime/Prefabs/PlinkoWebBridge.prefab`
