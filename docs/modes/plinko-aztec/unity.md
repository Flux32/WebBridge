# Plinko Aztec — Unity

> Как подключить режим к игре на Unity (WebGL). Контракт режима — в [обзоре](README.md).

## Коротко

```csharp
using System.Collections;
using Modules.PlinkoAztec;
using UnityEngine;

public sealed class PlinkoAztecDropPlayer : MonoBehaviour
{
    [SerializeField] private PlinkoAztecWebBridge _bridge;

    private void OnEnable() => _bridge.DropResultReceived += OnDropResult;

    private void OnDisable() => _bridge.DropResultReceived -= OnDropResult;

    private void OnDropResult(WebPlinkoAztecStatePayload result) => StartCoroutine(PlayDrop(result));

    private IEnumerator PlayDrop(WebPlinkoAztecStatePayload result)
    {
        yield return new WaitForSeconds(2f);   // здесь — падение шариков, колесо, бонус
        _bridge.NotifyDropFinished();          // один раз, когда доиграно всё
    }
}
```

Бонусная игра, восстановление и выбор бет-бара — в [полном примере](#полный-пример).

## Подключение

1. Поставить UPM-пакет `com.pixi.webbridge` (тег `unity-v*`) — [старт на Unity](../../guides/getting-started-unity.md).
2. На сцену — **GameObject → WebBridge → Create PlinkoAztecWebBridge**. Пункт меню ставит префаб
   `Runtime/Prefabs/PlinkoAztecWebBridge.prefab` и называет объект `WebBridge`: хост адресует его по имени
   (`SendMessage('WebBridge', …)`), имя класса роли не играет. Второй мост на сцену меню не даст — мост на сцене
   один (Road, Plinko, PlinkoAztec, Jumper или MineSlot).
3. Namespace моста и payload'ов — `Modules.PlinkoAztec`; общие типы (`WebGameStateBase`, `WebBetPayload`,
   `JsonName`, `WebBridgeUtils`) — `WebBridge`.

Что лежит на префабе:

| Компонент | Зачем |
|---|---|
| `PlinkoAztecWebBridge` | Мост режима; секция `Mock` в инспекторе — параметры mock-хоста |
| `AudioWebBridge` | Звуки через хост (`PlaySound_…`) |
| `LayoutWebBridge` | `UiVisibility` и метрики бет-бара; на префабе `Hide Bottom Balance Panel` включён |
| `ScreenOrientationWebBridge` | `ChangeOrientation` |
| `TranslationsWebBridge` | `ApplyTranslations` |
| `WebBridgeUI` | Шторка перехода (`OnTransitionScreen*`) |

Общие компоненты описаны в [справочнике ядра](../../reference/unity-core.md).

## API `PlinkoAztecWebBridge`

`PlinkoAztecWebBridge : WebBridgeBase<PlinkoAztecWebBridge>`. Синглтон — `PlinkoAztecWebBridge.Instance`
(ставится в `Awake`). Общее для всех мостов (`FastGameChanged`, `DisabledPlayPressed`, `RequestPlay()`,
`ApplyWhiteLabel`…) — в [справочнике ядра](../../reference/unity-core.md).

### События (React → игра)

| Событие C# | Тип аргумента | Метод `SendMessage` | Когда срабатывает |
|---|---|---|---|
| `GameConfigReceived` | `WebPlinkoAztecConfigPayload` | `ApplyGameConfig(string)` | Пришёл конфиг: линия ячеек, варианты числа шариков, прогресс бамперов |
| `GameStateReceived` | `WebPlinkoAztecStatePayload` | `ApplyGameState(string)` | Пришло состояние сессии |
| `DropResultReceived` | `WebPlinkoAztecStatePayload` | `ApplyDropResult(string)` | Ответ на бросок (`ApplyDropResult` протокола) |
| `StepResultReceived` | `WebPlinkoAztecStatePayload` | `ApplyStepResult(string)` | Ответ на шаг бонуса (`ApplyBonusStepResult` протокола) |
| `BallsAmountChanged` | `PlinkoAztecBallsAmountChange` | `SetBallsAmount(int)` | Сменилось число шариков следующего броска |
| `BetPerBallChanged` | `PlinkoAztecBetPerBallChange` | `SetBetPerBall(string)` | Сменилась ставка за шар (по сумме: `"2"` после `"2.0"` — не смена) |

