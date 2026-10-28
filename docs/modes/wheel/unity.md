# Wheel — Unity

> Как подключить колесо к игре на Unity (WebGL). Что значат команды и данные — в [обзоре режима](README.md).

## Коротко

```csharp
using Modules.Wheel;
using UnityEngine;

public sealed class WheelRoundListener : MonoBehaviour
{
    private void OnEnable() => WheelWebBridge.Instance.RoundReceived += OnRound;
    private void OnDisable() => WheelWebBridge.Instance.RoundReceived -= OnRound;

    private void OnRound(WebWheelRoundPayload round)
    {
        // Снимок приходит на каждое изменение раунда у хоста — повторы той же фазы норма.
        // IN_GAME: крутить к round.CellIndex. FINISH_GAME: показать round.Winner,
        // когда колесо встало, и один раз за раунд:
        // WheelWebBridge.Instance.NotifyRoundShown();
    }
}
```

## Подключение

1. Пакет `com.pixi.webbridge` (UPM, `unity/Assets/WebBridge`). Установка — в
   [старте на Unity](../../guides/getting-started-unity.md).
2. **Префаба `WheelWebBridge.prefab` нет**, и в меню `GameObject → WebBridge` пункта для колеса тоже нет.
   Объект собирают руками. Быстрее всего — скопировать `Runtime/Prefabs/PlinkoWebBridge.prefab` и
   заменить на нём `PlinkoWebBridge` на `WheelWebBridge`. Набор компонентов тот же:

   | Компонент | Namespace | Зачем колесу |
   |---|---|---|
   | `WheelWebBridge` | `Modules.Wheel` | команды и события режима |
   | `LayoutWebBridge` | `Modules.Road` | в `Start()` шлёт первое `UiVisibility` — знак хосту, что мост поднят; `RequestBetBarViewportMetrics()` |
   | `AudioWebBridge` | `Modules.Road` | звуки через хост |
   | `ScreenOrientationWebBridge` | `Modules.Road` | `ChangeOrientation` |
   | `TranslationsWebBridge` | `Modules.Road` | `ApplyTranslations` |
   | `WebBridgeUI` | `Modules.Road` | окна результата и экран перехода |

3. GameObject называется строго **`WebBridge`**: хост адресует `SendMessage("WebBridge", <метод>, …)` по
   имени объекта. Имя класса роли не играет.
4. На сцене один мост. Проверка «мост уже есть» в меню `GameObject → WebBridge` про `WheelWebBridge` не
   знает и второй мост другого режима рядом с ним создать даст.

## API `WheelWebBridge`

`WheelWebBridge : WebBridgeBase<WheelWebBridge>` — синглтон (`WheelWebBridge.Instance`, ставится в
`Awake`). В `Start()` мост сам запускает стартовую синхронизацию: в WebGL-сборке шлёт
`RequestGameConfig` + `RequestGameState` каждые 0,5 с, до 10 раз, пока не придёт первый `ApplyRound`. В
mock-режиме и в редакторе синхронизация не идёт.

Общие события и методы базы (`WhiteLabelReceived`, `FastGameChanged`, `DisabledPlayPressed`,
`CashoutPressed`, `WinWindowSignalReceived`, `RequestPlay`, …) — в [справочнике ядра](../../reference/unity-core.md).

### События (React → игра)

| Событие C# | Тип аргумента | Метод `SendMessage` | Когда срабатывает |
|---|---|---|---|
| `RoundReceived` | `WebWheelRoundPayload` | `ApplyRound(string json)` | на каждый снимок раунда, повторы той же фазы тоже |
| `BetBarMetricsReceived` | `WebWheelBetBarMetricsPayload` | `SetWheelBetBarMetrics(string json)` | бар колеса сдвинулся, сменил размер или масштаб; ответ на `RequestBetBarViewportMetrics` |

Невалидный JSON мост не роняет. `WebBridgeUtils.DeserializePayload` пишет предупреждение
`[WebBridge] Failed to parse ApplyRound: …`, и событие не поднимается.

### Методы (игра → React)

