# Jumper — Unity

> Как подключить режим jumper к игре на Unity (WebGL). Контракт режима — что значат команды и события и в каком
> порядке они идут — описан в [обзоре](README.md).

## Коротко

```csharp
using Modules.Jumper;
using Modules.Road;
using UnityEngine;

public class JumperRoundListener : MonoBehaviour
{
    private void Start()
    {
        JumperWebBridge.Instance.MoveReceived += OnMoveReceived;
        JumperWebBridge.Instance.RestartRequested += OnRestartRequested;
    }

    private void OnDestroy()
    {
        if (JumperWebBridge.Instance == null)
            return;

        JumperWebBridge.Instance.MoveReceived -= OnMoveReceived;
        JumperWebBridge.Instance.RestartRequested -= OnRestartRequested;
    }

    private void OnMoveReceived(WebJumperMovePayload move)
    {
        if (move.Move != JumperMove.Step)
            return; // Play and Payout get no SpinReady

        // Play the jump (LineNumber -> VisitedSteps -> LandingStep, the fall on Lose), then:
        JumperWebBridge.Instance.NotifySpinReady();
    }

    private void OnRestartRequested(RestartReason reason, string amount)
    {
        // Reset the scene, then:
        JumperWebBridge.Instance.NotifySpinReady(); // React keeps the bet bar locked until this
    }
}
```

Два обязательных ответа: `NotifySpinReady()` после каждого доигранного прыжка и после сброса сцены на
`RestartRound`. Без них бет-бар хоста не разблокируется. В настоящей игре `NotifySpinReady()` зовут в конце
анимации, а не в обработчике (см. «Полный пример»).

## Подключение

1. Пакет `com.pixi.webbridge` (сборка `WebBridge.Runtime`). Как поставить пакет и собрать WebGL, описано в
   [старте на Unity](../../guides/getting-started-unity.md).
2. Добавить мост на сцену: **GameObject → WebBridge → Create JumperWebBridge**. Пункт меню ставит префаб
   `Runtime/Prefabs/JumperWebBridge.prefab` и называет объект `WebBridge`. Под этим именем React адресует его
   через `SendMessage("WebBridge", <метод>, <параметр>)`, имя класса роли не играет. Мост на сцене один: второй
   пункт меню создать не даст, а второй экземпляр уничтожит себя в `Awake`.
3. На префабе, кроме `JumperWebBridge`, стоят общие компоненты: `LayoutWebBridge` (видимость и метрики бет-бара,
   ответ на `SyncUiVisibility`), `ScreenOrientationWebBridge`, `TranslationsWebBridge`, `AudioWebBridge`,
   `WebBridgeUI` (окна результата, шторка перехода). Их API — в [ядре Unity-моста](../../reference/unity-core.md).
4. Код игры: `using Modules.Jumper;` (мост, payload'ы, enum'ы) и `using Modules.Road;` (`RestartReason` в
   `RestartRequested`). Мост — `JumperWebBridge.Instance`, его выставляет `Awake` моста.

Как устроен старт. В WebGL-сборке мост на `Start` просит `RequestGameConfig` и `RequestGameState`: 10 попыток раз в
0,5 с, пока не придёт конфиг. В редакторе без mock-режима запросов нет. `LayoutWebBridge` на своём `Start` шлёт
первый `UiVisibility`, и до него хост ничего не синхронизирует.

## API `JumperWebBridge`

`public class JumperWebBridge : WebBridgeBase<JumperWebBridge>`, namespace `Modules.Jumper`, исходник —
`Runtime/JumperWebBridge.cs`.

### События (React → игра)