Шаг бонуса в протоколе называется `ApplyBonusStepResult`, а в Unity приходит методом `ApplyStepResult`: так его
мапит шелл (`RoadFrontent/src/engine/unity/unityProtocol.ts`). Это одно и то же сообщение.

Все `Apply*` разбирают JSON через `WebBridgeUtils.DeserializePayload`: битый или пустой payload — предупреждение
`[WebBridge] Failed to parse <метод>` в лог, событие **не** поднимается. `SetBallsAmount` с `<= 0` и
`SetBetPerBall`, который не разбирается как неотрицательный десятичный (`NumberStyles.AllowDecimalPoint`,
`InvariantCulture`) или равен `0`, — предупреждение `… ignored`, выбор не меняется. Тот же выбор повторно — без
события.

### Методы (игра → React)

| Метод | Сообщение в React | Когда звать |
|---|---|---|
| `NotifyDropFinished()` | `DropFinished` | Один раз на `DropResultReceived`, когда доиграны шарики, колесо и вся бонусная игра |
| `RequestStep()` | `RequestStep` | Тап в бонусной игре — один на шаг, до `StepResultReceived` |
| `RequestBallsAmount()` | `RequestBallsAmount` | Нужен явный ответ; обычно хватает `CurrentBallsAmount` |
| `RequestBetPerBall()` | `RequestBetPerBall` | То же для ставки; обычно хватает `CurrentBetPerBall` |
| `RequestPlay()` | `RequestPlay` (база) | Тап по полю вне бонуса — то же, что Play бара |
| `RequestGameConfig()` / `RequestGameState()` | `RequestGameConfig` / `RequestGameState` | Разовый запрос; стартовую синхронизацию мост гоняет сам |

Все сообщения уходят строкой без параметров через `SendToReact` (`protocol/src/unityWire.ts`,
`UNITY_PLAIN_MESSAGES`).

Стартовая синхронизация: в WebGL-сборке без mock мост в `Start` ждёт кадр и шлёт `RequestGameConfig` +
`RequestGameState` каждые 0,5 с, до 10 раз, пока не придёт конфиг. В редакторе без mock — не шлёт ничего.

### Свойства

| Свойство | Тип | Что хранит |
|---|---|---|
| `LastGameConfig` | `WebPlinkoAztecConfigPayload` | Последний конфиг |
| `LastGameState` | `WebPlinkoAztecStatePayload` | Последнее состояние; бросок и шаг тоже его обновляют |
| `LastDropResult` | `WebPlinkoAztecStatePayload` | Последний ответ броска |
| `LastStepResult` | `WebPlinkoAztecStatePayload` | Последний ответ шага бонуса |
| `CurrentBallsAmount` | `int` | Число шариков следующего броска; `0`, пока React не прислал выбор |
| `CurrentBetPerBall` | `string` | Ставка за шар следующего броска строкой бэкенда; `null` до первой |

Только для mock-панели: `MockBallsAmountOptions`, `MockBetPerBallOptions`, `IsMockBonusActive`, `MockSessionInfo`,
`PlayMockDrop(PlinkoAztecMockScenario)`, `ResetMockSession()`. Без mock-режима их не трогать: mock-хост не создан,
и `IsMockBonusActive` / `MockSessionInfo` бросят `NullReferenceException`.

## Payload-классы

