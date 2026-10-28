# Twist — Unity

> Как подключить Twist к игре на Unity (WebGL). Контракт режима — в [обзоре](README.md).

## Статус

**Готового Unity-моста у twist нет.** В пакете `com.pixi.webbridge` нет ни `TwistWebBridge`, ни префаба,
ни mock-хоста. Живая игра режима — веб-игра TwistReact на Phaser.

Шелл при этом умеет вести twist и в Unity-сборке. Движок выбирается по сборке, а не по режиму: дескриптор
релиза (`build.engine`), манифест (`meta.engine`) или параметр отладки `?engine=unity`. Команды twist
шелл переводит в вызовы `SendMessage("WebBridge", <метод>, <параметр>)` в
`src/engine/unity/unityProtocol.ts`. Значит, Unity-игре нужен только мост с этими методами. Ниже —
рецепт: провод, payload-классы, мост целиком и игра поверх него.

## Коротко

```csharp
// TwistWebBridge — из рецепта ниже, лежит на GameObject "WebBridge".
_bridge.SpinResultReceived += spin => StartCoroutine(PlaySpin(spin));

private IEnumerator PlaySpin(WebTwistGameStatePayload spin)
{
    yield return _board.Spin(spin.Outcome);   // тотемы встали
    yield return _board.Fill(spin.Progress);  // поле показало progress сервера
    _bridge.NotifySpinReady();                // React раскрывает исход и открывает бар
}
```

## Провод

Хост адресует один GameObject по имени — **`WebBridge`** — и вызывает публичный метод по имени. Имя
C#-класса роли не играет.

### React → Unity

| Команда протокола | Метод `SendMessage` | Параметр |
|---|---|---|
| `ApplySpinResult` | `ApplySpinResult` | `string` — сырой GameState, JSON |
| `ApplyGameState` | `ApplyGameState` | `string` — сырой GameState, JSON |
| `ApplyGameConfig` | `ApplyGameConfig` | `string` — ответ `get-game-config` как есть |
| `RestartRound` | `RestartRound` | `string` — `cashout\|$3.90`, `bonus\|12.5` |
| `SetAutoplay` | `SetAutoplay` | `int` — `1` / `0` |
| `StartBonus` | `StartBonus` | `string` — `JSON.stringify(TwistStartBonusPayload)`; у twist валюта не подменяется |
| `FreeGamesIntroFinished` | `OnFreeGamesIntroFinished` | пустая строка — метод без параметров |
| `UpdateCoeffs` | `UpdateCoeffs` | `string` — лесенка road через запятую; twist её игнорирует |

Общие команды (`SetFastGame`, `ApplyWhiteLabel`, `OnCashoutPressed`, `OnDisabledPlayPressed`,
`OnWinWindowSignal`, `OnTransitionScreen*`, метрики бет-бара, переводы, ориентация) принимают
`WebBridgeBase<T>` и компоненты префаба — см. [ядро Unity-моста](../../reference/unity-core.md).

### Unity → React

Всё уходит через `WebBridgeUtils.Send(string)` (событие `SendToReact`):

| Сообщение | Когда |
|---|---|
| `SpinReady` | спин доигран; поле очищено после `RestartRound`. Не во фри-спинах |
| `BonusActive` | серия началась |
| `BonusProgressSave_{"completedIterations":3,"totalIterations":12}` | сразу после `BonusActive` (0) и после каждого фри-спина |
| `BonusEnded` | последний фри-спин доигран — обязательно |
| `RequestGameConfig`, `RequestGameState` | старт сцены; повторяет `BeginInitialWebSyncAfterSceneLoad()` |
| `RequestPlay` | тап по сцене вместо Play (метод базы) |

## Подключение