| Метод | Сообщение в React | Когда звать |
|---|---|---|
| `NotifyRoundShown()` | `RoundShown` | один раз за раунд: колесо встало, пришёл `FINISH_GAME`, показ цвета доигран |
| `RequestGameState()` | `RequestGameState` | игра потеряла раунд: хост перечитает его и пришлёт `ApplyRound` |
| `RequestGameConfig()` | `RequestGameConfig` | зовёт сама синхронизация; колесу ответ не нужен |
| `LayoutWebBridge.Instance.RequestBetBarViewportMetrics()` | `RequestBetBarViewportMetrics` | сцена поднялась позже, чем пришли первые метрики |

### Свойства

| Свойство | Тип | Что хранит |
|---|---|---|
| `Instance` | `WheelWebBridge` | синглтон моста |
| `LastRound` | `WebWheelRoundPayload` | последний снимок; `null` до первого |
| `LastBetBarMetrics` | `WebWheelBetBarMetricsPayload` | последние метрики бара; `null` до первых |

Подписчик, поднявшийся позже, читает `LastRound` / `LastBetBarMetrics` и не ждёт следующего пуша.

## Payload-классы

Файл `Runtime/WebWheelPayloads.cs`, namespace `Modules.Wheel`. Поля — в форме провода, атрибут
`[JsonName]` задаёт имя в JSON.

### `WebWheelRoundPayload`

| Поле C# | JSON | Тип | Смысл |
|---|---|---|---|
| `StatusName` | `status` | `string` | фаза строкой: `WAIT_GAME` / `IN_GAME` / `FINISH_GAME` / `STOPPED` |
| `Status` | — | `WheelRoundStatus` | разобранная фаза (свойство) |
| `RoundId` | `roundId` | `string` | номер раунда бэкенда; `null`, если не пришёл |
| `MsToNextPhase` | `msToNextPhase` | `int?` | остаток до смены фазы на момент отправки; пересчитывается на каждом повторе |
| `WinnerColorName` | `winnerColor` | `string` | цвет строкой: `BLACK` / `RED` / `BLUE` / `GREEN`; приходит с `FINISH_GAME` |
| `Winner` | — | `WheelColor` | разобранный цвет (свойство); `Unknown`, пока цвета нет |
| `CellIndex` | `cellIndex` | `int?` | ячейка в раскладке бэкенда; приходит с `IN_GAME`, в `FINISH_GAME` может отсутствовать |
| `InCellOffset` | `inCellOffset` | `float?` | точка остановки внутри ячейки, доля 0..1 |

| `WheelRoundStatus` | из `status` |
|---|---|
| `WaitingForBets` | `WAIT_GAME` |
| `Spinning` | `IN_GAME` |
| `Finished` | `FINISH_GAME` |
| `Stopped` | `STOPPED` |
| `Unknown` | что-то другое — ошибка хоста, такой снимок не применять |

`WheelColor`: `Black`, `Red`, `Blue`, `Green`, `Unknown`.

### `WebWheelBetBarMetricsPayload`

| Поле C# | JSON | Смысл |
|---|---|---|
| `WidthViewport` | `widthViewport` | ширина колонки бара, доля ширины холста |
| `BetBarTopViewport` | `betBarTopViewport` | верх бара от нижнего края холста, доля высоты |
| `HistoryTopViewport` | `historyTopViewport` | верх ленты истории под полосой отсчёта, доля высоты |
| `BetBarScale` | `betBarScale` | масштаб бара к макету 1920×1080 |

Доли — как у Unity viewport (0 — низ, 1 — верх). Перевести в мир — `Camera.ViewportToWorldPoint`.

## Полный пример

Компонент проигрывает раунд целиком: сливает повторы, помнит ячейку из `IN_GAME`, при позднем входе
ставит колесо на ячейку цвета без вращения и шлёт `RoundShown` ровно один раз. Логика — та же, что у
JS-демо (`js/examples/demo-games/src/modes/wheel/WheelController.ts`). Вращение и показ цвета —
за абстрактным `WheelView`: его реализует игра.

