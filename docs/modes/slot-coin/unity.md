# Slot Coin — Unity

> Как подключить Slot Coin к игре на Unity (WebGL). Контракт режима — в [обзоре](README.md).

## Статус

**Готового Unity-моста у slot-coin нет.** В пакете `com.pixi.webbridge` нет ни `SlotCoinWebBridge`, ни
префаба, ни mock-хоста. Живая игра режима — веб-игра MegaSlot на Phaser (мост `src/bridge/bridgeEntry.ts`,
на прежних именах `SlotBridge` + `createPhaserBoot`). C#-кода с `ApplySpinResult` для slot-coin в
соседних проектах (MegaSlot, SlotEngine, SlotModernWarfare) нет: своего Unity-моста у живой игры тоже нет.

Шелл умеет вести slot-coin и в Unity-сборке. Движок выбирается по сборке, а не по режиму: дескриптор
релиза (`build.engine`), манифест (`meta.engine`) или `?engine=unity` для отладки. Команды шелл переводит в
`SendMessage("WebBridge", <метод>, <параметр>)` (`src/engine/unity/unityProtocol.ts`). Unity-игре нужен
только мост с этими методами. Ближайший образец в пакете — `MineSlotWebBridge`: тоже слот, тоже весь раунд
одним `ApplySpinResult`. Ниже — рецепт.

## Коротко

```csharp
// SlotCoinWebBridge — из рецепта ниже, лежит на GameObject "WebBridge".
_bridge.SpinResultReceived += result => StartCoroutine(PlayRound(result));

private IEnumerator PlayRound(WebSlotCoinSpinResultPayload result)
{
    for (int i = 0; i < result.Boards.Length; i++)
        yield return _reels.PlayBoard(result.Boards[i], result.ActionsOf(i));

    _bridge.NotifySpinReady(); // один раз, после последней доски
}
```

## Провод

Хост адресует один GameObject по имени — **`WebBridge`** — и вызывает публичный метод по имени.

### React → Unity

| Команда протокола | Метод `SendMessage` | Параметр |
|---|---|---|
| `ApplySpinResult` | `ApplySpinResult` | `string` — `SlotCoinSpinResult`, JSON |
| `ApplyGameConfig` | `ApplyGameConfig` | `string` — конфиг в обёртке road (`GameConfigPayload`); приходит, только если в конфиге сервера есть лесенка |
| `ApplyGameState` | `ApplyGameState` | `string` — настоящий хост slot-coin не шлёт; приёмник нужен для своего мока |
| `UpdateCoeffs` | `UpdateCoeffs` | `string` — лесенка road через запятую; слот её игнорирует |
| `SetAutoplay` | `SetAutoplay` | `int` — `1` / `0` |

Общие команды (`SetFastGame`, `ApplyWhiteLabel`, `OnDisabledPlayPressed`, метрики бет-бара, переводы,
ориентация, `OnTransitionScreen*`) принимают `WebBridgeBase<T>` и компоненты префаба — см.
[ядро Unity-моста](../../reference/unity-core.md).

### Unity → React

| Сообщение (`WebBridgeUtils.Send`) | Когда |
|---|---|
| `SpinReady` | доиграна последняя доска ответа — ровно один раз |
| `RequestGameConfig`, `RequestGameState` | старт сцены, если сцене нужен конфиг |
| `RequestPlay` | тап по сцене вместо Play (метод базы) |

Сообщений бонуса (`BonusActive`, `BonusEnded`, `BonusProgressSave_…`) и JSON покупки бонуса не слать: у
slot-coin бонуса нет, хост откроет шторку перехода или откажет в покупке.

## Подключение