| Событие C# | Тип аргумента | Метод `SendMessage` | Когда срабатывает |
|---|---|---|---|
| `GameConfigReceived` | `WebJumperGameConfigPayload` | `ApplyGameConfig(string json)` | Пришли лесенки всех сложностей |
| `DifficultyChanged` | `JumperDifficultyChange` | `SetJumperDifficulty(string name)` | Сложность **сменилась**. `Previous` — `null` у первой после загрузки. Та же сложность повторно событие не поднимает. Имя не из `EASY`/`MEDIUM`/`HARD` (регистр важен) — предупреждение в лог, команда игнорируется |
| `GameStateReceived` | `WebJumperRoundStatePayload` | `ApplyGameState(string json)` | «Приведи сцену к этому раунду»: старт, ресинк. `Status == None` — раунда нет |
| `MoveReceived` | `WebJumperMovePayload` | `ApplyJumperMove(string json)` | Живой ход: `Play`, `Step` или `Payout` |
| `AutoplayChanged` | `bool` | `SetAutoplay(int)` (`1`/`0`) | Автоплей **сменился**. Повтор того же значения событие не поднимает |
| `RestartRequested` | `RestartReason, string` | `RestartRound(string)` | Перезапуск после закрытого раунда. `"cashout\|$2.47"` → `(Cashout, "$2.47")`, `"lose\|"` → `(Lose, "")`. Причина читается без учёта регистра, неизвестная — `None`; пустой payload — `(None, null)` |
| `BonusStartRequested` | `WebJumperStartBonusPayload` | `StartBonus(string json)` | Купленная или возобновлённая серия фри-геймов |

События базы `WebBridgeBase<T>`:

| Событие C# | Метод `SendMessage` | Особенность jumper |
|---|---|---|
| `CashoutPressed` | `OnCashoutPressed()` | Приходит после выплаты, перед `ApplyJumperMove` `Payout`. Это момент убрать с игрока коэффициент живого раунда |
| `DisabledPlayPressed` | `OnDisabledPlayPressed()` | Отказ на `RequestPlay`: прыжок летит, сцена сбрасывается, идёт бонус или автоплей |
| `WhiteLabelReceived`, `FastGameChanged`, `WinWindowSignalReceived` | `ApplyWhiteLabel(int)`, `SetFastGame(int)`, `OnWinWindowSignal(string)` | Как во всех режимах — [ядро](../../reference/unity-core.md) |

### Методы (игра → React)

| Метод | Сообщение в React | Когда звать |
|---|---|---|
| `NotifySpinReady()` | `SpinReady` | Прыжок `Step` доигран (приземление или падение). И сцена сброшена после `RestartRound`. В mock-режиме ещё и сообщает mock-хосту |
| `NotifyBonusActive()` | `BonusActive` | Серия начала играть |
| `SaveBonusProgress(int completed, int total)` | `BonusProgressSave_{"completedIterations":…,"totalIterations":…}` | После каждого фри-гейма. Счёт — по `Games` текущего `StartBonus`, от 1 |
| `NotifyBonusEnded()` | `BonusEnded` | Последний фри-гейм доигран |
| `RequestPlay()` (база) | `RequestPlay` | Тап по сцене или своя кнопка игры. Ответ — `ApplyJumperMove` или `OnDisabledPlayPressed()` |
| `RequestGameConfig()` / `RequestGameState()` | `RequestGameConfig` / `RequestGameState` | Переспросить вручную. Стартовую синхронизацию мост делает сам |
| `RequestWhiteLabel()`, `RequestFastGame()`, `NotifyFastGameChanged(bool)` (база) | `RequestWhiteLabel`, `RequestFastGame`, `FastGame_1` / `FastGame_0` | Как во всех режимах |

В mock-режиме `RequestGameConfig`, `RequestGameState`, `RequestWhiteLabel` и `RequestPlay` отвечает
`JumperMockHost`, в React ничего не уходит.

### Свойства

Значения хранятся в мосте, поэтому подписчик, поднятый позже, их не теряет.

| Свойство | Тип | Что хранит |
|---|---|---|
| `LastGameConfig` | `WebJumperGameConfigPayload` | Последний конфиг |
| `LastGameState` | `WebJumperRoundStatePayload` | Последний раунд: из `ApplyGameState` или из последнего хода |
| `LastMove` | `WebJumperMovePayload` | Последний ход |
| `LastBonusStart` | `WebJumperStartBonusPayload` | Последняя серия |
| `CurrentDifficulty` | `JumperDifficulty?` | Сложность. `null`, пока React её не прислал |
| `IsAutoplayEnabled` | `bool` | Идёт ли автоплей |
| `MockHost` | `JumperMockHost` | Заглушка React и сервера в mock-режиме. `null` вне его |
| `CurrentIsWhiteLabel`, `IsFastGameEnabled` (база) | `bool?`, `bool` | Как во всех режимах |