Все — в `Runtime/WebPlinkoAztecPayloads.cs`, поля размечены `[JsonName]` под имена JSON. Смысл полей — в
[обзоре](README.md#данные).

| Класс | JSON | Поля |
|---|---|---|
| `WebPlinkoAztecConfigPayload` | конфиг (`ApplyGameConfig`) | `BetConfig`, `Positions`, `BallsAmountOptions` (`int[]`), `ShowStartupModal` (`bool?`), `BonusGameProgress` (`Dictionary<string, int>`) |
| `WebPlinkoAztecBetConfigPayload` | `betConfig` | `MinBetAmount`, `MaxBetAmount`, `MaxWinAmount`, `DefaultBetAmount`, `DecimalPlaces`, `Currency` — все `string` |
| `WebPlinkoAztecPositionPayload` | `positions[]` | `Coefficient` (`float?`; `0` — ячейка колеса), `Probability` (`float?`) |
| `WebPlinkoAztecStatePayload : WebGameStateBase` | GameState (`ApplyGameState`, `ApplyDropResult`, `ApplyStepResult`) | База: `Status`, `Bet`, `IsFinished`, `IsWin`, `WinAmount`, `Error`. Свои: `Coeff` (`float?`), `BallsAmount` (`int?`), `BetPerBall`, `BallsResult`, `FreeSpinResult`, `BonusGameState`, `BetAmount`, `Currency` |
| `WebPlinkoAztecBallResult` | `ballsResult[]` | `Position` (`"0.2"`, `"spin"`), `Coeff`, `BonusBumpAmount` (`int?`) |
| `WebPlinkoAztecFreeSpinResult` | `freeSpinResult` | `Position` (`"bonus"` или множитель), `WinAmount`, `Coeff` |
| `WebPlinkoAztecBonusGameState` | `bonusGameState` | `Progress` (`Dictionary<string, int>`, ключи `CUR-balls-betPerBall`), `Result` |
| `WebPlinkoAztecBonusGameResult` | `bonusGameState.result` | `GameNumber`, `Level`, `Progress`, `BallPerDrop`, `BallsAmount` (шагов осталось), `FreeSpinProgress` — `int?`; `WinAmount` — `string` |

Аргументы событий выбора — `readonly struct`, не JSON:

```csharp
public readonly struct PlinkoAztecBallsAmountChange
{
    public int Amount { get; }                                // новое число шариков
    public int PreviousAmount { get; }                        // 0, пока React не прислал первый выбор
    public PlinkoAztecBallsAmountDirection Direction { get; } // None | Increased | Decreased
    public bool IsIncrease { get; }                           // Direction == Increased
    public bool IsDecrease { get; }                           // Direction == Decreased
}

public readonly struct PlinkoAztecBetPerBallChange
{
    public string BetPerBall { get; }                         // строка бэкенда как есть: "0.2"
    public string PreviousBetPerBall { get; }                 // null до первой ставки
    public PlinkoAztecBetPerBallDirection Direction { get; }  // по сумме (decimal), не по тексту
    public bool IsIncrease { get; }
    public bool IsDecrease { get; }
}
```

`Direction == None` у первого значения после загрузки; дальше — `Increased` / `Decreased` по сумме. Повтор того же
значения события не поднимает, поэтому ответ React на `RequestBallsAmount()` без смены выбора события не даст —
значение уже в `CurrentBallsAmount`.

## Полный пример

MonoBehaviour доски: бросок, колесо, бонусная игра по тапам, восстановление бонуса после перезагрузки, выбор
бет-бара. Анимации — заглушки-корутины, на их место встаёт рендер игры.

```csharp
using System.Collections;
using System.Collections.Generic;
using Modules.PlinkoAztec;
using UnityEngine;

public sealed class PlinkoAztecBoard : MonoBehaviour
{
    private const float BallFallSeconds = 1.2f;
    private const float WheelSpinSeconds = 3f;

    // Serialized reference instead of Instance: OnEnable may run before the bridge's Awake.
    [SerializeField] private PlinkoAztecWebBridge _bridge;

    private readonly Queue<IEnumerator> _moves = new Queue<IEnumerator>();
    private bool _isPlaying;
    private bool _isBonusActive;
    private bool _isStepRequested;

    // A drop whose DropFinished has not been sent yet: it waits for the bonus game to end.
    private bool _isDropUnreported;

    private void OnEnable()
    {
        _bridge.GameConfigReceived += OnGameConfig;
        _bridge.GameStateReceived += OnGameState;
        _bridge.DropResultReceived += OnDropResult;
        _bridge.StepResultReceived += OnStepResult;
        _bridge.BallsAmountChanged += OnBallsAmountChanged;
    }

    private void OnDisable()
    {
        _bridge.GameConfigReceived -= OnGameConfig;
        _bridge.GameStateReceived -= OnGameState;
        _bridge.DropResultReceived -= OnDropResult;
        _bridge.StepResultReceived -= OnStepResult;
        _bridge.BallsAmountChanged -= OnBallsAmountChanged;
    }

    // Wire this to the board's tap (EventTrigger, input system, collider click).
    public void OnBoardTapped()
    {
        if (!_isBonusActive)
        {
            _bridge.RequestPlay();
            return;
        }

        if (_isStepRequested)
            return;

        // Set before the call: the mock answers RequestStep synchronously.
        _isStepRequested = true;
        _bridge.RequestStep();
    }

    private void OnGameConfig(WebPlinkoAztecConfigPayload config)
    {
        float[] line = new float[config.Positions.Length];
        for (int i = 0; i < line.Length; i++)
            line[i] = config.Positions[i].Coefficient.Value;

        BuildSlotLine(line);
    }

    // A bonus game the server still runs after a reload: the player steps on through it.
    private void OnGameState(WebPlinkoAztecStatePayload state)
    {
        WebPlinkoAztecBonusGameResult bonus = state.BonusGameState?.Result;
        if (bonus == null || _isBonusActive)
            return;

        EnterBonus(bonus);
    }

    private void OnBallsAmountChanged(PlinkoAztecBallsAmountChange change)
    {
        if (change.IsIncrease)
            AddTrayBalls(change.Amount - change.PreviousAmount);
        else if (change.IsDecrease)
            RemoveTrayBalls(change.PreviousAmount - change.Amount);
        else
            ShowTray(change.Amount);
    }

    private void OnDropResult(WebPlinkoAztecStatePayload result) => Enqueue(PlayDrop(result));

    private void OnStepResult(WebPlinkoAztecStatePayload result) => Enqueue(PlayStep(result));

    private IEnumerator PlayDrop(WebPlinkoAztecStatePayload result)
    {
        _isDropUnreported = true;
        yield return DropBalls(result.BallsResult);

        if (result.FreeSpinResult != null)
            yield return SpinWheel(result.FreeSpinResult);

        Settle(result);
    }

    private IEnumerator PlayStep(WebPlinkoAztecStatePayload result)
    {
        yield return DropBalls(result.BallsResult);
        _isStepRequested = false;
        Settle(result);
    }

    // After a drop or a step: the bonus goes on — wait for a tap; it ended — the drop is played out.
    private void Settle(WebPlinkoAztecStatePayload result)
    {
        WebPlinkoAztecBonusGameResult bonus = result.BonusGameState?.Result;
        if (bonus != null)
        {
            EnterBonus(bonus);
            return;
        }

        _isBonusActive = false;
        HideBonus();

        if (!_isDropUnreported)
            return;

        _isDropUnreported = false;
        _bridge.NotifyDropFinished();
    }

    private void EnterBonus(WebPlinkoAztecBonusGameResult bonus)
    {
        _isBonusActive = true;
        ShowBonus(bonus.Level.Value, bonus.BallsAmount.Value, bonus.WinAmount);
    }

    // Host replies are played strictly one after another: a new one never cuts the previous animation.
    private void Enqueue(IEnumerator move)
    {
        _moves.Enqueue(move);
        if (!_isPlaying)
            StartCoroutine(PlayQueue());
    }

    private IEnumerator PlayQueue()
    {
        _isPlaying = true;
        while (_moves.Count > 0)
            yield return _moves.Dequeue();

        _isPlaying = false;
    }

    // ── Rendering stubs: replace with the board's own presentation. ──

    private IEnumerator DropBalls(WebPlinkoAztecBallResult[] balls)
    {
        // position is the slot's coefficient ("0.2", "1000") or "spin", not an index.
        foreach (WebPlinkoAztecBallResult ball in balls)
            Debug.Log($"[Board] ball -> {ball.Position} (x{ball.Coeff}, bumps {ball.BonusBumpAmount})");

        yield return new WaitForSeconds(BallFallSeconds);
    }

    private IEnumerator SpinWheel(WebPlinkoAztecFreeSpinResult spin)
    {
        Debug.Log($"[Board] wheel stops on {spin.Position}");
        yield return new WaitForSeconds(WheelSpinSeconds);
    }

    private void BuildSlotLine(float[] coefficients) => Debug.Log($"[Board] {coefficients.Length} slots");

    private void ShowTray(int balls) => Debug.Log($"[Board] tray: {balls}");

    private void AddTrayBalls(int balls) => Debug.Log($"[Board] tray +{balls}");

    private void RemoveTrayBalls(int balls) => Debug.Log($"[Board] tray -{balls}");

    private void ShowBonus(int level, int stepsLeft, string winAmount) =>
        Debug.Log($"[Board] bonus level {level}, {stepsLeft} steps left, won {winAmount}");

    private void HideBonus() => Debug.Log("[Board] bonus over");
}
```

Что здесь важно:

- **Подписка в `OnEnable` по ссылке из инспектора.** В mock-режиме мост шлёт выбор, конфиг и состояние прямо в
  своём `Start`: подписка в `Start` доски рискует их пропустить (порядок `Start` между объектами не задан), а
  `Instance` в `OnEnable` может быть ещё `null`. Если подписка всё же поздняя — прочитать `LastGameConfig`,
  `LastGameState`, `CurrentBallsAmount`, `CurrentBetPerBall`.
- **`NotifyDropFinished()` — из одного места** (`Settle`) и только для броска: шаги бонуса и восстановленный после
  перезагрузки бонус его не шлют.
- **`_isStepRequested` ставится до `RequestStep()`.** В mock-режиме ответ приходит синхронно, внутри вызова.
- **Очередь ходов.** Ответ, пришедший во время анимации, ждёт своей очереди.

## Mock-режим в редакторе

В mock-режиме мост полностью заменяет React: C#-класс `PlinkoAztecMockHost` собирает те же JSON, что присылает
платформа, и подаёт их через настоящие точки входа (`ApplyGameConfig`, `ApplyDropResult`…), так что доска идёт
своим обычным путём разбора. Общее о mock — в [концепции](../../concepts/mock-mode.md).

### Как включить

| Пункт меню | Что делает |
|---|---|
| **Tools → WebBridge → Enable Mock** | Mock в Play Mode редактора (`EditorPrefs`, ключ `WebBridge_EnableMock`) |
| **Tools → WebBridge → Enable Mock In Build** | Дефайн `WEBBRIDGE_MOCK`: mock и панель попадают и в WebGL-сборку. В релизную сборку не пускать |

Что происходит в `Start` моста при включённом mock:

1. Создаётся `PlinkoAztecMockHost` с настройками из инспектора, на GameObject моста добавляется панель
   `PlinkoAztecMockDebugIMGUI`.
2. `SetBallsAmount(<первый вариант>)`, `SetBetPerBall(<первый вариант>)` — события выбора с `Direction.None`.
3. `RequestGameConfig()` → `ApplyGameConfig(<mock>)`, `RequestGameState()` → `ApplyGameState(<mock>)`.

Дальше мок отвечает на запросы игры сам:

| Запрос игры | Ответ мока |
|---|---|
| `RequestGameConfig()` | `ApplyGameConfig` — конфиг с текущим прогрессом бамперов |
| `RequestGameState()` | `ApplyGameState` — `status: "none"`, а во время бонуса `"in-game"` с `bonusGameState.result` |
| `RequestStep()` | `ApplyStepResult` синхронно. Вне бонусной игры — `NullReferenceException` (см. частые ошибки) |
| `RequestBallsAmount()` / `RequestBetPerBall()` | `BallsAmountChanged` / `BetPerBallChanged` с текущим значением и `Direction.None` — **даже без смены**, в отличие от боевого пути |
| `RequestWhiteLabel()` | `ApplyWhiteLabel` со значением `Is White Label` из настроек |
| `RequestPlay()` | Ничего: мок его не перехватывает, бросок — кнопкой `DROP` панели |
| `NotifyDropFinished()` | Мок его не слушает. В редакторе — только строка `[Unity -> React] DropFinished` в логе; в WebGL-сборке с `WEBBRIDGE_MOCK` сообщение уходит в React как обычно |

### Панель `PlinkoAztecMockDebugIMGUI`

Кнопка **PLK** в углу экрана открывает панель «Plinko Aztec Mock» — она заменяет бет-бар.

| Элемент | Что делает |
|---|---|
| `Balls` ◀ ▶ | Следующий / предыдущий вариант из `Balls Amount Options` → `SetBallsAmount`. Идёт **по кругу** (у шелла — упор в край) |
| `Bet` ◀ ▶ | То же для `Bet Per Ball Options` → `SetBetPerBall` |
| `Scenario` | Каким будет следующий бросок — пять вариантов ниже |
| `DROP` | `PlayMockDrop(scenario)` → `ApplyDropResult`. Не ждёт `DropFinished` и не блокируется на бонусе — следите сами |
| `STEP` | `RequestStep()` → `ApplyStepResult`. Активна, только пока идёт бонусная игра |
| `RESET` | `ResetMockSession()`: прогресс бамперов и бонус сброшены, конфиг и состояние переотправлены |
| Подпись внизу | `Bonus game: level N, M steps left…` или `No bonus game running…` |

### Сценарии `PlinkoAztecMockScenario`

| Значение | Подпись на панели | Куда падают шарики | Колесо и бонус |
|---|---|---|---|
| `Random` | Random drop | Каждый — в случайную ячейку (равновероятно, включая ячейку колеса) | Шарик в ячейке колеса — колесо на `Fortune Wheel Coefficient`; бонуса не бывает |
| `TopSlots` | All balls → top slot | Все — в ячейку с наибольшим коэффициентом | Нет |
| `BottomSlots` | All balls → bottom slot | Все — в ячейку с наименьшим коэффициентом `> 0` | Нет |
| `FortuneWheel` | Fortune wheel multiplier | Первый — в ячейку колеса (`Spin Slot Index`), остальные случайно | Колесо на множителе, выигрыш × множитель |
| `BonusGame` | Fortune wheel → bonus game | Первый — в ячейку колеса, остальные случайно | Сектор `"bonus"`; бонусная игра: уровень 1, `Bonus Balls Per Step` шариков, `Bonus Steps` шагов |

Как считается ответ (так же, как в JS-моке `PlinkoAztecMockSession`):

- у каждого шарика три шанса задеть бампер с вероятностью `Bumper Chance`; бамперы броска прибавляются к
  счётчику комбинации `CUR-balls-betPerBall` и видны в `bonusGameState.progress` и `bonusGameProgress` конфига;
- выигрыш — сумма коэффициентов шариков × ставка за шар, с колесом — ещё × множитель; `coeff` — сумма без колеса;
- шаг бонуса — `ballPerDrop` случайных шариков, выигрыш копится в `result.winAmount`, каждые
  `Bonus Level Threshold` бамперов — уровень +1 и шарик за шаг +1; на последнем шаге `result` пропадает,
  `status: "win"`;
- суммы — `float` и `F<decimalPlaces>`: иллюстративные, не источник истины.

### Настройки — секция `Mock` инспектора моста

Класс `PlinkoAztecMockSettings`, сериализуется на `PlinkoAztecWebBridge`: у каждой сцены своя доска без правки
кода. Префаб хранит значения по умолчанию.

| Поле | По умолчанию | Что задаёт |
|---|---|---|
| `Slot Coefficients` | `1000, 130, 26, 9, 4, 2, 0.2, 0, 0.2, 2, 4, 9, 26, 130, 1000` | Линия ячеек слева направо; `0` — ячейка колеса. Первая такая — `Spin Slot Index` для `FortuneWheel` / `BonusGame` |
| `Balls Amount Options` | `10, 20, 50` | Варианты числа шариков; первый — выбор на старте |
| `Bet Per Ball Options` | `"1", "2", "5", "10"` | Варианты ставки за шар строками бэкенда; первый — выбор на старте (у шелла — `"0.2", "0.4", "1", "2"`) |
| `Currency` | `USD` | Валюта ответов и ключей прогресса |
| `Decimal Places` | `2` | Знаков в суммах |
| `Bumper Chance` | `0.25` (0–1) | Шанс бампера на каждом из трёх шансов шарика |
| `Bonus Level Threshold` | `5` | Бамперов на уровень бонусной игры |
| `Bonus Steps` | `5` | Шагов в бонусной игре |
| `Bonus Balls Per Step` | `3` | Шариков за шаг на первом уровне |
| `Fortune Wheel Coefficient` | `2` | Множитель колеса вне бонус-сектора |
| `Is White Label` | выкл. | Ответ на `RequestWhiteLabel` |

### Чем Unity-мок отличается от JS-мока

| | Unity `PlinkoAztecMockHost` | JS `PlinkoAztecMockHost` |
|---|---|---|
| Блокировка броска до `DropFinished` и на бонусе | Нет | Есть, как у шелла |
| `RequestPlay` | Не отвечает | Бросок или `DisabledPlayPressed` |
| `RequestStep` вне бонуса | `NullReferenceException` | Игнорирует |
| Ответ на `RequestBallsAmount` / `RequestBetPerBall` | Событие с `None` даже без смены | Команда `Set*`; мост без смены молчит |
| Переключатели выбора | По кругу | Упор в край |
| `betPerBall` в GameState | Отформатирован (`"1.00"`), ключ прогресса — `"USD-10-1"` | Строка варианта как есть (`"1"`) |
| Случайность | `System.Random`, без сида | `random` подменяется в опциях |

## Сборка WebGL и проверка

1. **Mock выключен в сборке.** Перед боевой сборкой снять **Enable Mock In Build** (`WEBBRIDGE_MOCK` не должен
   остаться в Scripting Define Symbols). С ним мост отвечает на свои запросы (конфиг, состояние, шаг бонуса,
   выбор бара) из мока, а команды хоста продолжает принимать: сцена получает данные из двух источников, шаг
   бонуса уходит в мок вместо сервера, и на экране висит панель PLK.
2. **Объект называется `WebBridge`** и он один на сцене.
3. **Логи моста.** В сборке они выключены; включаются командой `SetLoggingEnabled(1)` (чит-панель шелла). С ними
   видно `[BridgeDebug][React->Unity] ApplyDropResult raw: …`, `BallsAmount: 10 -> 20`, `[Unity -> React] …`.
4. **Шелл локально и стенд.** Прогнать сборку в шелле (`?localBuild=…`, см.
   [старт на Unity](../../guides/getting-started-unity.md)) и на стенде конфигуратора с игрой категории
   `plinko-aztec`. Проверить: бар оживает только после `DropFinished`; во время бонусной игры бар заблокирован;
   перезагрузка посреди бонуса возвращает сцену в бонус; смена числа шариков в баре меняет лоток.
5. **IL2CPP stripping.** Мост и payload'ы помечены `[Preserve]`, а пакет несёт `link.xml` — свои payload-классы,
   если они разбираются через `Json`, тоже пометить `[Preserve]`.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Бар не разблокируется после броска | Нет `NotifyDropFinished()`, или payload не разобрался (`Failed to parse ApplyDropResult` в логе) и событие не пришло | Звать из одного места после всей анимации; смотреть лог моста |
| Бар оживает посреди бонусной игры | `NotifyDropFinished()` ушёл после шариков броска, до бонуса | Слать, только когда `BonusGameState.Result == null` |
| Два шага бонуса на один тап | Повторный `RequestStep()` до `StepResultReceived` | Флаг «шаг запрошен», снимать по результату |
| Бонус залип после ошибки сервера на `step` | Хост показал тост и ничего не прислал | Дать игроку повторить тап (снять флаг по таймауту ожидания) |
| `NullReferenceException` в `PlinkoAztecMockHost.BuildStepResult` | `RequestStep()` в mock-режиме вне бонусной игры | Звать `RequestStep()` только при `BonusGameState.Result != null` |
| Лоток пустой после старта в редакторе | Подписка в `Start` доски пропустила `BallsAmountChanged` из `Start` моста | Подписка в `OnEnable` или чтение `CurrentBallsAmount` |
| `SetBetPerBall ignored: 0,2` | Ставка с запятой или знаком — так хост её не шлёт | Ничего: это ошибка источника, не моста |
| Шарики падают не в те ячейки | `Position` прочитан как индекс | Искать ячейку по коэффициенту; `"spin"` — ячейка колеса |
| В сборке висит панель PLK, хост не отвечает | Остался дефайн `WEBBRIDGE_MOCK` | Снять **Enable Mock In Build** и пересобрать |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `unity/Assets/WebBridge/Runtime/PlinkoAztecWebBridge.cs`, `WebPlinkoAztecPayloads.cs`,
  `PlinkoAztecMockHost.cs`, `PlinkoAztecMockScenario.cs`, `PlinkoAztecMockSettings.cs`,
  `PlinkoAztecMockDebugIMGUI.cs`, `Prefabs/PlinkoAztecWebBridge.prefab`, `Editor/WebBridgeMenuItems.cs`