1. Поставить пакет `com.pixi.webbridge` — [старт на Unity](../../guides/getting-started-unity.md).
2. Положить в проект игры классы из [рецепта](#рецепт-payload-классы), namespace `Modules.SlotCoin`.
3. **GameObject → WebBridge → Create MineSlotWebBridge** — создаёт объект `WebBridge` с общими
   компонентами (`LayoutWebBridge`, `ScreenOrientationWebBridge`, `AudioWebBridge`,
   `TranslationsWebBridge`, `WebBridgeUI`). Удалить `MineSlotWebBridge`, добавить `SlotCoinWebBridge`,
   сохранить как префаб игры. Мост режима на объекте — один.
4. Имя объекта — строго `WebBridge`.

## Рецепт: payload-классы

Классы зеркалят [`SlotCoinSpinResult`](README.md#slotcoinspinresult). Действия разной формы, поэтому
остаются деревом `JsonValue`; известные разбираются в свой класс через `JsonValue.ToObject<T>()`.

```csharp
using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.SlotCoin
{
    /// <summary>
    /// A slot-coin round as React sends it: normalized from the server reply, every board of the round,
    /// bonus respins included. Money stays the platform's decimal string.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebSlotCoinSpinResultPayload
    {
        [JsonName("betAmount")]
        public string BetAmount;

        [JsonName("coeff")]
        public string Coeff;

        [JsonName("currency")]
        public string Currency;

        [JsonName("isFinished")]
        public bool IsFinished;

        [JsonName("isWin")]
        public bool IsWin;

        [JsonName("winAmount")]
        public string WinAmount;

        [JsonName("rounds")]
        public int Rounds;

        // One 12-symbol string per board, see SlotCoinBoard.
        [JsonName("boards")]
        public string[] Boards = Array.Empty<string>();

        // One list per board; an action's shape depends on its "action" name.
        [JsonName("actions")]
        public JsonValue[][] Actions = Array.Empty<JsonValue[]>();

        // The list may be shorter than the boards: a board without actions is a plain spin.
        public JsonValue[] ActionsOf(int board) => board < Actions.Length ? Actions[board] : Array.Empty<JsonValue>();
    }

    [Preserve]
    [Serializable]
    public class WebSlotCoinBoardCoinPayload
    {
        // Board cell, reel * Rows + row.
        [JsonName("index")]
        public int Index;

        [JsonName("symbol")]
        public string Symbol;

        [JsonName("payout")]
        public string Payout;

        // Missing on some coins: the board symbol then tells the coefficient.
        [JsonName("coeff")]
        public string Coeff;
    }

    /// <summary>STRIKE_COINS_COLLECTION: the coins fly from their cells into the trigger's cell.</summary>
    [Preserve]
    [Serializable]
    public class WebSlotCoinCollectionPayload
    {
        [JsonName("action")]
        public string Action;

        [JsonName("triggerIndex")]
        public int TriggerIndex;

        [JsonName("coins")]
        public WebSlotCoinBoardCoinPayload[] Coins = Array.Empty<WebSlotCoinBoardCoinPayload>();
    }

    /// <summary>The known action names (protocol SLOT_COIN_ACTIONS). The list is open: skip the rest.</summary>
    public static class SlotCoinActions
    {
        public const string WinLines = "WIN_LINES";
        public const string StrikeCoinsCollection = "STRIKE_COINS_COLLECTION";
        public const string SuperStrikeCoinsAdded = "SUPER_STRIKE_COINS_ADDED";
        public const string SuperStrikeMultiplierAdded = "SUPER_STRIKE_MULTIPLIER_ADDED";
        public const string SuperStrikeJackpotAdded = "SUPER_STRIKE_JACKPOT_ADDED";
        public const string SuperStrikeMultiplierCollected = "SUPER_STRIKE_MULTIPLIER_COLLECTED";
        public const string EnhancedSuperStrike = "ENHANCED_SUPER_STRIKE";
        public const string PileOfGold = "PILE_OF_GOLD";
        public const string BonusRun = "BONUS_RUN";
        public const string BonusBuy = "BONUS_BUY";
        public const string BonusSpinsCount = "BONUS_SPINS_COUNT";
    }

    /// <summary>
    /// The board as the server lays it out: column-major, top to bottom. The payload does not carry the
    /// size; the cabinet is 3 reels by 4 rows.
    /// </summary>
    public static class SlotCoinBoard
    {
        public const int Reels = 3;
        public const int Rows = 4;
        public const int CellCount = Reels * Rows;

        public static int CellIndex(int reel, int row) => reel * Rows + row;
    }
}
```

## Рецепт: мост `SlotCoinWebBridge`

```csharp
using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.SlotCoin
{
    /// <summary>
    /// Bridge between React and a slot-coin game. React forwards the whole round in one ApplySpinResult;
    /// Unity plays every board in order and calls NotifySpinReady once, after the last one — React keeps the
    /// bet bar locked until then.
    /// </summary>
    [Preserve]
    public class SlotCoinWebBridge : WebBridgeBase<SlotCoinWebBridge>
    {
        // The road-wrapped config of the shared sync; a reel slot rarely needs it.
        public event Action<JsonValue> GameConfigReceived;

        // A round: play every board of it, then NotifySpinReady.
        public event Action<WebSlotCoinSpinResultPayload> SpinResultReceived;

        public JsonValue LastGameConfig { get; private set; }

        public WebSlotCoinSpinResultPayload LastSpinResult { get; private set; }

        public bool IsAutoplayEnabled { get; private set; }

        // The reels hold nothing between spins, so the initial sync is only for a scene that needs the config.
        // It stops on the first ApplyGameConfig or after ten attempts.
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

        // React entry point (SendMessage).
        public void ApplyGameConfig(string payload)
        {
            JsonValue config = WebBridgeUtils.DeserializePayload<JsonValue>(payload, nameof(ApplyGameConfig));
            if (config == null)
                return;

            HasReceivedInitialConfig = true;
            LastGameConfig = config;
            GameConfigReceived?.Invoke(config);
        }

        // React entry point (SendMessage): the slot-coin host has nothing to restore and does not send it.
        public void ApplyGameState(string payload)
        {
        }

        // React entry point (SendMessage): the whole round as JSON.
        public void ApplySpinResult(string payload)
        {
            WebSlotCoinSpinResultPayload result =
                WebBridgeUtils.DeserializePayload<WebSlotCoinSpinResultPayload>(payload, nameof(ApplySpinResult));
            if (result == null)
                return;

            LastSpinResult = result;
            SpinResultReceived?.Invoke(result);
        }

        // React entry point (SendMessage): the shared sync pushes a road ladder; a reel slot has none.
        public void UpdateCoeffs(string payload)
        {
        }

        // React entry point (SendMessage): 1 = autoplay on, 0 = off. Spins still arrive as ApplySpinResult.
        public void SetAutoplay(int value)
        {
            IsAutoplayEnabled = value != 0;
        }

        // Unity -> React: the last board of the round is played. React unlocks the bet bar on this signal.
        public void NotifySpinReady()
        {
            WebBridgeUtils.Send("SpinReady");
        }
    }
}
```

Замечания к рецепту:

- Пустые `UpdateCoeffs` и `ApplyGameState` — намеренно: без приёмника Unity пишет в консоль ошибку о
  пропавшем методе `SendMessage`.
- `BeginInitialWebSyncAfterSceneLoad()` работает только в WebGL-сборке; в редакторе это no-op.
- Не собирать с `WEBBRIDGE_MOCK`: mock-хоста нет, а с mock-дефайном база не спрашивает у React конфиг.

## Полный пример

Игра поверх моста: очередь раундов, проверка доски, сбор монет, один `NotifySpinReady`. Отрисовку делает
`SlotCoinReelsView` — ваша реализация.

```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using WebBridge;

namespace Modules.SlotCoin
{
    /// <summary>The engine's drawing: each coroutine ends when its animation has played.</summary>
    public abstract class SlotCoinReelsView : MonoBehaviour
    {
        public abstract IEnumerator Spin(string board);

        public abstract IEnumerator Collect(WebSlotCoinCollectionPayload collection);

        public abstract void ShowBroken(string reason);
    }

    public class SlotCoinGame : MonoBehaviour
    {
        // Symbols are keys, not numbers: '0'…'9', then 'a'…'m'.
        private const string Alphabet = "0123456789abcdefghijklm";

        [SerializeField] private SlotCoinWebBridge _bridge;
        [SerializeField] private SlotCoinReelsView _reels;

        private readonly Queue<WebSlotCoinSpinResultPayload> _rounds = new Queue<WebSlotCoinSpinResultPayload>();
        private Coroutine _runner;

        private void OnEnable()
        {
            _bridge.SpinResultReceived += OnSpinResult;
        }

        private void OnDisable()
        {
            _bridge.SpinResultReceived -= OnSpinResult;
            StopAllCoroutines();
            _runner = null;
            _rounds.Clear();
        }

        private void OnSpinResult(WebSlotCoinSpinResultPayload result)
        {
            _rounds.Enqueue(result);
            if (_runner == null)
                _runner = StartCoroutine(RunRounds());
        }

        private IEnumerator RunRounds()
        {
            while (_rounds.Count > 0)
                yield return PlayRound(_rounds.Dequeue());

            _runner = null;
        }

        private IEnumerator PlayRound(WebSlotCoinSpinResultPayload result)
        {
            string error = FindBoardError(result);
            if (error != null)
            {
                // Not shown truthfully, so not reported: the bar stays locked and the fault stays in sight.
                WebBridgeLogger.LogError($"[SlotCoinGame] ApplySpinResult rejected: {error}");
                _reels.ShowBroken(error);
                yield break;
            }

            for (int i = 0; i < result.Boards.Length; i++)
            {
                yield return _reels.Spin(result.Boards[i]);

                WebSlotCoinCollectionPayload collection = FindCollection(result.ActionsOf(i));
                if (collection != null)
                    yield return _reels.Collect(collection);
            }

            _bridge.NotifySpinReady();
        }

        private static string FindBoardError(WebSlotCoinSpinResultPayload result)
        {
            if (result.Boards.Length == 0)
                return "round without boards";

            for (int i = 0; i < result.Boards.Length; i++)
            {
                string board = result.Boards[i];
                if (board == null || board.Length != SlotCoinBoard.CellCount)
                    return $"board {i + 1} is not {SlotCoinBoard.CellCount} cells: {board}";

                foreach (char symbol in board)
                {
                    if (Alphabet.IndexOf(symbol) < 0)
                        return $"board {i + 1} holds unknown symbol '{symbol}'";
                }
            }

            return null;
        }

        // Only the coin collection is drawn here; the action list is open, so other actions are passed over.
        private static WebSlotCoinCollectionPayload FindCollection(JsonValue[] actions)
        {
            foreach (JsonValue action in actions)
            {
                if (WebBridgeUtils.ReadString(action, "action") == SlotCoinActions.StrikeCoinsCollection)
                    return action.ToObject<WebSlotCoinCollectionPayload>();
            }

            return null;
        }
    }
}
```

## Mock-режим в редакторе

Mock-хоста slot-coin в C# нет. Пока его нет, раунды в редакторе подают прямо в мост — так, как это сделал
бы React:

```csharp
using UnityEngine;

namespace Modules.SlotCoin
{
    /// <summary>Editor-only stand-in for React: feeds a recorded slot-coin round into the bridge.</summary>
    public class SlotCoinEditorFeed : MonoBehaviour
    {
        [SerializeField] private SlotCoinWebBridge _bridge;
        [SerializeField] private TextAsset _roundReply; // a SlotCoinSpinResult JSON

        [ContextMenu("Spin")]
        private void Spin() => _bridge.ApplySpinResult(_roundReply.text);
    }
}
```

Генератор досок настоящим алфавитом, с блокировкой до `SpinReady` и бонусным раундом из нескольких досок
уже написан на TS — `SlotCoinMockHost` (`js/webbridge/src/slot-coin/SlotCoinMockHost.ts`). Его логику
переносят в C#-мост по образцу `MineSlotMockHost` + `MineSlotMockSettings` + `MineSlotMockDebugIMGUI`
пакета: мок создаётся в `Start()` моста, когда `IsMockEnabled`, и отвечает на `Request*` сам. Как включается
mock — [mock-режим](../../concepts/mock-mode.md).

## Сборка WebGL и проверка

1. На сцене один объект `WebBridge` с общими компонентами и `SlotCoinWebBridge`; `SlotCoinGame`
   ссылается на него.
2. Сборка без `WEBBRIDGE_MOCK`.
3. Загрузить сборку в конфигуратор как игру режима `slot-coin`. Движок шелл берёт из сборки
   (`build.engine`); для отладки — `?engine=unity`.
4. На стенде по логам моста (`SetLoggingEnabled` с чит-панели):
   - на спин приходит один `ApplySpinResult` и уходит один `SpinReady` — после последней доски;
   - бонусный раунд из нескольких досок — тоже один `SpinReady`;
   - `UpdateCoeffs` и `SetAutoplay` приходят и не вызывают ошибок;
   - автоплей идёт спин за спином и останавливается кнопкой.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Команды не доходят, в консоли браузера ошибки `SendMessage` | объект назван иначе или моста нет на сцене | имя GameObject — строго `WebBridge`, на нём `SlotCoinWebBridge` |
| Ошибка об отсутствующем приёмнике `UpdateCoeffs` / `SetAutoplay` | нет метода | добавить приёмники из рецепта |
| Бар ожил посреди бонусных досок | `NotifySpinReady()` на каждой доске | один раз, после последней |
| Монеты летят не из тех ячеек | индекс считан по строкам | `SlotCoinBoard.CellIndex(reel, row)` = `reel * 4 + row` |
| Символы перепутаны | символ разобран как цифра (`char - '0'`) | символ — ключ таблицы, `a`…`m` не цифры |
| После спина открылась шторка перехода | игра шлёт `BonusActive` / `BonusEnded` | у slot-coin событий бонуса нет |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md) ·
  [Новый режим](../../guides/adding-a-mode.md)
- Образец в пакете: `unity/Assets/WebBridge/Runtime/MineSlotWebBridge.cs`
- Провод на стороне хоста: RoadFrontent `src/engine/unity/unityProtocol.ts`