## Payload-классы

Файлы `Runtime/WebJumperPayloads.cs` и `Runtime/WebJumperBonusPayloads.cs`. Классы — `[Serializable]` с
`[Preserve]`, поля сопоставлены JSON атрибутом `[JsonName]`. Деньги и коэффициенты — строки (`"2.47"`). Чтобы
посчитать, разбирать их в `decimal` с `CultureInfo.InvariantCulture`: на устройстве с запятой в локали
`float.Parse("2.47")` падает. Перечисления на проводе — имена бэкенда. Строковое поле `…Name` хранит проводную
форму, а одноимённое свойство разбирает её через `JumperWireNames` и бросает `FormatException` на имени, которого
нет в протоколе.

**`WebJumperGameConfigPayload`** — `ApplyGameConfig`:

| Поле / член | JSON | Тип | Смысл |
|---|---|---|---|
| `Ladders` | `ladders` | `WebJumperLadderPayload[]` | По лесенке на сложность |
| `GetLadder(difficulty)` | — | `WebJumperLadderPayload` | Лесенка сложности. Если её нет — `InvalidOperationException` |

**`WebJumperLadderPayload`**:

| Поле / член | JSON | Тип | Смысл |
|---|---|---|---|
| `DifficultyName` / `Difficulty` | `difficulty` | `string` / `JumperDifficulty` | Сложность лесенки |
| `Coefficients` | `coefficients` | `string[]` | Коэффициент ступени по её индексу |
| `Accelerators` | `accelerators` | `WebJumperAcceleratorDistancePayload[]` | `AcceleratorName`/`Accelerator` + `Steps`: на сколько ступеней бросает |
| `BonusBuyMultiplier` | `bonusBuyMultiplier` | `float` | Цена бонуса в ставках |
| `GetDistance(accelerator)` | — | `int` | Дальность ускорителя. Если её нет — `InvalidOperationException` |

**`WebJumperRoundStatePayload`** — `ApplyGameState`; **`WebJumperMovePayload`** — `ApplyJumperMove`, наследник с
полем `move`:

| Поле / член | JSON | Тип | Смысл |
|---|---|---|---|
| `StartStep` | — | `const int = -1` | Где игрок стоит до первого прыжка |
| `StatusName` / `Status` | `status` | `string` / `JumperRoundStatus` | `none` / `in-game` / `win` / `lose` |
| `DifficultyName` / `Difficulty` | `difficulty` | `string` / `JumperDifficulty` | Сложность раунда |
| `Coeff` | `coeff` | `string` | Коэффициент `LandingStep`. `"0"` до первого прыжка и после падения |
| `WinAmount` | `winAmount` | `string` | Выигрыш |
| `Slots` | `slots` | `WebJumperSlotPayload[]` | `Step` + `StateName`/`State`: все слоты раунда по возрастанию ступени |
| `LineNumber` | `lineNumber` | `int` | Куда целился прыжок. `StartStep` до первого |
| `LandingStep` | `landingStep` | `int` | Конец цепочки. У проигрыша — цель цепочки, а не позиция игрока |
| `VisitedSteps` | `visitedSteps` | `WebJumperVisitedStepPayload[]` | `Step` + `AcceleratorName`/`Accelerator`: сработавшие ускорители по порядку |
| `CollisionPosition` | `collisionPosition` | `int?` | Только у закрытого раунда: ступень падения, после кэшаута — где упал бы |
| `HasJumped` | — | `bool` | `LandingStep != StartStep` |
| `IsClosed` | — | `bool` | `Status` — `Win` или `Lose` |
| `MoveName` / `Move` | `move` | `string` / `JumperMove` | Только у хода: `play` / `step` / `payout` |

**`WebJumperStartBonusPayload`** — `StartBonus`:

| Поле / член | JSON | Тип | Смысл |
|---|---|---|---|
| `DifficultyName` / `Difficulty` | `difficulty` | `string` / `JumperDifficulty` | Сложность серии |
| `BetAmount` | `betAmount` | `string` | Ставка одного фри-гейма: цена, делённая на множитель |
| `Currency` | `currency` | `string` | Валюта. Демо-валюта приходит как `"D"` |
| `DisplayBet` | `displayBet` | `string` | Ставка в валюте показа (`"$0.05"`). Пусто или нет — показывать `BetAmount` |
| `Games` | `games` | `WebJumperBonusGamePayload[]` | `FinalStep`, `Coefficient`, `Route` каждого фри-гейма |
| `TotalCoefficient` | `totalCoefficient` | `string` | Сумма коэффициентов фри-геймов |
| `TotalWin` | `totalWin` | `string` | Выигрыш всей серии, уже выплачен |

`WebJumperRoutePointPayload` — `Step` + `ActionName`/`Action` (`JumperRouteAction`): площадка, **с которой**
прыгали. Маршрут начинается со ступени 0, последний прыжок приземляется на `FinalStep`, своей точки у него нет.
`WebJumperBonusProgressPayload` (`CompletedIterations`, `TotalIterations`) собирает `SaveBonusProgress` сам.

**Перечисления** — `Runtime/JumperEnums.cs`. Числовые значения — внутренние для моста и по проводу не ходят.

| Enum | Значения | Имена на проводе (`JumperWireNames`) |
|---|---|---|
| `JumperDifficulty` | `Easy`, `Medium`, `Hard` | `EASY`, `MEDIUM`, `HARD` |
| `JumperAccelerator` | `Trampoline`, `Jetpack`, `Rocket` | `TRAMPOLINE`, `JETPACK`, `ROCKET` |
| `JumperSlotState` | `Hidden`, `None`, `Trampoline`, `Jetpack`, `Rocket` | `HIDDEN`, `NONE`, … |
| `JumperRoundStatus` | `None`, `InGame`, `Win`, `Lose` | `none`, `in-game`, `win`, `lose` |
| `JumperMove` | `Play`, `Step`, `Payout` | `play`, `step`, `payout` |
| `JumperRouteAction` | `Step`, `Trampoline`, `Jetpack`, `Rocket` | `STEP`, `TRAMPOLINE`, … |

`JumperWireNames.<Map>.TryParse(name, out value)` / `Parse(name)` (`FormatException`) /
`ToWireName(value)` (`ArgumentOutOfRangeException`). Сопоставление точное: `"easy"`, `"Easy"` и `"0"` не
проходят, в отличие от `Enum.TryParse`.

## Полный пример

MonoBehaviour игры: очередь ходов, прыжок по цепочке, падение, перезапуск, бонус и восстановление. Движения — это
простой `Lerp` позиции игрока. В настоящей игре вместо него будут свои анимации, а места подписки и ответов
останутся теми же.