```csharp
using System.Collections;
using Modules.Wheel;
using UnityEngine;
using WebBridge;

public abstract class WheelView : MonoBehaviour
{
    // Colour of every cell in the backend's order: cellIndex points into it.
    public abstract WheelColor[] Layout { get; }

    // Spins to the cell; turns == 0 snaps there without a spin. Finishes when the wheel has stopped.
    public abstract IEnumerator Spin(int cellIndex, float inCellOffset, float seconds, int turns);

    public abstract IEnumerator Reveal(WheelColor color);

    public abstract void ShowBetting(float? secondsLeft);

    public abstract void ShowPaused();

    public abstract void SetBarTop(float viewportY);
}

public sealed class WheelRoundPresenter : MonoBehaviour
{
    private const float DefaultSpinSeconds = 4f;
    private const float MinSpinSeconds = 0.6f;
    private const float SnapSeconds = 0.7f;
    private const float SecondsPerTurn = 0.9f;
    private const int MaxTurns = 6;
    private const float CellMiddle = 0.5f;

    [SerializeField] private WheelView _view;

    private string _roundId;
    private WheelRoundStatus _status = WheelRoundStatus.Unknown;
    private float? _deadline;
    private int? _cellIndex;
    private float? _inCellOffset;
    private WheelColor _winner = WheelColor.Unknown;
    private bool _isSpinStarted;
    private bool _hasLanded;
    private bool _isRevealStarted;
    private int _roundSerial;

    private WheelWebBridge Bridge => WheelWebBridge.Instance;

    private void OnEnable()
    {
        Bridge.RoundReceived += OnRoundReceived;
        Bridge.BetBarMetricsReceived += OnBetBarMetrics;

        if (Bridge.LastRound != null)
            OnRoundReceived(Bridge.LastRound);
        if (Bridge.LastBetBarMetrics != null)
            OnBetBarMetrics(Bridge.LastBetBarMetrics);
    }

    private void OnDisable()
    {
        Bridge.RoundReceived -= OnRoundReceived;
        Bridge.BetBarMetricsReceived -= OnBetBarMetrics;
    }

    private void OnBetBarMetrics(WebWheelBetBarMetricsPayload metrics)
    {
        _view.SetBarTop(metrics.BetBarTopViewport);
    }

    private void OnRoundReceived(WebWheelRoundPayload round)
    {
        if (round.Status == WheelRoundStatus.Unknown)
        {
            WebBridgeLogger.LogError($"[Wheel] ApplyRound has an unknown status: {round.StatusName}");
            return;
        }

        Merge(round);

        if (_status == WheelRoundStatus.WaitingForBets)
            _view.ShowBetting(_deadline.HasValue ? _deadline.Value - Time.realtimeSinceStartup : (float?)null);
        if (_status == WheelRoundStatus.Stopped)
            _view.ShowPaused();

        TryStartSpin();
        TryStartReveal();
    }

    // A repeat of the same phase changes nothing; the deadline is taken only when the phase changes.
    private void Merge(WebWheelRoundPayload round)
    {
        bool isNewRound = round.RoundId != _roundId
                          || (round.Status == WheelRoundStatus.WaitingForBets
                              && _status != WheelRoundStatus.WaitingForBets);
        bool isNewPhase = isNewRound || round.Status != _status;

        if (isNewRound)
            ResetRound(round.RoundId);

        if (isNewPhase)
            _deadline = round.MsToNextPhase.HasValue
                ? Time.realtimeSinceStartup + round.MsToNextPhase.Value / 1000f
                : (float?)null;

        _status = round.Status;
        _cellIndex = round.CellIndex ?? _cellIndex;
        _inCellOffset = round.InCellOffset ?? _inCellOffset;
        if (round.Winner != WheelColor.Unknown)
            _winner = round.Winner;
    }

    private void ResetRound(string roundId)
    {
        _roundId = roundId;
        _cellIndex = null;
        _inCellOffset = null;
        _winner = WheelColor.Unknown;
        _isSpinStarted = false;
        _hasLanded = false;
        _isRevealStarted = false;
        _roundSerial++;
    }

    // The cell from IN_GAME; a page opened on FINISH_GAME knows only the colour.
    private int? TargetCell()
    {
        if (_cellIndex.HasValue)
            return _cellIndex;
        if (_winner == WheelColor.Unknown)
            return null;

        int index = System.Array.IndexOf(_view.Layout, _winner);
        return index >= 0 ? index : (int?)null;
    }

    private void TryStartSpin()
    {
        if (_isSpinStarted)
            return;
        if (_status != WheelRoundStatus.Spinning && _status != WheelRoundStatus.Finished)
            return;

        int? cell = TargetCell();
        if (!cell.HasValue)
            return;

        _isSpinStarted = true;
        float offset = _inCellOffset ?? CellMiddle;
        if (_status == WheelRoundStatus.Finished)
        {
            StartCoroutine(SpinRoutine(_roundSerial, cell.Value, offset, SnapSeconds, 0));
            return;
        }

        float left = _deadline.HasValue ? _deadline.Value - Time.realtimeSinceStartup : DefaultSpinSeconds;
        float seconds = Mathf.Max(MinSpinSeconds, left);
        int turns = Mathf.Clamp(Mathf.FloorToInt(seconds / SecondsPerTurn), 1, MaxTurns);
        StartCoroutine(SpinRoutine(_roundSerial, cell.Value, offset, seconds, turns));
    }

    private IEnumerator SpinRoutine(int serial, int cell, float offset, float seconds, int turns)
    {
        yield return _view.Spin(cell, offset, seconds, turns);
        if (serial != _roundSerial)
            yield break;

        _hasLanded = true;
        TryStartReveal();
    }

    // RoundShown goes once per round: after the wheel has stopped AND FINISH_GAME has arrived.
    private void TryStartReveal()
    {
        if (_isRevealStarted || !_hasLanded || _status != WheelRoundStatus.Finished)
            return;
        if (_winner == WheelColor.Unknown)
        {
            WebBridgeLogger.LogError("[Wheel] FINISH_GAME without a colour: nothing to reveal");
            return;
        }

        _isRevealStarted = true;
        StartCoroutine(RevealRoutine(_roundSerial));
    }

    private IEnumerator RevealRoutine(int serial)
    {
        WheelColor landed = _view.Layout[TargetCell() ?? 0];
        if (landed != _winner)
            WebBridgeLogger.LogError($"[Wheel] the pointer stopped on {landed}, the round is {_winner}");

        yield return _view.Reveal(_winner);
        if (serial == _roundSerial)
            Bridge.NotifyRoundShown();
    }
}
```

