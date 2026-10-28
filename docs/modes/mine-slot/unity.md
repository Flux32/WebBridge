# Mine Slot — Unity

> Как подключить Mine Slot к игре на Unity (WebGL). Что значат команды и данные — в
> [обзоре режима](README.md).

## Коротко

```csharp
using Modules.MineSlot;
using UnityEngine;

public class MineSlotRoundPlayer : MonoBehaviour
{
    private void Start() => MineSlotWebBridge.Instance.SpinResultReceived += OnSpinResult;
    private void OnDestroy() => MineSlotWebBridge.Instance.SpinResultReceived -= OnSpinResult;

    private async void OnSpinResult(WebMineSlotSpinResultPayload result)
    {
        await PlayAllRounds(result);                    // все раунды ответа, на одном поле
        MineSlotWebBridge.Instance.NotifySpinReady();   // ровно один раз
    }
}
```

## Подключение

1. Пакет `com.pixi.webbridge` версии **1.1.0** и новее ([старт на Unity](../../guides/getting-started-unity.md)).
2. **GameObject → WebBridge → Create MineSlotWebBridge.** Пункт кладёт на сцену префаб
   `MineSlotWebBridge.prefab` и называет объект `WebBridge`. Это имя важно: React шлёт команды через
   `SendMessage("WebBridge", <метод>, <payload>)`. На сцене может быть только один мост: пункт меню не даст
   добавить второй, если на сцене уже есть Road-, Plinko-, PlinkoAztec- или Jumper-мост.
3. Игровой код зависит от моста, а не наоборот: мост ничего не знает про вашу сцену.

Классы режима — в namespace `Modules.MineSlot`. Общие типы (`WebBridgeBase<T>`, `JsonValue`,
`WebBridgeUtils`) — в `WebBridge` ([ядро Unity-моста](../../reference/unity-core.md)).

## API `MineSlotWebBridge`

`MineSlotWebBridge : WebBridgeBase<MineSlotWebBridge>` — синглтон (`MineSlotWebBridge.Instance`).
Стартовую синхронизацию он запускает сам в `Start()`: просит конфиг и состояние, пока React не ответит.

### События (React → игра)

| Событие C# | Тип аргумента | Метод `SendMessage` | Когда срабатывает |
|---|---|---|---|
| `SpinResultReceived` | `WebMineSlotSpinResultPayload` | `ApplySpinResult` | ответ сервера на спин, со всеми фри-спинами |
| `GameConfigReceived` | `JsonValue` | `ApplyGameConfig` | конфиг платформы как есть |
| `GameStateReceived` | `WebMineSlotSpinResultPayload` | `ApplyGameState` | состояние сессии; вне раунда `Status` = `none` |

Общие события базы (`FastGameChanged`, `WhiteLabelReceived`, `DisabledPlayPressed`, `CashoutPressed`, окна результата и
другие) — в [ядре Unity-моста](../../reference/unity-core.md).

### Методы (игра → React)

| Метод | Сообщение в React | Когда звать |
|---|---|---|
| `NotifySpinReady()` | `SpinReady` | после последнего раунда ответа — ровно один раз |
| `RequestPlay()` | `RequestPlay` | игрок тапнул по сцене вместо кнопки Play |
| `RequestGameConfig()`, `RequestGameState()` | `RequestGameConfig`, `RequestGameState` | вручную не нужны: их шлёт стартовая синхронизация |

### Свойства

| Свойство | Тип | Что хранит |
|---|---|---|
| `LastSpinResult` | `WebMineSlotSpinResultPayload` | последний ответ на спин |
| `LastGameState` | `WebMineSlotSpinResultPayload` | последнее состояние: из `ApplyGameState` или из ответа на спин |
| `LastGameConfig` | `JsonValue` | последний конфиг |
| `MockHost` | `MineSlotMockHost` | заменитель React в mock-режиме; `null` вне его |

## Payload-классы

`WebMineSlotSpinResultPayload : WebGameStateBase` — ответ сервера (`MineSlotSpinResult` протокола). Базовые
поля `GameState` (`Status`, `IsFinished`, `IsWin`, `WinAmount`, `Bet`) — в `WebGameStateBase`.