```csharp
using System;
using System.Collections;
using System.Collections.Generic;
using Modules.Jumper;
using Modules.Road;
using UnityEngine;

/// <summary>
/// Plays the jumper round the host describes. Moves run one after another, so a restart that arrives while a jump
/// still lands waits for it instead of tearing the scene from under it.
/// </summary>
public class JumperGameView : MonoBehaviour
{
    private const int StartStep = WebJumperRoundStatePayload.StartStep;

    [SerializeField] private Transform _player;
    [SerializeField] private float _stepHeight = 1.2f;
    [SerializeField] private float _hopSeconds = 0.25f;
    [SerializeField] private float _fallSeconds = 0.4f;

    private readonly Queue<IEnumerator> _moves = new Queue<IEnumerator>();
    private JumperWebBridge _bridge;
    private bool _isRunning;

    private void Start()
    {
        _bridge = JumperWebBridge.Instance;
        _bridge.GameConfigReceived += OnGameConfigReceived;
        _bridge.DifficultyChanged += OnDifficultyChanged;
        _bridge.GameStateReceived += OnGameStateReceived;
        _bridge.MoveReceived += OnMoveReceived;
        _bridge.RestartRequested += OnRestartRequested;
        _bridge.BonusStartRequested += OnBonusStartRequested;
        _bridge.DisabledPlayPressed += OnDisabledPlayPressed;

        // The bridge may have started first (in mock mode it syncs in its own Start): catch up on what it kept.
        ShowLadder();
        if (_bridge.LastGameState != null)
            OnGameStateReceived(_bridge.LastGameState);
    }

    private void OnDestroy()
    {
        if (_bridge == null)
            return;

        _bridge.GameConfigReceived -= OnGameConfigReceived;
        _bridge.DifficultyChanged -= OnDifficultyChanged;
        _bridge.GameStateReceived -= OnGameStateReceived;
        _bridge.MoveReceived -= OnMoveReceived;
        _bridge.RestartRequested -= OnRestartRequested;
        _bridge.BonusStartRequested -= OnBonusStartRequested;
        _bridge.DisabledPlayPressed -= OnDisabledPlayPressed;
    }

    // Wire to the scene's own tap or button: the host answers with a move or with DisabledPlayPressed.
    public void OnSceneTapped() => _bridge.RequestPlay();

    private void OnGameConfigReceived(WebJumperGameConfigPayload config) => ShowLadder();

    private void OnDifficultyChanged(JumperDifficultyChange change) => ShowLadder();

    private void OnGameStateReceived(WebJumperRoundStatePayload state) =>
        Enqueue(ShowRound(state, StandingStepOf(state)));

    private void OnMoveReceived(WebJumperMovePayload move)
    {
        switch (move.Move)
        {
            case JumperMove.Play:
                // The round is open, every slot Hidden, the player below step 0. No SpinReady: the first jump follows.
                Enqueue(ShowRound(move, StartStep));
                break;
            case JumperMove.Step:
                Enqueue(PlayJump(move));
                break;
            case JumperMove.Payout:
                // Cashed out: CollisionPosition is where the player would have fallen. Wait for RestartRound.
                Enqueue(ShowRound(move, move.LandingStep));
                break;
        }
    }

    private void OnRestartRequested(RestartReason reason, string amount) => Enqueue(Restart(reason, amount));

    private void OnBonusStartRequested(WebJumperStartBonusPayload bonus) => Enqueue(PlayBonus(bonus));

    private void OnDisabledPlayPressed()
    {
        // The bar refused the move (a jump in flight, a restart, a bonus, autoplay): shake the player, show why.
    }

    // The host sends the ladders before the difficulty, the mock host after it: build once both are known.
    private void ShowLadder()
    {
        if (_bridge.LastGameConfig == null || !_bridge.CurrentDifficulty.HasValue)
            return;

        WebJumperLadderPayload ladder = _bridge.LastGameConfig.GetLadder(_bridge.CurrentDifficulty.Value);
        BuildPlatforms(ladder.Coefficients);
    }

    private void BuildPlatforms(string[] coefficients)
    {
        // One platform per step; coefficients[i] labels step i, as the server's decimal string.
    }

    private IEnumerator PlayJump(WebJumperMovePayload move)
    {
        foreach (int step in JumpWaypoints(move))
            yield return MoveTo(PositionOf(step), _hopSeconds);

        if (move.Status == JumperRoundStatus.Lose)
            yield return MoveTo(_player.localPosition + Vector3.down * (_stepHeight * 3f), _fallSeconds);

        // The coefficient and the win show only now: the host reveals them on SpinReady too.
        ShowSlots(move.Slots);
        _bridge.NotifySpinReady();
    }

    // amount is the host's display string ("$2.47"), empty after a fall: show it as is.
    private IEnumerator Restart(RestartReason reason, string amount)
    {
        Debug.Log($"[Jumper] Round over: {reason} {amount}");
        ShowSlots(Array.Empty<WebJumperSlotPayload>());
        _player.localPosition = PositionOf(StartStep);
        _bridge.NotifySpinReady();
        yield break;
    }

    private IEnumerator PlayBonus(WebJumperStartBonusPayload bonus)
    {
        _bridge.NotifyBonusActive();
        for (int i = 0; i < bonus.Games.Length; i++)
        {
            WebJumperBonusGamePayload game = bonus.Games[i];
            _player.localPosition = PositionOf(StartStep);
            foreach (WebJumperRoutePointPayload point in game.Route)
                yield return MoveTo(PositionOf(point.Step), _hopSeconds);

            yield return MoveTo(PositionOf(game.FinalStep), _hopSeconds);
            _bridge.SaveBonusProgress(i + 1, bonus.Games.Length);
        }

        _bridge.NotifyBonusEnded();
    }

    private IEnumerator ShowRound(WebJumperRoundStatePayload round, int standingStep)
    {
        ShowSlots(round.Slots);
        _player.localPosition = PositionOf(standingStep);
        yield break;
    }

    private void ShowSlots(WebJumperSlotPayload[] slots)
    {
        foreach (WebJumperSlotPayload slot in slots)
        {
            // slot.State: Hidden until reached, then Trampoline / Jetpack / Rocket, or None for an empty slot.
        }
    }

    private static int StandingStepOf(WebJumperRoundStatePayload state)
    {
        if (state.Status == JumperRoundStatus.None)
            return StartStep;

        if (state.Status == JumperRoundStatus.Lose && state.CollisionPosition.HasValue)
            return state.CollisionPosition.Value;

        return state.LandingStep;
    }

    // A lost round's LandingStep is where the chain aimed, not where the player is: the path stops at the fall.
    private static List<int> JumpWaypoints(WebJumperRoundStatePayload move)
    {
        List<int> path = new List<int> { move.LineNumber };
        foreach (WebJumperVisitedStepPayload visited in move.VisitedSteps)
            AddStep(path, visited.Step);

        AddStep(path, move.LandingStep);
        if (move.Status != JumperRoundStatus.Lose || !move.CollisionPosition.HasValue)
            return path;

        int fall = move.CollisionPosition.Value;
        path.RemoveAll(step => step >= fall);
        path.Add(fall);
        return path;
    }

    private static void AddStep(List<int> path, int step)
    {
        if (path[path.Count - 1] != step)
            path.Add(step);
    }

    private void Enqueue(IEnumerator move)
    {
        _moves.Enqueue(move);
        if (_isRunning)
            return;

        _isRunning = true;
        StartCoroutine(RunMoves());
    }

    private IEnumerator RunMoves()
    {
        while (_moves.Count > 0)
            yield return StartCoroutine(_moves.Dequeue());

        _isRunning = false;
    }

    private IEnumerator MoveTo(Vector3 target, float seconds)
    {
        Vector3 start = _player.localPosition;
        for (float elapsed = 0f; elapsed < seconds; elapsed += Time.deltaTime)
        {
            _player.localPosition = Vector3.Lerp(start, target, elapsed / seconds);
            yield return null;
        }

        _player.localPosition = target;
    }

    private Vector3 PositionOf(int step) => new Vector3(0f, (step + 1) * _stepHeight, 0f);
}
```