Что здесь важно:

- `Merge` — слияние, а не замена. Новый раунд — новый `RoundId` или вход в `WaitingForBets`.
- `_roundSerial` отрезает корутины прошлого раунда: колесо, докрутившееся после начала нового раунда,
  `RoundShown` не шлёт.
- Дедлайн — по `Time.realtimeSinceStartup`: отсчёт хоста идёт по настенным часам, и `Time.timeScale` игры
  его не должен замедлять.
- Подписка в `OnEnable` требует, чтобы `Awake` моста отработал раньше. Мост и презентер на разных
  объектах — поставить мост раньше в Script Execution Order или подписываться в `Start`.

## Mock-режим в редакторе

Mock-хоста для колеса в Unity-пакете **нет**. Флаг `Tools → WebBridge → Enable Mock` только отключает
стартовую синхронизацию (`HasReceivedInitialConfig = IsMockEnabled`): раунды сами не пойдут, отладочной
IMGUI-панели у колеса тоже нет.

В редакторе раунды подают вызовом публичного метода моста — тем же, что зовёт `SendMessage`.
Тестовый драйвер с расписанием, как у JS-демо (5 с ставок, 4 с вращения, 3 с результата, каждая фаза
дважды, `FINISH_GAME` без ячейки):

```csharp
using System.Collections;
using System.Globalization;
using Modules.Wheel;
using UnityEngine;

// Dev scenes only: plays the server's schedule into the bridge the way the shell forwards it.
public sealed class WheelRoundDriver : MonoBehaviour
{
    private static readonly string[] Colors = { "BLACK", "RED", "BLUE", "GREEN" };

    [SerializeField] private int _cellCount = 54;
    [SerializeField] private float _bettingSeconds = 5f;
    [SerializeField] private float _spinSeconds = 4f;
    [SerializeField] private float _resultSeconds = 3f;

    private int _roundNumber;

    private IEnumerator Start()
    {
        while (enabled)
        {
            _roundNumber++;
            int cell = Random.Range(0, _cellCount);
            float offset = Random.Range(0.1f, 0.9f);
            string color = Colors[Random.Range(0, Colors.Length)]; // your layout's colour of `cell`

            yield return Phase("WAIT_GAME", _bettingSeconds, "null", "null", "null");
            yield return Phase("IN_GAME", _spinSeconds, "null", cell.ToString(CultureInfo.InvariantCulture),
                offset.ToString(CultureInfo.InvariantCulture));
            yield return Phase("FINISH_GAME", _resultSeconds, $"\"{color}\"", "null", "null");
        }
    }

    private IEnumerator Phase(string status, float seconds, string winner, string cell, string offset)
    {
        int ms = Mathf.RoundToInt(seconds * 1000f);
        string json = $"{{\"status\":\"{status}\",\"roundId\":\"{_roundNumber}\",\"msToNextPhase\":{ms}," +
                      $"\"winnerColor\":{winner},\"cellIndex\":{cell},\"inCellOffset\":{offset}}}";

        WheelWebBridge.Instance.ApplyRound(json);
        yield return new WaitForSeconds(0.7f);
        WheelWebBridge.Instance.ApplyRound(json); // the shell repeats a phase on every change of its round
        yield return new WaitForSeconds(seconds - 0.7f);
    }
}
```

