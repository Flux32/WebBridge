# Crush — Unity

> Как подключить режим crush к игре на Unity (WebGL): компонент `RoadWebBridge` из пакета
> `com.pixi.webbridge`. Контракт режима — что значат команды и события, в каком порядке они идут — в
> [обзоре](README.md).

## Коротко

```csharp
using Modules.Road;
using UnityEngine;

public sealed class RoadStepsMinimal : MonoBehaviour
{
    private void Start()
    {
        RoadWebBridge.Instance.StepResultActionReady += OnStep;
        RoadWebBridge.Instance.RestartRequested += OnRestart;
    }

    private void OnDestroy()
    {
        if (RoadWebBridge.Instance == null)
            return;

        RoadWebBridge.Instance.StepResultActionReady -= OnStep;
        RoadWebBridge.Instance.RestartRequested -= OnRestart;
    }

    // Win: hop one step up. Loss: play the fall, reset the scene yourself — no RestartRound follows a loss.
    private void OnStep(StepResultAction step)
    {
        // ... play the hop or the fall, then, once it has played out:
        RoadWebBridge.Instance.NotifySpinReady();
    }

    // Cashout / win at the top: show the amount, reset the scene, then report.
    private void OnRestart(RestartReason reason, string amount)
    {
        // ... show `amount` for Cashout / Win, reset the scene, then:
        RoadWebBridge.Instance.NotifySpinReady();
    }
}
```