Почему так:

- **Подписка в `Start` и догоняющее чтение.** Порядок `Start` разных объектов не определён. В mock-режиме мост на
  своём `Start` сразу прогоняет синхронизацию, и подписчик, поднятый позже, её пропустит. Поэтому после подписки
  нужно прочитать `LastGameConfig`, `CurrentDifficulty` и `LastGameState`.
- **Очередь.** `Play` и первый `Step` приходят подряд, а mock-хост на `NotifySpinReady()` закрытого раунда
  синхронно шлёт `RestartRound`. Флаг `_isRunning` ставится до `StartCoroutine`, поэтому вторая очередь не
  стартует, даже если новый ход пришёл синхронно изнутри первого.
- **`NotifySpinReady()` — последней строкой хода.** Хост раскрывает результат и снимает лок по этому сигналу.
  Раньше конца анимации его слать нельзя.

## Mock-режим в редакторе

В mock-режиме мост сам создаёт `JumperMockHost` (заглушку React и сервера) и панель `JumperMockDebugIMGUI`.
Хост говорит с мостом только через его React-методы и тем же JSON, что шлёт React, поэтому игра идёт по настоящему
пути разбора и проигрывания. Общий принцип — в [mock-режиме](../../concepts/mock-mode.md).

| Как включить | Где действует |
|---|---|
| **Tools → WebBridge → Enable Mock** (EditorPrefs `WebBridge_EnableMock`) | Play Mode в редакторе |
| **Tools → WebBridge → Enable Mock In Build** (define `WEBBRIDGE_MOCK`) | Ещё и в сборке. Сборка с этим define отвечает себе сама и игнорирует шелл, поэтому перед сборкой для стенда его нужно снять |