| Поле | JSON | Тип | Смысл |
|---|---|---|---|
| `BetAmount` | `betAmount` | `string` | цена спина (см. [«Цена и выплаты»](README.md#цена-и-выплаты)) |
| `Currency` | `currency` | `string` | валюта |
| `Coeff` | `coeff` | `float?` | коэффициент всего ответа |
| `Rounds` | `rounds` | `int` | 1 или 5 |
| `Boards` | `boards` | `string[]` | по 15 символов на раунд |
| `Field` | `field` | `string` | 30 блоков на начало ответа |
| `Pickaxes` | `pickaxes` | `MineSlotHitPayload[]` | падения кирок в порядке игры |
| `Tnt` | `tnt` | `MineSlotHitPayload[]` | падения динамита, после кирок |
| `Chests` | `chests` | `MineSlotChestPayload[]` | открытые сундуки |

Помощники: `GetBoardSymbol(round, reel, row)` и `GetFieldBlock(column, level)` — символ по координатам
без ручной арифметики индексов.

| Класс | Поля | Помощники |
|---|---|---|
| `MineSlotHitPayload` | `Round`, `Index` (клетка барабанов), `BrokenBlocks` | `Reel`, `Row` |
| `MineSlotBrokenBlockPayload` | `Index` (клетка поля), `Damage`, `Coeff` (`float?`), `Payout` (`string`) | `Column`, `Level` |
| `MineSlotChestPayload` | `Column` (`col`), `Coeff`, `Payout` | — |

Справочники алфавита — `MineSlotCodes.cs` и `MineSlotGeometry.cs`:

| Класс | Что даёт |
|---|---|
| `MineSlotSymbols` | символы барабанов (`WoodenPickaxe = '1'`, `Dynamite = 'd'`, `Scatter = 'b'`…), `IsPickaxe`, `GetPickaxeStrength`, `EnchantedStrength = 5`, `DynamiteDamage = 2`, `ScattersForBonus = 3`, `FreeSpins = 4` |
| `MineSlotBlocks` | блоки поля: прочность и коэффициент по коду |
| `MineSlotReels` | `CellIndex(reel, row)`, `ReelOf(cell)`, `RowOf(cell)` — 5 барабанов × 3 ряда |
| `MineSlotField` | `CellIndex(column, level)`, `ColumnOf(cell)`, `LevelOf(cell)` — 5 колонок × 6 уровней |

Деньги (`WinAmount`, `BetAmount`, `Payout`) остаются строками платформы. Для суммы на экране их нужно
разбирать `decimal.Parse(…, CultureInfo.InvariantCulture)`, а не `float`.

## Полный пример

```csharp
using System.Collections;
using System.Linq;
using Modules.MineSlot;
using UnityEngine;

public class MineSlotRoundPlayer : MonoBehaviour
{
    [SerializeField] private MineSlotReelsView _reels;    // ваши компоненты отрисовки
    [SerializeField] private MineSlotFieldView _field;
    [SerializeField] private MineSlotChestsView _chests;

    private MineSlotWebBridge Bridge => MineSlotWebBridge.Instance;

    // Start, а не OnEnable: на загрузке сцены OnEnable игрового объекта может прийти раньше Awake моста,
    // и Instance ещё пуст.
    private void Start()
    {
        Bridge.SpinResultReceived += OnSpinResult;
        Bridge.GameStateReceived += OnGameState;
    }

    private void OnDestroy()
    {
        Bridge.SpinResultReceived -= OnSpinResult;
        Bridge.GameStateReceived -= OnGameState;
    }

    // Тап по полю — ход, как кнопка Play: ставку и блокировку решает React.
    public void OnFieldTapped() => Bridge.RequestPlay();

    private void OnGameState(WebMineSlotSpinResultPayload state) => _reels.ShowIdle();

    private void OnSpinResult(WebMineSlotSpinResultPayload result) => StartCoroutine(PlayReply(result));

    private IEnumerator PlayReply(WebMineSlotSpinResultPayload result)
    {
        _field.Show(result.Field);                               // одно поле на все раунды ответа
        for (int round = 0; round < result.Rounds; round++)
        {
            yield return _reels.Spin(result.Boards[round]);
            foreach (MineSlotHitPayload hit in result.Pickaxes.Where(h => h.Round == round))
                yield return _field.Strike(hit);                 // сначала кирки
            foreach (MineSlotHitPayload hit in result.Tnt.Where(h => h.Round == round))
                yield return _field.Strike(hit);                 // потом динамит
        }

        foreach (MineSlotChestPayload chest in result.Chests)
            yield return _chests.Open(chest.Column, chest.Coeff);

        Bridge.NotifySpinReady();                                // один раз, после всего
    }
}
```

Если ответ не удалось разобрать или анимация упала, `NotifySpinReady()` не шлётся: бет-бар React остаётся
залоченным, и сбой сразу виден. Это дефект, который чинят в игре, а не маскируют
([правило](README.md#восстановление-и-ошибки)).

## Mock-режим в редакторе

В mock-режиме React не нужен: мост сам создаёт `MineSlotMockHost`, тот отвечает на синхронизацию, сдаёт
доски и поле, а на мост вешается отладочная панель `MineSlotMockDebugIMGUI` (свёрнута в перетаскиваемую
кнопку **MIN**). Она заменяет бет-бар:
**SPIN**, **BONUS** (купить бонус: базовый спин и 4 фри-спина), **RESET**, и строка состояния вроде
`1 round(s) in play: waiting for NotifySpinReady.`

**Включить:** **Tools → WebBridge → Enable Mock** (только Play Mode редактора, флаг в `EditorPrefs`).
**Tools → WebBridge → Enable Mock In Build** добавляет define `WEBBRIDGE_MOCK` и включает mock в сборке.
Такую сборку нельзя отдавать в шелл: она отвечает сама себе и не слушает React.

Настройки — поле **Mock** у компонента `MineSlotWebBridge` (`MineSlotMockSettings`):

| Поле | По умолчанию | Что задаёт |
|---|---|---|
| Bet Amount | `"1"` | ставка, как её форматирует бэкенд (`"1"`, `"0.5"`) |
| Currency | `USD` | валюта ответов |
| Decimal Places | `2` | знаков в деньгах ответов |
| Is White Label | выкл. | что mock отвечает на `RequestWhiteLabel` |

Mock держит «бар» занятым до `NotifySpinReady`. SPIN и BONUS в это время не работают, а тап по сцене
(`RequestPlay`) получает `DisabledPlayPressed`, как в настоящем шелле. Ответы иллюстративные: алфавит и
форма — как у бэкенда, урон посчитан упрощённо. Подробнее — в [mock-режиме](../../concepts/mock-mode.md).

## Сборка WebGL и проверка

1. Выключить mock в сборке (**Enable Mock In Build** без галочки).
2. Собрать WebGL (Brotli, без Decompression Fallback) и загрузить в конфигуратор: игра режима **Mine Slot** →
   «Билды» → «Сделать активным» → «Тестировщик». Параметр шелла `?localBuild=` грузит только веб-игры, Unity
   в шелл попадает через конфигуратор ([старт на Unity](../../guides/getting-started-unity.md)).
3. В консоли браузера (при включённом логе моста) на каждый спин ровно одна пара строк
   `[BridgeDebug][React->Unity] ApplySpinResult raw: …` → `SpinReady`.
4. Купить бонус в магазине шелла: 5 раундов на одном поле, `SpinReady` только после последнего.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| Команды не доходят до моста | объект на сцене называется не `WebBridge` | создавать мост пунктом меню или переименовать объект |
| Бет-бар не оживает после спина | `NotifySpinReady()` не вызван: исключение в корутине, ранний `yield break`, битый ответ | найти ошибку в консоли и исправить; успешный путь ответа обязан закончиться `NotifySpinReady()` |
| Бар ожил посреди бонуса | `NotifySpinReady()` после каждого раунда | один вызов после последнего раунда и сундуков |
| В WebGL пустые payload'ы | IL2CPP вырезал поля | payload-классы с `[Preserve]` и `[Serializable]` (как в пакете); свои классы — так же |
| Игра в шелле «играет сама» | сборка с `WEBBRIDGE_MOCK` | снять **Enable Mock In Build** и пересобрать |

## Смотрите также

- [Обзор режима](README.md) · [JS-версия](js.md)
- [Ядро Unity-моста](../../reference/unity-core.md) · [Старт на Unity](../../guides/getting-started-unity.md)
- Исходники: `unity/Assets/WebBridge/Runtime/MineSlotWebBridge.cs`, `WebMineSlotPayloads.cs`, `MineSlotCodes.cs`,
  `MineSlotGeometry.cs`, `MineSlotMock*.cs`