`NotifySpinReady()` — строго **после** анимации. Полный вариант с очередью, лесенкой, восстановлением и
бонусом — [ниже](#полный-пример).

## Подключение

1. Поставить пакет `com.pixi.webbridge` — [старт на Unity](../../guides/getting-started-unity.md).
2. В Hierarchy: **GameObject → WebBridge → Create RoadWebBridge**. Пункт ставит префаб
   `Runtime/Prefabs/RoadWebBridge.prefab` и называет объект **`WebBridge`**. Имя не менять: хост шлёт
   команды `SendMessage("WebBridge", <метод>, <параметр>)`, а имя класса роли не играет. Второй мост в
   сцену пункт не поставит.
3. Игровой код подписывается на `RoadWebBridge.Instance` в `Start` (синглтон назначается в `Awake`) и
   отписывается в `OnDestroy`. Мост от игры не зависит — зависимость идёт от игры к мосту.

Что в префабе (всё на одном GameObject `WebBridge`):

| Компонент | Зачем crush |
|---|---|
| `RoadWebBridge` | этот мост: лесенка, шаги, рестарт, бонус |
| `LayoutWebBridge` | видимость и интерактивность бет-бара; первый `UiVisibility` из его `Start` — для хоста «мост жив» |
| `WebBridgeUI` | фазы шторки перехода — такт бонуса |
| `AudioWebBridge` | звуки через хост |
| `ScreenOrientationWebBridge` | ориентация |
| `TranslationsWebBridge` | переводы |

Namespace — `Modules.Road` (мост, payload'ы, `RestartReason`, `RoadDifficulty`); общие типы (`WebBridgeBase<T>`,
`WebBridgeUtils`, `Json`, `WebGameStateBase`) — `WebBridge`. Сборка `WebBridge.Runtime`; `link.xml` пакета
сохраняет её целиком от стриппинга IL2CPP.

## Провод

Как команды хоста ложатся на методы моста (`RoadFrontent/src/engine/unity/unityProtocol.ts`):

| Команда протокола | `SendMessage("WebBridge", …)` | Параметр |
|---|---|---|
| `SetDifficulty` | `SetDifficulty` | `"EASY"` · `"MEDIUM"` · `"HARD"` · `"DAREDEVIL"` |
| `UpdateCoeffs` | `UpdateCoeffs` | CSV `"1.03,1.07,1.12"` |
| `ApplyGameConfig` | `ApplyGameConfig` | JSON `WebGameConfigPayload` |
| `ApplyGameState` | `ApplyGameState` | JSON `WebGameStatePayload` |
| `ApplyStepResult` | `ApplyStepResult` | JSON `WebGameStatePayload` (поля шага) |
| `RestartRound` | `RestartRound` | `"cashout\|$2.40"`, `"win\|$5.80"`, `""` |
| `CashoutPressed` | `OnCashoutPressed` | `""` |
| `StartBonus` | `StartBonus` | JSON `WebBonusStartPayload`; `currency` — код показа (`DEMO` → `"D"`) |
| `ApplyBonusPurchaseResult` | `ApplyBonusPurchaseResult` | JSON `WebBonusPurchasePayload` |
| `SetAutoplay` | `SetAutoplay` | `1` / `0` — **в `RoadWebBridge` приёмника нет**, см. [автоплей](#автоплей-setautoplay) |
| `TransitionScreen*` | `OnTransitionScreenOpenStarted` … `OnTransitionScreenCloseFinished` | `""` → `WebBridgeUI` |

Обратно — `WebBridgeUtils.Send(<строка>)` → JS `SendToReact`: `SpinReady`, `BonusActive`, `BonusEnded`,
`BonusCleared`, `BonusProgressClear`, `BonusProgressSave_{json}`, `RequestGameConfig`, `RequestGameState`,
`RequestWhiteLabel`, `RequestPlay`. `BonusPurchaseRequest` уходит JSON-строкой
`{"action":"play","payload":{…}}` — хост узнаёт её по `action` `play` или `bet`.

## API `RoadWebBridge`

`RoadWebBridge : WebBridgeBase<RoadWebBridge>`. Общее для всех мостов — синглтон, стартовая синхронизация,
white-label, fast game, `CashoutPressed`, `DisabledPlayPressed`, отметки окна — в
[ядре Unity-моста](../../reference/unity-core.md). Здесь — то, что добавляет crush.

### События (React → игра)

| Событие C# | Тип аргумента | Метод `SendMessage` | Когда срабатывает |
|---|---|---|---|
| `DifficultyChanged` | `RoadDifficultyChange` | `SetDifficulty` | сложность **сменилась**; та же повторно события не поднимает |
| `CoefficientsReceived` | `float[]` | `UpdateCoeffs`, `ApplyGameConfig` | лесенка **сменилась** (сравнение с прошлой поднятой, `Mathf.Approximately`); не поднимается при `SuppressCoefficientUpdates` |
| `GameConfigReceived` | `WebGameConfigPayload` | `ApplyGameConfig` | каждый конфиг |
| `BalanceReceived` | `float` | `ApplyGameConfig` | в конфиге есть `balance` |
| `GameStateReceived` | `WebGameStatePayload` | `ApplyGameState`, **и `ApplyStepResult`** | состояние сессии — и каждый шаг: шаг тоже кладётся в `LastGameState` |
| `StepResultReceived` | `WebGameStatePayload` | `ApplyStepResult`, `CreateStep` | сырой шаг, до `StepResultActionReady` |
| `StepResultActionReady` | `StepResultAction` | `ApplyStepResult`, `CreateStep` | шаг разобран: `IsWin`, `BonusStepTriggered`. Не поднимается, если исход не определить (предупреждение в лог) |
| `RestartRequested` | `RestartReason, string` | `RestartRound` | рестарт сцены: причина и сумма строкой показа (`"$2.40"`, `null` без суммы) |
| `BonusStartRequested` | `WebBonusStartPayload` | `StartBonus` | вход в серию: свежую (`CompletedIterations = 0`) и восстановленную. Битый JSON — предупреждение, события нет |
| `BonusModePurchaseFailed` | `string` (modeId) | `ApplyBonusPurchaseResult` | покупка отклонена (`isPurchased: false`) или с `isPurchased: true` пришёл `bonusGame` без позиций / итога |
| `BonusModePurchased` | `string, int` | — | **никогда не поднимается**: объявлен, но мост его не вызывает |
| `SpinRequested` | `int` | — | только в редакторе без mock: `DoSpin(win)` |
| `MockDifficultyChanged` | `string` | — | **устарело** — подписываться на `DifficultyChanged`; поднимает только mock |

Из базы и соседних компонентов crush нужны:

| Событие | Где | Зачем crush |
|---|---|---|
| `CashoutPressed` | `RoadWebBridge` (база) | свернуть живой раунд до окна |
| `DisabledPlayPressed` | `RoadWebBridge` (база) | показать, почему Play не сработал |
| `WinWindowSignalReceived` | `RoadWebBridge` (база) | отметки сценария окна кэшаута / выигрыша |
| `TransitionScreenOpenStarted` … `TransitionScreenCloseFinished` | `WebBridgeUI.Instance` | такт бонуса; `CurrentPhase` и `TransitionCycleId` — для подписчика, который опоздал |

### Как мост разбирает шаг

`ApplyStepResult(json)` → `WebGameStatePayload` → события в таком порядке:

1. `IsWin` = `isWinMain`, если он есть; иначе по `status`: `"in-game"` / `"win"` → `true`, `"lose"` → `false`.
   Хост всегда шлёт `isWinMain`; разбор `status` — для старых хостов.
2. `BonusStepTriggered` = `coinsTriggered`, если он есть; иначе «монет стало больше, чем в прошлом шаге»
   (`coinsCollected.Length` против `LastStepResult`). Хост всегда шлёт `coinsTriggered`.
3. `LastStepResult` и `LastGameState` = этот шаг; поднимаются `StepResultReceived`, затем `GameStateReceived`.
4. Исход не определился (нет ни `isWinMain`, ни понятного `status`) — предупреждение в лог, дальше ничего.
5. Иначе — `StepResultActionReady(new StepResultAction { IsWin, BonusStepTriggered })`.
6. Только в mock: если шаг выигрышный и это шаг на последнюю ступень лесенки — `CashoutPressed`, затем
   `RestartRequested(RestartReason.Cashout, "$<сумма>")`.

### Методы (игра → React)

| Метод | Сообщение в React | Когда звать |
|---|---|---|
| `NotifySpinReady()` | `SpinReady` | шаг доигран; сцена сброшена после проигрыша или после `RestartRequested`; при желании — один раз, когда сцена впервые готова к ставке |
| `NotifyBonusActive()` | `BonusActive` | бонусное поле на экране (за шторкой) |
| `SaveBonusAutoPlayProgress(WebBonusAutoPlayProgress)` | `BonusProgressSave_{json}` | в начале каждой итерации серии; `null` — ничего не шлёт |
| `NotifyBonusEnded()` | `BonusEnded` | последняя итерация доиграна |
| `ClearBonusAutoPlayProgress()` | `BonusProgressClear` | бонус позади |
| `NotifyBonusCleared()` | `BonusCleared` | сразу после `ClearBonusAutoPlayProgress()` |
| `RequestPlay()` | `RequestPlay` | ход из самой сцены (тап по полю). В mock — сразу mock-шаг или `DisabledPlayPressed` |
| `RequestGameConfig()` / `RequestGameState()` | `RequestGameConfig` / `RequestGameState` | переспросить вручную; стартовую синхронизацию мост ведёт сам. В mock — сразу mock-конфиг / mock-состояние |
| `RequestWhiteLabel()` | `RequestWhiteLabel` | в mock — сразу `_mockIsWhiteLabel` |

Без сообщения в React:

| Метод | Что делает |
|---|---|
| `ResolveBonusModesForShop()` | `IReadOnlyList<WebBonusShopModePayload>` из `LastGameConfig` — для своего магазина (через `RoadBonusModeReader`) |
| `ResolveBonusPositionsForAutoPlay()` | `int[]`: `LastStepResult.bonusGame.bonusPositions`, в mock без них — `_mockBonusPositions`, иначе пустой массив |
| `ResetMockRound()` | обнулить счётчики mock-раунда и прислать mock-состояние; звать после каждого рестарта сцены в mock |
| `DoSpin(int win)` | только `#if UNITY_EDITOR`: в mock — mock-шаг, без mock — `SpinRequested(win)` |

Покупку бонуса из своего UI мост не отправляет — метода нет. Игра шлёт её сама:

```csharp
WebBridgeUtils.Send(
    "{\"action\":\"play\",\"payload\":{\"betAmount\":10,\"currency\":\"USD\",\"difficulty\":\"EASY\",\"bonusType\":\"default\"}}");
```

`betAmount` — **полная** цена бонуса (ставка × множитель режима из `ResolveBonusModesForShop()`). Успех — это
`BonusStartRequested`, отказ — `BonusModePurchaseFailed`.

### Свойства

| Свойство | Тип | Что хранит |
|---|---|---|
| `Instance` | `RoadWebBridge` | синглтон (из базы) |
| `CurrentDifficulty` | `RoadDifficulty?` | сложность в игре, бонусная тоже; `null`, пока хост её не прислал |
| `LastGameConfig` | `WebGameConfigPayload` | последний конфиг |
| `LastGameState` | `WebGameStatePayload` | последнее состояние **или шаг** |
| `LastStepResult` | `WebGameStatePayload` | последний шаг; после `ApplyGameState` — это состояние (от него считается дельта монет) |
| `LastBalance` | `float?` | последний `balance` из конфига |
| `SuppressCoefficientUpdates` | `bool` (get/set) | не поднимать `CoefficientsReceived` (например, пока бонус ведёт свою лесенку). Подавленная лесенка не запоминается: после снятия флага та же, что была до него, не поднимется — читать `LastGameConfig` |
| `CanProcessMockSpin` | `Func<bool>` (get/set) | гейт mock-шагов: `false` — mock-шаг не делается, `RequestPlay` отвечает `DisabledPlayPressed` |
| `CurrentMockDifficulty` | `string` | **устарело** — читать `CurrentDifficulty`; сложность mock строчными (`"easy"`), вне mock `null` |
| `CurrentIsWhiteLabel`, `IsFastGameEnabled` | `bool?`, `bool` | из базы |

### Особенности методов приёма

| Метод | Особенность |
|---|---|
| `SetDifficulty(string)` | только точное имя: `"hard"`, `"1"`, `""` — предупреждение `[RoadWebBridge] SetDifficulty ignored` и ничего |
| `UpdateCoeffs(string)` | в mock игнорируется целиком. Пустая строка — игнор. Нечисловой токен **молча пропускается** — лесенка выйдет короче. Ставит «конфиг получен» для стартовой синхронизации |
| `ApplyGameConfig(string)` | битый JSON — предупреждение и ничего. Не зависит от mock |
| `CreateStep(string)` | то же, что `ApplyStepResult`; хост его **не шлёт** — остался от старого протокола |
| `RestartRound(string)` | разбор `RestartRoundPayload.Parse`: причина до `\|` без учёта регистра, неизвестная → `None`; сумма — всё после `\|` |
| `ApplyBonusPurchaseResult(string)` | пустой `modeId` → `"easy"`. С `isPurchased: true` и валидным `bonusGame` кладёт его в `LastStepResult`, но события не поднимает: вход в серию — только `StartBonus` |

## Payload-классы

Все — `[Serializable]`, `[Preserve]`, поля с `[JsonName("…")]` (свой JSON-парсер пакета `WebBridge.Json`,
не Newtonsoft). Если хост завернул payload в массив, `DeserializePayload` берёт первый элемент.

### `WebGameConfigPayload` ← `ApplyGameConfig`

| Поле C# | JSON | Тип |
|---|---|---|
| `Coefficients` | `coefficients` | `float[]` |
| `BonusCounts` | `bonusCounts` | `Dictionary<string, int>` |
| `BonusModes` | `bonusModes` | `JsonValue` (объект по сложностям или массив режимов) |
| `Currency` | `currency` | `string` — символ показа (`"$"`) |
| `MinBetAmount`, `MaxBetAmount` | `minBetAmount`, `maxBetAmount` | `float?` |
| `Balance` | `balance` | `float?` |

### `WebGameStatePayload` ← `ApplyGameState`, `ApplyStepResult`

Наследник `WebGameStateBase` (`Status` ← `status`, `Bet` ← `bet {amount, currency, decimalPlaces}`,
`IsFinished` ← `isFinished`, `IsWin` ← `isWin`, `WinAmount` ← `winAmount`, `Error` ← `error`).

| Поле C# | JSON | Тип | Смысл |
|---|---|---|---|
| `Step` | `lineNumber` | `int?` | последняя пройденная линия сервера, с нуля; `-1` — раунд открыт, шагов нет. В шаге от хоста **нет** |
| `BonusStepsCollected` | `coinsCollected` | `int[]` | монеты раунда |
| `BonusStepTriggered` | `coinsTriggered` | `bool?` | монета на этом шаге |
| `BonusGame` | `bonusGame` | `WebBonusGamePayload` | собранный бонус / сохранённый прогресс |
| `IsWinMain` | `isWinMain` | `bool?` | шаг пережит |

### `WebBonusGamePayload`

`BonusTotalCoefficient` (`float`), `BonusTotalWin` (`string`), `BonusPositions` (`int[]`), и для
восстановления: `CompletedIterations`, `CurrentStep` (`int?`), `AccumulatedCoefficient`, `AccumulatedWin`,
`BetAmount` (`float?`), `BonusCurrency`, `BonusCoefficients`, `Difficulty` (`string`).

### `WebBonusStartPayload` ← `StartBonus`

| Поле C# | JSON | Тип |
|---|---|---|
| `ModeId`, `Difficulty` | `modeId`, `difficulty` | `string` (`"EASY"`) |
| `Positions` | `positions` | `int[]` — все итерации серии |
| `BonusCoefficients` | `bonusCoefficients` | `string` — CSV лесенки бонусной сложности |
| `BetAmount`, `Currency` | `betAmount`, `currency` | `float`, `string` — ставка забега в валюте кошелька |
| `DisplayBet` | `displayBet` | `string` — ставка строкой показа; road-хост сейчас не шлёт → `null`, брать `BetAmount` |
| `BonusTotalCoefficient`, `BonusTotalWin` | `bonusTotalCoefficient`, `bonusTotalWin` | `float`, `string` (`""` — итога нет, `"0"` — нулевой) |
| `CompletedIterations`, `CurrentStep` | `completedIterations`, `currentStep` | `int` |
| `AccumulatedCoefficient`, `AccumulatedWin` | `accumulatedCoefficient`, `accumulatedWin` | `float` |

### `WebBonusAutoPlayProgress` → `SaveBonusAutoPlayProgress`

`Positions`, `CompletedIterations`, `TotalIterations`, `AccumulatedCoefficient`, `AccumulatedWin`,
`BetAmount`, `Currency`, `CurrentStep`, `Difficulty`, `BonusCoefficients` (JSON — те же имена в camelCase).

> **Заполнять все поля.** Сериализатор пишет незаданное поле как `null`, а хост проверяет запись схемой:
> `difficulty`, `currency` и `positions` не могут быть `null` (только отсутствовать), и запись с таким полем
> хост отбрасывает целиком — счётчик «Free games left» не двигается, F5 не находит прогресс. `null` можно
> только в `bonusCoefficients`. Берите значения из `WebBonusStartPayload`.

### Остальное

| Тип | Что это |
|---|---|
| `WebBonusPurchasePayload` ← `ApplyBonusPurchaseResult` | `ModeId`, `IsPurchased`, `Error`, `BonusGame` |
| `WebBonusShopModePayload` | строка магазина: `ModeName`, `Price`, `Currency`, `BonusAmount` |
| `StepResultAction` | аргумент `StepResultActionReady`: `IsWin`, `BonusStepTriggered` |
| `RestartReason` | `None = 0`, `Win = 1`, `Cashout = 2`, `Lose = 3`. `Lose` хост не шлёт |
| `RestartRoundPayload` | `Parse(string payload, out RestartReason reason, out string amount)` |
| `RoadDifficulty` | `Easy = 0`, `Medium = 1`, `Hard = 2`, `Daredevil = 3` — числа внутренние, на провод не идут |
| `RoadDifficultyChange` | `Previous` (`RoadDifficulty?`, `null` — первая после загрузки), `Current` |
| `RoadDifficultyWireNames` | `TryParse(string, out RoadDifficulty)` — только точные `EASY`…`DAREDEVIL`; `ToWireName()` — обратно |
| `RoadBonusModeReader` | `ReadShopModes(WebGameConfigPayload)`: режимы магазина из `bonusModes` любой формы (объект или массив), запасной путь — `bonusCounts` с ценой `"0"` |
| `RoadBridgeDebug` | строки для отладочного лога моста (`BuildConfigDebugInfo`, `BuildStateDebugInfo`) |

## Полный пример

Связка моста с игрой: лесенка, шаги в очереди, проигрыш без рестарта, кэшаут, восстановление, автоплей и
бонусная серия. Рисование — в абстрактном `RoadScene`, его реализует игра; так устроен `MegaBlockBridge` в
`MegaBlockRemake`.

```csharp
using System.Collections;
using UnityEngine;

/// <summary>What the game draws; every coroutine ends once its motion has played out.</summary>
public abstract class RoadScene : MonoBehaviour
{
    public abstract bool IsReadyForStep { get; }
    public abstract void BuildLadder(float[] coefficients);
    public abstract void PlaceAt(int step);
    public abstract IEnumerator Hop(int toStep, bool withCoin);
    public abstract IEnumerator Crush(int onStep);
    public abstract void FoldRound();
    public abstract IEnumerator ShowWin(string amount);
    public abstract IEnumerator ResetToStart();
    public abstract void ShowBonusField(bool isBonus);
    public abstract IEnumerator BonusRun(int position);
    public abstract float CoefficientAt(int step);
    public abstract void SetAutoplayLook(bool isAutoplay);
}
```

```csharp
using System.Collections;
using System.Collections.Generic;
using Modules.Road;
using UnityEngine;
using WebBridge;

/// <summary>Plays the road round the host drives; the bridge knows nothing of the game.</summary>
public sealed class RoadGameConnector : MonoBehaviour
{
    // In front of the first step: after play, before the first step lands.
    private const int StartStep = -1;

    [SerializeField] private RoadScene _scene;

    private readonly Queue<IEnumerator> _moves = new Queue<IEnumerator>();
    private bool _isPlayingMoves;
    private int _step = StartStep;

    private void Start()
    {
        RoadWebBridge bridge = RoadWebBridge.Instance;
        bridge.CoefficientsReceived += OnCoefficientsReceived;
        bridge.GameStateReceived += OnGameStateReceived;
        bridge.StepResultActionReady += OnStepResultActionReady;
        bridge.CashoutPressed += OnCashoutPressed;
        bridge.RestartRequested += OnRestartRequested;
        bridge.CanProcessMockSpin = () => _scene.IsReadyForStep;
        bridge.GetComponent<RoadAutoplayReceiver>().AutoplayChanged += _scene.SetAutoplayLook;

        // In mock mode the bridge raises config and state in its own Start, which may run before this one.
        if (bridge.LastGameConfig?.Coefficients != null)
            OnCoefficientsReceived(bridge.LastGameConfig.Coefficients);
        if (bridge.LastGameState != null)
            OnGameStateReceived(bridge.LastGameState);
    }

    private void OnDestroy()
    {
        RoadWebBridge bridge = RoadWebBridge.Instance;
        if (bridge == null)
            return;

        bridge.CoefficientsReceived -= OnCoefficientsReceived;
        bridge.GameStateReceived -= OnGameStateReceived;
        bridge.StepResultActionReady -= OnStepResultActionReady;
        bridge.CashoutPressed -= OnCashoutPressed;
        bridge.RestartRequested -= OnRestartRequested;
        bridge.CanProcessMockSpin = null;
        bridge.GetComponent<RoadAutoplayReceiver>().AutoplayChanged -= _scene.SetAutoplayLook;
    }

    private void OnCoefficientsReceived(float[] coefficients) => _scene.BuildLadder(coefficients);

    // Every step raises GameStateReceived too, without lineNumber: only a session state carries one.
    private void OnGameStateReceived(WebGameStatePayload state)
    {
        if (!state.Step.HasValue || state.IsFinished == true)
            return;

        _step = state.Step.Value;
        _scene.PlaceAt(_step);
    }

    private void OnStepResultActionReady(StepResultAction step) => Enqueue(PlayStep(step));

    private void OnCashoutPressed() => _scene.FoldRound();

    private void OnRestartRequested(RestartReason reason, string amount) => Enqueue(Restart(reason, amount));

    // Host commands play one after another: a restart may arrive while a hop is still in the air.
    private void Enqueue(IEnumerator move)
    {
        _moves.Enqueue(move);
        if (!_isPlayingMoves)
            StartCoroutine(PlayMoves());
    }

    private IEnumerator PlayMoves()
    {
        _isPlayingMoves = true;
        while (_moves.Count > 0)
            yield return _moves.Dequeue();
        _isPlayingMoves = false;
    }

    private IEnumerator PlayStep(StepResultAction step)
    {
        // A lost step still aims at the next step: that is where the block falls.
        _step++;
        if (step.IsWin)
        {
            yield return _scene.Hop(_step, step.BonusStepTriggered);
        }
        else
        {
            yield return _scene.Crush(_step);
            yield return ResetScene(); // the host sends no RestartRound after a loss
        }

        RoadWebBridge.Instance.NotifySpinReady();
    }

    private IEnumerator Restart(RestartReason reason, string amount)
    {
        if (reason == RestartReason.Cashout || reason == RestartReason.Win)
            yield return _scene.ShowWin(amount);

        yield return ResetScene();
        RoadWebBridge.Instance.NotifySpinReady();
    }

    private IEnumerator ResetScene()
    {
        yield return _scene.ResetToStart();
        _step = StartStep;

        // The mock counts its steps to cash out at the top; a fresh round starts the count again.
        if (WebBridgeUtils.IsMockEnabled)
            RoadWebBridge.Instance.ResetMockRound();
    }
}
```

```csharp
using System;
using UnityEngine;

/// <summary>
/// Receives SetAutoplay. React's SendMessage reaches only components of the "WebBridge" GameObject, and
/// RoadWebBridge has no receiver for this command, so this component goes on that GameObject.
/// </summary>
public sealed class RoadAutoplayReceiver : MonoBehaviour
{
    public event Action<bool> AutoplayChanged;

    public bool IsAutoplayActive { get; private set; }

    // React entry point (SendMessage): 1 = autoplay on, 0 = off or paused.
    public void SetAutoplay(int value)
    {
        IsAutoplayActive = value != 0;
        AutoplayChanged?.Invoke(IsAutoplayActive);
    }
}
```

```csharp
using System.Collections;
using Modules.Road;
using UnityEngine;

/// <summary>Plays a crush bonus series in step with the host's transition curtain.</summary>
public sealed class RoadBonusSeries : MonoBehaviour
{
    [SerializeField] private RoadScene _scene;

    private void Start() => RoadWebBridge.Instance.BonusStartRequested += OnBonusStartRequested;

    private void OnDestroy()
    {
        if (RoadWebBridge.Instance != null)
            RoadWebBridge.Instance.BonusStartRequested -= OnBonusStartRequested;
    }

    private void OnBonusStartRequested(WebBonusStartPayload bonus) => StartCoroutine(PlaySeries(bonus));

    private IEnumerator PlaySeries(WebBonusStartPayload bonus)
    {
        RoadWebBridge bridge = RoadWebBridge.Instance;

        int opening = CycleBeforeCurtain();
        yield return WaitForCurtain(opening, WebBridgeUI.TransitionPhase.CloseStarted);
        _scene.ShowBonusField(true); // the bonus ladder arrives through CoefficientsReceived after BonusActive
        bridge.NotifyBonusActive();
        yield return WaitForCurtain(opening, WebBridgeUI.TransitionPhase.CloseFinished);

        float accumulatedCoefficient = bonus.AccumulatedCoefficient;
        for (int iteration = bonus.CompletedIterations; iteration < bonus.Positions.Length; iteration++)
        {
            SaveProgress(bonus, iteration, accumulatedCoefficient);
            int position = bonus.Positions[iteration];
            yield return _scene.BonusRun(position);
            accumulatedCoefficient += _scene.CoefficientAt(position);
        }

        int closing = CycleBeforeCurtain();
        bridge.NotifyBonusEnded(); // the host shows the bonus win, then brings the curtain
        yield return WaitForCurtain(closing, WebBridgeUI.TransitionPhase.CloseStarted);
        _scene.ShowBonusField(false);
        yield return _scene.ResetToStart();
        yield return WaitForCurtain(closing, WebBridgeUI.TransitionPhase.CloseFinished);
        bridge.ClearBonusAutoPlayProgress();
        bridge.NotifyBonusCleared(); // the host sends the regular ladder back
    }

    // The curtain this series waits for: the one already closing over the screen, or the next one.
    private static int CycleBeforeCurtain()
    {
        WebBridgeUI ui = WebBridgeUI.Instance;
        return ui.IsTransitionScreenOpen ? ui.TransitionCycleId - 1 : ui.TransitionCycleId;
    }

    // Reads the latched phase instead of the events, so a phase that passed before the wait is not missed.
    private static IEnumerator WaitForCurtain(int cycleBefore, WebBridgeUI.TransitionPhase phase)
    {
        WebBridgeUI ui = WebBridgeUI.Instance;
        while (ui.TransitionCycleId == cycleBefore || ui.CurrentPhase < phase)
            yield return null;
    }

    // Every field is filled: the host refuses a record with a null difficulty, currency or positions.
    private static void SaveProgress(WebBonusStartPayload bonus, int completedIterations, float accumulatedCoefficient)
    {
        RoadWebBridge.Instance.SaveBonusAutoPlayProgress(new WebBonusAutoPlayProgress
        {
            Positions = bonus.Positions,
            CompletedIterations = completedIterations,
            TotalIterations = bonus.Positions.Length,
            AccumulatedCoefficient = accumulatedCoefficient,
            AccumulatedWin = accumulatedCoefficient * bonus.BetAmount,
            BetAmount = bonus.BetAmount,
            Currency = bonus.Currency,
            CurrentStep = 0,
            Difficulty = bonus.Difficulty,
            BonusCoefficients = bonus.BonusCoefficients,
        });
    }
}
```

Что здесь важно:

1. **`NotifySpinReady()` — после `yield return` анимации**, и ровно один на шаг и на рестарт.
2. **`GameStateReceived` приходит и на каждый шаг**, поэтому восстановление смотрит на `Step` (`lineNumber`):
   в шаге от хоста его нет.
3. **Кэш при старте.** В mock мост раздаёт конфиг и состояние в своём `Start`; если тот отработал раньше
   вашего, события уже прошли — читайте `LastGameConfig` / `LastGameState`.
4. **Шторка — по защёлке `WebBridgeUI`** (`CurrentPhase` + `TransitionCycleId`), а не только по событиям:
   после F5 или на медленной сети фаза может пройти раньше, чем игра подписалась.
5. **`SetAutoplay` — на объекте `WebBridge`.** `SendMessage` не дойдёт до компонента на другом объекте.

## Автоплей (`SetAutoplay`)

Хост шлёт `SendMessage("WebBridge", "SetAutoplay", 1 | 0)`, но в `RoadWebBridge` приёмника нет. Без
компонента с `public void SetAutoplay(int)` на объекте `WebBridge` Unity пишет в консоль ошибку о
сообщении без получателя, а игра автоплея не видит. Автоплею это не мешает — ходы приходят обычными
`ApplyStepResult`, — но если игре нужен свой вид автоплея, нужен приёмник вроде `RoadAutoplayReceiver` выше.
Так сделано в MegaGrab (`MegaGrabBridge.SetAutoplay(int)`); у `JumperWebBridge` приёмник есть в самом мосте.

## Mock-режим в редакторе

Mock подменяет хост и сервер внутри Unity: можно играть раунд в Play Mode без веб-сборки. Общая идея — в
[mock-режиме](../../concepts/mock-mode.md).

### Как включить

1. **Tools → WebBridge → MockConfig** — один раз: окно создаёт `Assets/Resources/MockConfig.asset`, если его
   нет. Без ассета mock падает на старте (`MockConfig.Instance` — `null`).
2. **Tools → WebBridge → Enable Mock** — флаг в `EditorPrefs`, только Play Mode редактора.
3. Play. В `Start` мост ставит сложность по умолчанию из `MockConfig`, шлёт себе mock-конфиг и
   mock-состояние и вешает на объект отладочную панель `MockDebugIMGUI`.

**Tools → WebBridge → Enable Mock In Build** добавляет символ `WEBBRIDGE_MOCK` — тогда mock включён и в
сборке, и игра в шелле отвечает сама себе, не слушая хост. Снимать перед любой сборкой для стенда.

### `MockConfig`

ScriptableObject `Resources/MockConfig`: записи «имя сложности → лесенка» и сложность по умолчанию. По
умолчанию — `easy`, `medium`, `hard` по 9 ступеней (`DAREDEVIL` нет — добавить вручную). Имя — любое из
`EASY`/`MEDIUM`/`HARD`/`DAREDEVIL` в любом регистре; неизвестное — ошибка в логе, запись пропускается.
Дефолт без своей записи — `InvalidOperationException` на старте mock.

### Поля секции `Mock` в инспекторе `RoadWebBridge`

| Поле | По умолчанию | Что делает |
|---|---|---|
| `Mock Bonus Counts` | `easy` 10 × `"100"`, `medium` 8 × `"200"`, `hard` 6 × `"300"`, `USD` | режимы магазина в mock-конфиге (`bonusCounts`, `bonusModes`) |
| `Mock Lose Chance` | `0.3` | вероятность проигрыша шага |
| `Mock Bonus Step Trigger Chance` | `0.45` | вероятность монеты на шаге |
| `Mock Bonus Steps Threshold` | `3` | сколько монет нужно для `bonusGame` |
| `Mock Bet Amount` | `10` | ставка для суммы автокэшаута и итога бонуса |
| `Mock Win Decimals` | `2` | знаков в строке суммы |
| `Mock Bonus Positions` | `2, 3, 4` | позиции бонуса, если их не из чего сгенерировать |
| `Mock Is White Label` | `false` | ответ на `RequestWhiteLabel` |

### Что делает mock

| Вход | В mock |
|---|---|
| `ApplyStepResult`, `CreateStep`, `RequestPlay`, `DoSpin` | payload игнорируется, делается mock-шаг (если `CanProcessMockSpin` не против; `RequestPlay` при закрытом гейте — `DisabledPlayPressed`) |
| mock-шаг | монета с шансом `Mock Bonus Step Trigger Chance`, пока их меньше порога; проигрыш с шансом `Mock Lose Chance`; на проигрыше с набранным порогом — `bonusGame` |
| выигрышный шаг на последнюю ступень | `CashoutPressed`, затем `RestartRequested(Cashout, "$<коэффициент × Mock Bet Amount>")` |
| `UpdateCoeffs` | игнорируется: лесенку ведёт mock |
| `RequestGameConfig` / `RequestGameState` | сразу mock-конфиг / mock-состояние (`GameConfigReceived`, `GameStateReceived`) |
| клавиша **D** | следующая сложность по кругу из `MockConfig`: `DifficultyChanged`, затем новая лесенка |

Чего mock **не** делает: не шлёт `RestartRequested` после проигрыша (как и настоящий хост), не запускает
бонус (`BonusStartRequested` в mock не бывает — запустите серию сами, как `MegaBlockBridge.SimBonus`), не
шлёт `TransitionScreen*`, не знает автоплея. Сообщения игры (`NotifySpinReady` и пр.) в редакторе только
пишутся в лог.

### Отладочные панели

- **`MockDebugIMGUI`** — перетаскиваемая кнопка **DBG**: строки «< значение >» для **Difficulty**, **Lose %**
  и **Bonus %** (шаг 5 %). Добавляется мостом сам в mock.
- **`CheatDebugIMGUI`** — при **Tools → WebBridge → Enable Cheats** (или символе `WEBBRIDGE_CHEATS` в
  сборке): выбор сложности и сценария бэкенда (полный путь, путь с монетами, бонус…) и отправка `nonce`
  через `CheatBridge`. После раунда — **OFF**, иначе следующая ставка возьмёт тот же `nonce`.

## Сборка WebGL и проверка

Перед сборкой:

1. **Enable Mock In Build** и **Enable Cheats In Build** сняты (нет `WEBBRIDGE_MOCK` / `WEBBRIDGE_CHEATS`
   в Scripting Define Symbols).
2. В сцене один объект `WebBridge` из префаба `RoadWebBridge`; на нём же — приёмник `SetAutoplay`, если он
   нужен.
3. Игра шлёт `NotifySpinReady()` после каждого шага и каждого рестарта — и после проигрыша без рестарта.

Загрузка сборки на стенд и запуск в шелле — в [старте на Unity](../../guides/getting-started-unity.md).
Логи моста в сборке выключены; включает их команда `SetLoggingEnabled(1)` из чит-панели шелла — тогда видны
строки `[BridgeDebug][React->Unity] … raw: …` с каждым payload'ом. Предупреждения и ошибки моста видны
всегда.

Проверить в шелле:

- бар оживает после каждого шага, а не по ответу сервера;
- проигрыш: сцена сбрасывается сама, бар оживает без `RestartRound`;
- кэшаут: коэффициент гаснет на `CashoutPressed`, сумма в `RestartRequested` совпадает с окном;
- вершина: окно выигрыша, затем `RestartRequested(Win, …)`;
- смена сложности между раундами: `DifficultyChanged`, затем новая лесенка;
- F5 посреди раунда: игрок на той же ступени;
- бонус из магазина: поле меняется за шторкой, «Free games left» уменьшается, F5 посреди серии доигрывает
  остаток.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| бар не оживает после проигрыша | игра ждёт `RestartRequested(Lose, …)` | после анимации проигрыша сбросить сцену самой и `NotifySpinReady()` |
| бар не оживает после кэшаута / вершины | на `RestartRequested` нет `NotifySpinReady()` | сбросить сцену и прислать `SpinReady` |
| выигрыш раньше, чем блок сел | `NotifySpinReady()` до конца анимации | звать после `yield return` движения |
| лесенка не приходит | нет `LayoutWebBridge` на объекте или объект назван не `WebBridge` | префаб `RoadWebBridge` через меню, имя не трогать |
| `SetDifficulty ignored` в логе | хост прислал не то имя | имена только `EASY`/`MEDIUM`/`HARD`/`DAREDEVIL` |
| игрока «восстанавливает» на каждом шаге | обработчик `GameStateReceived` не отличает шаг от состояния | смотреть `state.Step.HasValue` |
| `SendMessage: object WebBridge does not have receiver for function SetAutoplay!` | приёмника `SetAutoplay` нет | компонент с `SetAutoplay(int)` на объекте `WebBridge` |
| «Free games left» не двигается, F5 не находит серию | в `WebBonusAutoPlayProgress` поле `null` (`Difficulty`, `Currency`, `Positions`) — хост отбросил запись | заполнить все поля из `WebBonusStartPayload` |
| после бонуса следующая серия не восстанавливается после F5 | нет `NotifyBonusCleared()` | `ClearBonusAutoPlayProgress()`, затем `NotifyBonusCleared()` |
| после бонуса игра крутит бонусную лесенку | бонус шёл с `SuppressCoefficientUpdates = true`: мост не поднимал бонусную лесенку и не запомнил её, поэтому обычную после бонуса считает повтором и молчит | после снятия подавления перестроить лесенку из `LastGameConfig.Coefficients`, не дожидаясь события |
| в mock `NullReferenceException` в `Start` | нет `Resources/MockConfig.asset` | **Tools → WebBridge → MockConfig** |
| в шелле игра играет сама с собой | собрано с `WEBBRIDGE_MOCK` | снять **Enable Mock In Build** |
| `BonusModePurchased` не приходит | мост его не поднимает | успех покупки — `BonusStartRequested` |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `unity/Assets/WebBridge/Runtime/RoadWebBridge.cs`, `WebBridgePayloads.cs`, `RestartReason.cs`,
  `RestartRoundPayload.cs`, `RoadDifficulty.cs`, `RoadBonusModeReader.cs`, `RoadBridgeDebug.cs`,
  `MockConfig.cs`, `MockDebugIMGUI.cs`, `WebBridgeUI.cs`, `Prefabs/RoadWebBridge.prefab`
- Рабочая интеграция: `Pixi/MegaBlockRemake/Assets/Scripts/System/Web/MegaBlockBridge.cs`,
  `Assets/Scripts/Game/BonusRound/SpinsBonus.cs`