Окно **Tools → WebBridge → MockConfig** jumper не настраивает. Параметры — секция **Mock** в инспекторе
`JumperWebBridge` (`JumperMockSettings`, сериализуется на мосте, у каждой сцены свои):

| Поле | По умолчанию | Что задаёт |
|---|---|---|
| `Ladders` | лесенки dev-бэка (`JumperDevLadders`): EASY 40, MEDIUM 38, HARD 35 ступеней, бонус 100 ставок | `JumperMockLadder`: сложность, коэффициенты строками, цена бонуса |
| `Default Difficulty` | `Easy` | Сложность после старта |
| `Trampoline / Jetpack / Rocket Steps` | `2` / `4` / `8` | Дальности ускорителей (одни на все сложности) |
| `Slot Chance` | `0.3` | Доля ступеней со слотом (верхняя ступень слота не получает) |
| `Empty Slot Chance` | `0.3` | Доля пустых слотов (`NONE`) |
| `Lose Chance` | `0.15` | Шанс упасть там, куда пришёлся прыжок |
| `Bet Amount` / `Currency` / `Decimal Places` | `"1"` / `"USD"` / `2` | Ставка и формат сумм |
| `Bonus Games` | `3` | Фри-геймов в серии |
| `Is White Label` | `false` | Ответ на `RequestWhiteLabel` |

Панель — перетаскиваемая кнопка **JMP**, по нажатию раскрывается «Jumper Mock»:

| Элемент | Доступен | Что делает |
|---|---|---|
| Difficulty ◀ ▶ | Между раундами | `SetJumperDifficulty` соседней сложности |
| BET | Между раундами, после сброса сцены | `ApplyJumperMove` `play`, сразу за ним первый `step` |
| JUMP | Живой раунд, прыжок доигран | `step` на `landingStep + 1` |
| CASHOUT | То же, что JUMP | `OnCashoutPressed()` → `payout` → сразу `RestartRound "cashout\|…"` (окна в моке нет) |
| BONUS | Между раундами | `StartBonus` с серией |
| AUTO ON / OFF | Всегда | `SetAutoplay(1/0)`. Ходы mock сам не делает |
| RESET | Всегда | Забыть раунд без перезапуска, как при перезагрузке, и прислать `ApplyGameState` |

Строка под кнопками показывает, чего mock ждёт, например `Jump in flight: waiting for NotifySpinReady.`
`RequestPlay()` из сцены mock обрабатывает как бет-бар: без раунда — ставка, в живом раунде — прыжок, а пока бар
залочен — `OnDisabledPlayPressed()`. Закрытый прыжком раунд mock перезапускает после `NotifySpinReady()`
(`RestartRound "lose|"` или `"win|…"`) и снова ждёт `NotifySpinReady()`.

Чем mock отличается от настоящего хоста:

| Mock | Шелл |
|---|---|
| Старт: сложность → конфиг → состояние | Конфиг → сложность → состояние, после первого `UiVisibility` |
| Суммы `"1.00"`, коэффициенты `"2.70"`, `RestartRound "win\|1.04 USD"` | Канонические строки (`"2.7"`), `RestartRound "win\|$1.04"` |
| Падение всегда на `LandingStep` | Падение бывает посреди цепочки: `LandingStep` 12, `CollisionPosition` 10 |
| Ни окон выигрыша, ни шторки перехода; бонус-события не слушает, BONUS доступен и во время серии | Окна, `TransitionScreen*` вокруг серии; бар залочен до конца серии |

## Сборка WebGL и проверка