1. Поставить пакет `com.pixi.webbridge` — [старт на Unity](../../guides/getting-started-unity.md).
2. Положить в проект игры классы из [рецепта](#рецепт-мост-twistwebbridge): payload'ы и мост, namespace
   `Modules.Twist`.
3. Собрать объект моста. Проще всего — взять готовый: **GameObject → WebBridge → Create MineSlotWebBridge**
   создаёт объект `WebBridge` со всеми общими компонентами (`LayoutWebBridge`,
   `ScreenOrientationWebBridge`, `AudioWebBridge`, `TranslationsWebBridge`, `WebBridgeUI`). Удалить с него
   `MineSlotWebBridge`, добавить `TwistWebBridge`, сохранить как префаб игры. На объекте должен быть
   **один** мост режима.
4. Имя объекта — строго `WebBridge`.

## Рецепт: payload-классы

Классы зеркалят [`TwistGameState`](README.md#twistgamestate) и
[`TwistStartBonusPayload`](README.md#twiststartbonuspayload). JSON-ключи задаёт `[JsonName]`; разбирает их
`WebBridgeUtils.DeserializePayload<T>` пакета.

```csharp
using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Twist
{
    /// <summary>Filled cells per sector, as the server counts them.</summary>
    [Preserve]
    [Serializable]
    public class WebTwistProgressPayload
    {
        [JsonName("fire")]
        public int Fire;

        [JsonName("earth")]
        public int Earth;

        [JsonName("water")]
        public int Water;
    }

    /// <summary>A sector filled to its bonus cell, not withdrawn yet. React withdraws it itself.</summary>
    [Preserve]
    [Serializable]
    public class WebTwistBonusPayload
    {
        [JsonName("hasBonus")]
        public bool HasBonus;

        [JsonName("coeff")]
        public string Coeff;
    }

    /// <summary>
    /// The raw twist GameState: a spin, a restore, a payout or one free spin of a bought series. Only
    /// SessionIsFinished closes the session: Status lies ("lose" on a spin that merely won nothing) and
    /// IsFinished is true on a part cash out of a live session too.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebTwistGameStatePayload : WebGameStateBase
    {
        [JsonName("betAmount")]
        public string BetAmount;

        [JsonName("currency")]
        public string Currency;

        // A number or a decimal string on the wire; a string field takes both.
        [JsonName("coeff")]
        public string Coeff;

        // fire | earth | water | air | death
        [JsonName("outcome")]
        public string Outcome;

        [JsonName("sessionIsFinished")]
        public bool? SessionIsFinished;

        [JsonName("progress")]
        public WebTwistProgressPayload Progress;

        [JsonName("bonus")]
        public WebTwistBonusPayload Bonus;

        // Free spins only: the coefficient for landing in a sector filled to its limit.
        [JsonName("autoWinCoeff")]
        public string AutoWinCoeff;

        public bool IsSessionClosed => SessionIsFinished == true;
    }

    /// <summary>The StartBonus payload: every spin is a GameState JSON string of its own.</summary>
    [Preserve]
    [Serializable]
    public class WebTwistStartBonusPayload
    {
        [JsonName("totalRounds")]
        public int TotalRounds;

        [JsonName("spins")]
        public string[] Spins = Array.Empty<string>();
    }

    [Preserve]
    [Serializable]
    public class WebTwistBonusProgressPayload
    {
        [JsonName("completedIterations")]
        public int CompletedIterations;

        [JsonName("totalIterations")]
        public int TotalIterations;
    }
}
```

`RestartRound` разбирается своим типом. `Modules.Road.RestartRoundPayload` пакета знает `win`, `cashout` и
`lose`, а `bonus` превращает в `RestartReason.None`:

```csharp
namespace Modules.Twist
{
    public enum TwistRestartReason
    {
        None = 0,
        Cashout = 1,
        Bonus = 2,
    }

    /// <summary>RestartRound as "&lt;reason&gt;|&lt;amount&gt;": "cashout|$3.90" or "bonus|12.5".</summary>
    public readonly struct TwistRestartRequest
    {
        private const char Separator = '|';

        public TwistRestartRequest(TwistRestartReason reason, string amount)
        {
            Reason = reason;
            Amount = amount;
        }

        public TwistRestartReason Reason { get; }

        // React's text, kept as is: the display string after a cash out, the server's decimal after a series.
        public string Amount { get; }

        public static TwistRestartRequest Parse(string payload)
        {
            string text = payload ?? string.Empty;
            int separatorIndex = text.IndexOf(Separator);
            string reason = separatorIndex < 0 ? text : text.Substring(0, separatorIndex);
            string amount = separatorIndex < 0 ? string.Empty : text.Substring(separatorIndex + 1);

            switch (reason.Trim().ToLowerInvariant())
            {
                case "cashout":
                    return new TwistRestartRequest(TwistRestartReason.Cashout, amount);
                case "bonus":
                    return new TwistRestartRequest(TwistRestartReason.Bonus, amount);
                default:
                    return new TwistRestartRequest(TwistRestartReason.None, amount);
            }
        }
    }

    /// <summary>A bought series with every spin already parsed.</summary>
    public sealed class TwistBonusSeries
    {
        public TwistBonusSeries(int totalRounds, WebTwistGameStatePayload[] spins)
        {
            TotalRounds = totalRounds;
            Spins = spins;
        }

        public int TotalRounds { get; }

        public WebTwistGameStatePayload[] Spins { get; }
    }
}
```

## Рецепт: мост `TwistWebBridge`

По образцу `MineSlotWebBridge` и `JumperWebBridge` пакета: наследник `WebBridgeBase<T>`, публичные методы
с именами из провода, события C# для игры. Игровых зависимостей у моста нет: игра зависит от него, а не
наоборот.

```csharp
using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Twist
{
    /// <summary>
    /// Bridge between React and a twist game. React forwards the server's raw GameState and keeps the
    /// outcome and the bet bar locked until NotifySpinReady. A bought series arrives whole in StartBonus:
    /// the game spins it at its own pace and reports it by bonus events, never by SpinReady.
    /// </summary>
    [Preserve]
    public class TwistWebBridge : WebBridgeBase<TwistWebBridge>
    {
        private const string BonusProgressSaveMessagePrefix = "BonusProgressSave_";

        // The platform config, as is: its shape is owned by the platform.
        public event Action<JsonValue> GameConfigReceived;

        // "Bring the board to this state": a restore, a part cash out, a withdrawn sector bonus. No reply.
        public event Action<WebTwistGameStatePayload> GameStateReceived;

        // A live spin: play it, then NotifySpinReady.
        public event Action<WebTwistGameStatePayload> SpinResultReceived;

        // After a full cash out or a series: clear the board, then NotifySpinReady.
        public event Action<TwistRestartRequest> RestartRequested;

        public event Action<bool> AutoplayChanged;

        // A bought series: NotifyBonusActive, SaveBonusProgress per spin, NotifyBonusEnded.
        public event Action<TwistBonusSeries> BonusStartRequested;

        // The free-spins intro on the React side is over: the first free spin may go.
        public event Action FreeGamesIntroFinished;

        public JsonValue LastGameConfig { get; private set; }

        // The latest state React described, by a game state or by a spin.
        public WebTwistGameStatePayload LastGameState { get; private set; }

        public bool IsAutoplayEnabled { get; private set; }

        private void Start()
        {
            BeginInitialWebSyncAfterSceneLoad();
        }

        public override void RequestGameConfig()
        {
            WebBridgeUtils.Send("RequestGameConfig");
        }

        public override void RequestGameState()
        {
            WebBridgeUtils.Send("RequestGameState");
        }

        // React entry point (SendMessage): the raw get-game-config reply.
        public void ApplyGameConfig(string payload)
        {
            JsonValue config = WebBridgeUtils.DeserializePayload<JsonValue>(payload, nameof(ApplyGameConfig));
            if (config == null)
                return;

            HasReceivedInitialConfig = true;
            LastGameConfig = config;
            GameConfigReceived?.Invoke(config);
        }

        // React entry point (SendMessage): the raw GameState of the session.
        public void ApplyGameState(string payload)
        {
            WebTwistGameStatePayload state =
                WebBridgeUtils.DeserializePayload<WebTwistGameStatePayload>(payload, nameof(ApplyGameState));
            if (state == null)
                return;

            LastGameState = state;
            GameStateReceived?.Invoke(state);
        }

        // React entry point (SendMessage): the raw play reply.
        public void ApplySpinResult(string payload)
        {
            WebTwistGameStatePayload spin =
                WebBridgeUtils.DeserializePayload<WebTwistGameStatePayload>(payload, nameof(ApplySpinResult));
            if (spin == null)
                return;

            LastGameState = spin;
            SpinResultReceived?.Invoke(spin);
        }

        // React entry point (SendMessage): "cashout|$3.90" or "bonus|12.5".
        public void RestartRound(string payload)
        {
            RestartRequested?.Invoke(TwistRestartRequest.Parse(payload));
        }

        // React entry point (SendMessage): 1 = autoplay on, 0 = off.
        public void SetAutoplay(int value)
        {
            bool isEnabled = value != 0;
            if (isEnabled == IsAutoplayEnabled)
                return;

            IsAutoplayEnabled = isEnabled;
            AutoplayChanged?.Invoke(isEnabled);
        }

        // React entry point (SendMessage): the whole bought series; each spin is JSON inside JSON.
        public void StartBonus(string payload)
        {
            WebTwistStartBonusPayload bonus =
                WebBridgeUtils.DeserializePayload<WebTwistStartBonusPayload>(payload, nameof(StartBonus));
            if (bonus == null)
                return;

            var spins = new WebTwistGameStatePayload[bonus.Spins.Length];
            for (int i = 0; i < spins.Length; i++)
            {
                spins[i] = WebBridgeUtils.DeserializePayload<WebTwistGameStatePayload>(bonus.Spins[i], nameof(StartBonus));
                if (spins[i] == null)
                {
                    WebBridgeLogger.LogError($"[TwistWebBridge] StartBonus spin {i} is not a GameState: {bonus.Spins[i]}");
                    return;
                }
            }

            BonusStartRequested?.Invoke(new TwistBonusSeries(Math.Max(bonus.TotalRounds, spins.Length), spins));
        }

        // React entry point (SendMessage, empty param): the go-ahead for the first free spin.
        public void OnFreeGamesIntroFinished()
        {
            FreeGamesIntroFinished?.Invoke();
        }

        // React entry point (SendMessage): the shared sync pushes a road ladder; twist keeps its own sector table.
        public void UpdateCoeffs(string payload)
        {
        }

        // Unity -> React: the totems landed and the board shows the new progress, or the board is cleared after
        // RestartRound. Never during a series: React would unlock the bet bar mid-series.
        public void NotifySpinReady()
        {
            WebBridgeUtils.Send("SpinReady");
        }

        public void NotifyBonusActive()
        {
            WebBridgeUtils.Send("BonusActive");
        }

        public void SaveBonusProgress(int completedIterations, int totalIterations)
        {
            string json = Json.Serialize(new WebTwistBonusProgressPayload
            {
                CompletedIterations = completedIterations,
                TotalIterations = totalIterations,
            });
            WebBridgeUtils.Send(BonusProgressSaveMessagePrefix + json);
        }

        // Unity -> React: the last free spin is played. Mandatory: React waits for it without a timeout.
        public void NotifyBonusEnded()
        {
            WebBridgeUtils.Send("BonusEnded");
        }
    }
}
```

Замечания к рецепту:

- `UpdateCoeffs` — пустой приёмник намеренно: шелл шлёт лесенку road и twist-игре. Без метода Unity пишет
  в консоль ошибку о пропавшем приёмнике `SendMessage`.
- `BeginInitialWebSyncAfterSceneLoad()` работает только в WebGL-сборке, в редакторе это no-op.
- Мост не несёт mock-хоста. Не собирать с `WEBBRIDGE_MOCK` (**Tools → WebBridge → Enable Mock In Build**):
  при включённом mock база не спрашивает у React конфиг и состояние, а отвечать некому.

## Полный пример

Игра поверх моста: очередь корутин (команда ждёт, пока доиграет предыдущая), спин, рестарт, серия с
защёлкой интро. Отрисовку делает `TwistBoardView` — ваша реализация.

```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Modules.Twist
{
    /// <summary>The engine's drawing: each coroutine ends when its animation has played.</summary>
    public abstract class TwistBoardView : MonoBehaviour
    {
        public abstract IEnumerator Spin(string outcome);

        public abstract IEnumerator Fill(WebTwistProgressPayload progress);

        public abstract IEnumerator Wipe();

        public abstract void ShowResult(string amount);
    }

    public class TwistGame : MonoBehaviour
    {
        private const string DeathOutcome = "death";
        private static readonly WebTwistProgressPayload EmptyBoard = new WebTwistProgressPayload();

        [SerializeField] private TwistWebBridge _bridge;
        [SerializeField] private TwistBoardView _board;

        private readonly Queue<IEnumerator> _moves = new Queue<IEnumerator>();
        private Coroutine _runner;

        // A latch: the go-ahead may arrive while the series still waits behind the spin that bought it.
        private bool _isIntroFinished;

        private void OnEnable()
        {
            _bridge.GameStateReceived += OnGameState;
            _bridge.SpinResultReceived += OnSpinResult;
            _bridge.RestartRequested += OnRestartRequested;
            _bridge.BonusStartRequested += OnBonusStartRequested;
            _bridge.FreeGamesIntroFinished += OnFreeGamesIntroFinished;
        }

        private void OnDisable()
        {
            _bridge.GameStateReceived -= OnGameState;
            _bridge.SpinResultReceived -= OnSpinResult;
            _bridge.RestartRequested -= OnRestartRequested;
            _bridge.BonusStartRequested -= OnBonusStartRequested;
            _bridge.FreeGamesIntroFinished -= OnFreeGamesIntroFinished;
            StopAllCoroutines();
            _runner = null;
            _moves.Clear();
        }

        private void OnGameState(WebTwistGameStatePayload state) => Enqueue(_board.Fill(BoardOf(state)));

        private void OnSpinResult(WebTwistGameStatePayload spin) => Enqueue(PlaySpin(spin));

        private void OnRestartRequested(TwistRestartRequest request) => Enqueue(Restart(request));

        private void OnBonusStartRequested(TwistBonusSeries series) => Enqueue(PlaySeries(series));

        private void OnFreeGamesIntroFinished() => _isIntroFinished = true;

        private IEnumerator PlaySpin(WebTwistGameStatePayload spin)
        {
            yield return _board.Spin(spin.Outcome);
            if (spin.Outcome == DeathOutcome)
                yield return _board.Wipe();
            else
                yield return _board.Fill(BoardOf(spin));

            _bridge.NotifySpinReady();
        }

        private IEnumerator Restart(TwistRestartRequest request)
        {
            if (!string.IsNullOrEmpty(request.Amount))
                _board.ShowResult(request.Amount);

            yield return _board.Fill(EmptyBoard);
            _bridge.NotifySpinReady();
        }

        // Free spins report the bonus events only: a SpinReady here would unlock the bet bar mid-series.
        private IEnumerator PlaySeries(TwistBonusSeries series)
        {
            _bridge.NotifyBonusActive();
            _bridge.SaveBonusProgress(0, series.TotalRounds);
            yield return new WaitUntil(() => _isIntroFinished);
            _isIntroFinished = false;

            for (int i = 0; i < series.Spins.Length; i++)
            {
                yield return _board.Spin(series.Spins[i].Outcome);
                yield return _board.Fill(series.Spins[i].Progress);
                _bridge.SaveBonusProgress(i + 1, series.TotalRounds);
            }

            _bridge.NotifyBonusEnded();
        }

        // A closed session's progress is a leftover: the board is empty.
        private static WebTwistProgressPayload BoardOf(WebTwistGameStatePayload state) =>
            state.IsSessionClosed || state.Progress == null ? EmptyBoard : state.Progress;

        private void Enqueue(IEnumerator move)
        {
            _moves.Enqueue(move);
            if (_runner == null)
                _runner = StartCoroutine(RunMoves());
        }

        private IEnumerator RunMoves()
        {
            while (_moves.Count > 0)
                yield return _moves.Dequeue();

            _runner = null;
        }
    }
}
```

## Mock-режим в редакторе

Mock-хоста для twist в пакете нет — ни C#, ни настроек, ни IMGUI-панели. Пока его нет, игру в редакторе
гоняют, вызывая методы моста напрямую, как это сделал бы React:

```csharp
using UnityEngine;

namespace Modules.Twist
{
    /// <summary>Editor-only stand-in for React: feeds recorded twist replies into the bridge.</summary>
    public class TwistEditorFeed : MonoBehaviour
    {
        [SerializeField] private TwistWebBridge _bridge;
        [SerializeField] private TextAsset _spinReply;   // a recorded play reply
        [SerializeField] private TextAsset _seriesReply; // a recorded StartBonus payload

        [ContextMenu("Spin")]
        private void Spin() => _bridge.ApplySpinResult(_spinReply.text);

        [ContextMenu("Cash out")]
        private void CashOut() => _bridge.RestartRound("cashout|$3.90");

        [ContextMenu("Buy series")]
        private void BuySeries()
        {
            _bridge.StartBonus(_seriesReply.text);
            _bridge.OnFreeGamesIntroFinished();
        }
    }
}
```

`WebBridgeUtils.Send` в редакторе пишет каждое сообщение в лог (`[Unity -> React] SpinReady`), если логи
моста включены. Как устроен полноценный mock-хост (ответы, блокировка до `SpinReady`, IMGUI) — смотреть
`MineSlotMockHost` и `JumperMockHost` пакета и [mock-режим](../../concepts/mock-mode.md). Логику ответов
twist можно перенести из `TwistMockHost` демо-игры (`js/examples/demo-games/src/modes/twist/`).

## Сборка WebGL и проверка

1. На сцене один объект `WebBridge` с общими компонентами и `TwistWebBridge`; `TwistGame` ссылается на
   него.
2. Сборка без `WEBBRIDGE_MOCK`.
3. Загрузить сборку в конфигуратор как игру режима `twist`. Движок шелл берёт из сборки
   (`build.engine`); для отладки — `?engine=unity`.
4. На стенде проверить по логам моста (`SetLoggingEnabled` с чит-панели):
   - на старте уходят `RequestGameConfig` и `RequestGameState`, приходят `ApplyGameConfig` и
     `ApplyGameState`;
   - на спин — один `SpinReady` после посадки тотемов;
   - на CASHOUT — `OnCashoutPressed`, затем `RestartRound`, затем `SpinReady`;
   - на PART CASHOUT — `ApplyGameState`, без ответа;
   - серия: `BonusActive`, `BonusProgressSave_` с нулём, `OnFreeGamesIntroFinished`, по
     `BonusProgressSave_` на спин, `BonusEnded`, `RestartRound "bonus|…"`, `SpinReady`.
5. Перезагрузить страницу посреди сессии и посреди серии — см.
   [восстановление](README.md#восстановление-и-ошибки).

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Команды не доходят, в консоли браузера ошибки `SendMessage` | объект назван иначе или моста нет на сцене | имя GameObject — строго `WebBridge`, на нём `TwistWebBridge` |
| Ошибка об отсутствующем приёмнике `UpdateCoeffs` | нет пустого метода | добавить `UpdateCoeffs(string)` |
| `RestartRound "bonus|…"` не очищает поле | разбор через `RestartRoundPayload` даёт `None` | свой `TwistRestartRequest.Parse` |
| Спины серии пустые | `Spins` взяты как объекты | каждый элемент — строка JSON, разбирать отдельно |
| Бар ожил посреди серии | `NotifySpinReady()` во фри-спине | в серии — только `SaveBonusProgress` |
| На старте нет конфига и состояния | сборка с `WEBBRIDGE_MOCK` | собрать без mock-дефайна |
| Спин не проигрался, в логе `[WebBridge] Failed to parse ApplySpinResult` | payload не разобрался, мост не позвал событие | сверить классы с [`TwistGameState`](README.md#twistgamestate) |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md) ·
  [Новый режим](../../guides/adding-a-mode.md)
- Образцы в пакете: `unity/Assets/WebBridge/Runtime/JumperWebBridge.cs` (серия бонуса),
  `unity/Assets/WebBridge/Runtime/MineSlotWebBridge.cs` (спин одним ответом)
- Провод на стороне хоста: RoadFrontent `src/engine/unity/unityProtocol.ts`