В драйвере цвет случайный. В своей игре берите цвет ячейки `cell` из раскладки (`WheelView.Layout`),
иначе сверка цвета в презентере будет писать ошибку. Метрики бара в редакторе подаются так же:
`WheelWebBridge.Instance.SetWheelBetBarMetrics("{\"widthViewport\":1,\"betBarTopViewport\":0.36,\"historyTopViewport\":0.3,\"betBarScale\":0.5}")`.

Драйвер держат на тестовой сцене. В сцену релизной сборки его не кладут.

## Сборка WebGL и проверка

1. На объекте `WebBridge` есть `WheelWebBridge` и `LayoutWebBridge`. Без `LayoutWebBridge` первое
   `UiVisibility` не уйдёт, и шелл будет считать мост неготовым.
2. `Enable Mock In Build` (define `WEBBRIDGE_MOCK`) выключен: с ним мост не просит раунд у хоста.
3. Собрать WebGL и открыть в шелле локально (`?localBuild=…`) или на стенде конфигуратора. Игра —
   режима `wheel`, launch-URL несёт `gameMode=wheel&gameCategory=wheel`. Подробно —
   [старт на Unity](../../guides/getting-started-unity.md).
4. В сборке логи моста выключены. Включить — `SetLoggingEnabled` из чит-панели шелла. Дальше смотреть в
   консоли браузера: `[BridgeDebug][React->Unity] ApplyRound raw: …` на каждый снимок и
   `[Unity -> React] RoundShown` — один на раунд, после `FINISH_GAME`.
5. После `RoundShown` шелл показывает выплату, открывает окно результата (если включено для исхода) и
   проигрывает баннер над баром.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| В консоли браузера: у `WebBridge` нет получателя `UpdateCoeffs` / `ApplyGameConfig` | колесо живёт на общем экране шелла, и синхронизация конфига road шлёт ему лесенку; у `WheelWebBridge` этих методов нет | ничего не делать: колесу эти данные не нужны (см. [обзор](README.md#команды-хоста--игра)) |
| Колесо не узнаёт о раунде после загрузки | первый `ApplyRound` ушёл, пока сцена не поднялась | стартовая синхронизация моста переспросит `RequestGameState`; не отключать её и не держать `WEBBRIDGE_MOCK` в сборке |
| Шелл долго не считает мост готовым | на объекте `WebBridge` нет `LayoutWebBridge` | собрать объект по набору `PlinkoWebBridge.prefab` |
| Вращение перезапускается на повторах | `RoundReceived` обрабатывается как новая фаза | сливать снимки, см. `Merge` |
| `Winner == Unknown` на `Spinning` | цвет приходит только с `FINISH_GAME` | на `Spinning` крутить по `CellIndex` |
| Выплата не показывается | `NotifyRoundShown()` не позван: `FINISH_GAME` пришёл без `CellIndex`, и колесо не встало | помнить ячейку из `IN_GAME`; при позднем входе брать ячейку цвета `Winner` |
| Окно результата открывается дважды | `NotifyRoundShown()` на каждом повторе `FINISH_GAME` | флаг «показ начат» на раунд |
| `NullReferenceException` в `OnEnable` | `Awake` моста ещё не отработал, `Instance == null` | мост раньше в Script Execution Order или подписка в `Start` |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md) ·
  [Mock-режим](../../concepts/mock-mode.md)
- Исходники: `unity/Assets/WebBridge/Runtime/WheelWebBridge.cs`, `unity/Assets/WebBridge/Runtime/WebWheelPayloads.cs`