1. **Mock в редакторе.** Ставка, прыжки с цепочками, падение, кэшаут, бонус, смена сложности, RESET посреди
   раунда. После каждого прыжка и сброса JUMP или BET снова доступны. Если подсказка застряла на `waiting for
   NotifySpinReady`, значит событие не ушло.
2. **Перед сборкой** снять **Enable Mock In Build** (`WEBBRIDGE_MOCK`). Проверить, что на сцене ровно один мост и
   объект называется `WebBridge`.
3. **Stripping.** Мост и payload'ы помечены `[Preserve]`. Свои классы, которые нужны только через рефлексию, тоже
   помечать: иначе IL2CPP вырежет их из сборки.
4. **Шелл.** Сборку загрузить в игру конфигуратора с GameMode `jumper` и открыть стенд. Шелл получает
   `gameMode=jumper&gameCategory=jumper` из конфигуратора. Подробности — в
   [старте на Unity](../../guides/getting-started-unity.md).
5. **Логи.** Шелл включает их командой `SetLoggingEnabled`. Входящие команды мост пишет как
   `[BridgeDebug][React->Unity] ApplyJumperMove raw: …`, исходящие — как `[Unity -> React] SpinReady`. В консоли
   шелла `[jumper] The engine sent an event jumper does not handle` значит, что ушло событие чужого режима.
6. **На стенде проверить** перезагрузку посреди раунда (игрок встаёт на `LandingStep`) и посреди серии (приходит
   `StartBonus` только с оставшимися фри-геймами, счётчик снова от 1).

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| После первого прыжка бар не разблокируется | `NotifySpinReady()` не вызван на `Step`, или вызван на `Play`, а на `Step` пропущен | Слать `SpinReady` только на `Step` и на `RestartRequested`, в конце анимации |
| После падения или кэшаута новая ставка не проходит | Нет `NotifySpinReady()` после сброса сцены | В `RestartRequested` сбросить сцену и ответить `NotifySpinReady()` |
| Игрок долетает до конца цепочки и «падает» назад | Падение строится по `LandingStep` | У `Lose` обрезать путь на `CollisionPosition` (`JumpWaypoints` выше) |
| В mock-режиме поле пустое, в шелле — нормально (или наоборот) | Подписка позже синхронизации, или поле строится только из одного события | Читать `LastGameConfig` / `CurrentDifficulty` / `LastGameState` после подписки, строить по обоим |
| `SetJumperDifficulty ignored: 'easy'` | Имя не в регистре бэкенда | Это ошибка отправителя. Мост принимает только `EASY` / `MEDIUM` / `HARD` |
| `FormatException … is not a jumper … wire name` | В payload'е имя, которого нет в протоколе | Сверить отправителя с `protocol/src/jumper.ts`. Свойство бросает при чтении, а не при разборе JSON |
| Коэффициент не разбирается на части устройств | `float.Parse` без `CultureInfo.InvariantCulture` | `decimal.Parse(value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture)` |
| `SendMessage: object WebBridge does not have receiver for function ApplyBonusPurchaseResult` | Хост отказал в покупке бонуса и шлёт crush-команду, которой у моста jumper нет | На сцену не влияет; игрок видит тост хоста |
| Сборка на стенде не реагирует на шелл | Собрана с `WEBBRIDGE_MOCK` | Снять **Enable Mock In Build** и пересобрать |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `unity/Assets/WebBridge/Runtime/JumperWebBridge.cs`, `JumperEnums.cs`, `JumperWireNames.cs`,
  `WebJumperPayloads.cs`, `WebJumperBonusPayloads.cs`, `JumperMockHost.cs`, `JumperMockRound.cs`,
  `JumperMockLadder.cs`, `JumperMockAccelerators.cs`, `JumperMockBonusSeries.cs`, `JumperMockPayloads.cs`,
  `JumperMockSettings.cs`, `JumperMockDebugIMGUI.cs`, `JumperDevLadders.cs`, `Prefabs/JumperWebBridge.prefab`
- Общий формат перезапуска: `RestartRoundPayload.cs`, `RestartReason.cs` (namespace `Modules.Road`)
