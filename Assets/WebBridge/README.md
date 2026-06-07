# WebBridge

Unity-пакет для связи между React-фронтендом и Unity-игрой в WebGL-сборках.
Представляет собой набор singleton-компонентов («мостов»), которые
прослойкой передают сообщения между JS-стороной и игровым кодом.

> **Принцип архитектуры:** WebBridge — это **транспорт без геймплейной логики**.
> Игровые объекты зависят от мостов (подписываются на их события и вызывают их
> методы), но мосты **не зависят** от игровых объектов.

---

## Содержание

- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Как это работает](#как-это-работает)
- [Компоненты](#компоненты)
  - [GameWebBridge](#gamewebbridge)
  - [LayoutWebBridge](#layoutwebbridge)
  - [ScreenOrientationWebBridge](#screenorientationwebbridge)
  - [AudioWebBridge](#audiowebbridge)
  - [TranslationsWebBridge](#translationswebbridge)
  - [WebBridgeUI](#webbridgeui)
  - [CheatBridge](#cheatbridge)
  - [WebBridgeUtils](#webbridgeutils)
- [Подключение игровой логики](#подключение-игровой-логики)
- [Mock-режим](#mock-режим)
- [Cheats-режим](#cheats-режим)
- [LocalStorage](#localstorage)
- [Звуки](#звуки)
- [Меню редактора](#меню-редактора)
- [Типы payload](#типы-payload)
- [Протокол сообщений](#протокол-сообщений)

---

## Установка

Добавьте в `Packages/manifest.json`:

```json
"com.pixi.webbridge": "https://github.com/Flux32/WebBridge.git"
```

Или конкретную версию:

```json
"com.pixi.webbridge": "https://github.com/Flux32/WebBridge.git#v1.0.0"
```

**Зависимости** (подтягиваются автоматически):
- `com.unity.nuget.newtonsoft-json` — сериализация JSON-payload;
- `com.unity.modules.unitywebrequestaudio` — проигрывание звуков из файлов в редакторе.

---

## Быстрый старт

1. В Hierarchy нажмите **+ → WebBridge** (или перетащите префаб из
   `Packages/com.pixi.webbridge/Runtime/Prefabs/WebBridge.prefab`).
2. Префаб содержит GameObject с именем **`WebBridge`** и всеми компонентами-мостами.
   Имя объекта менять нельзя — React шлёт команды именно на GameObject `WebBridge`
   через `sendMessage('WebBridge', <method>, <param>)`.
3. Для локальной разработки без веб-сборки включите эмуляцию через
   **Tools → WebBridge → Enable Mock**.

---

## Как это работает

```
            sendMessage('WebBridge', method, param)
   React  ───────────────────────────────────────────►  WebBridge-компоненты
   (JS)   ◄───────────────────────────────────────────  (Unity, GameObject "WebBridge")
                 SendToReact(string message)                        │
                                                                    │ C#-события
                                                                    ▼
                                                            Игровой код
```

- **React → Unity.** React вызывает методы компонентов через стандартный
  `SendMessage` Unity. Метод парсит строку/JSON в типизированный payload и
  поднимает C#-событие.
- **Unity → React.** Любой мост вызывает `WebBridgeUtils.Send(message)`, который
  в WebGL дергает JS-функцию `SendToReact(string)` (импортируется через
  `[DllImport("__Internal")]`). В редакторе `Send` просто пишет лог.
- **Игровой код** подписывается на события мостов и вызывает их публичные методы.
  Сами мосты ничего не знают про игру.

Все мосты — синглтоны (`Instance`), защищены от дублирования в `Awake`,
помечены атрибутом `[Preserve]` (защита от IL2CPP-стриппинга в WebGL).
Префаб содержит шесть компонентов: `GameWebBridge`, `LayoutWebBridge`,
`ScreenOrientationWebBridge`, `AudioWebBridge`, `TranslationsWebBridge`,
`WebBridgeUI`.

| Компонент | Зона ответственности |
|---|---|
| `GameWebBridge` | Конфиг игры, состояние раунда, результаты ходов, коэффициенты, ставки, кешаут, бонус-система, баланс, white-label, рестор после F5 |
| `LayoutWebBridge` | Видимость и интерактивность UI-элементов (бет-бары, логотип, кнопка настроек, баланс-панель), метрики мобильного бет-бара |
| `ScreenOrientationWebBridge` | Ориентация экрана (desktop / mobile) |
| `AudioWebBridge` | Запросы на проигрывание звуков и музыки |
| `TranslationsWebBridge` | Локализация (словарь переводов от React) |
| `WebBridgeUI` | Жизненный цикл переходного экрана (TransitionScreen), которым владеет React |
| `CheatBridge` | Статический мост для отладочного управления RNG (только при включённых читах) |
| `WebBridgeUtils` | Статические утилиты: отправка сообщений, парсинг, localStorage, флаги Mock/Cheats |

---

## Компоненты

### GameWebBridge

Главный мост игрового цикла. Namespace — `Modules.Road`.

#### События (Unity-код подписывается)

| Событие | Аргументы | Когда срабатывает |
|---|---|---|
| `GameConfigReceived` | `WebGameConfigPayload` | Получен конфиг игры от React |
| `GameStateReceived` | `WebGameStatePayload` | Обновилось состояние игры |
| `StepResultReceived` | `WebGameStatePayload` | Получен «сырой» результат хода |
| `StepResultActionReady` | `StepResultAction` | Результат хода обработан и готов для геймплея (`IsWin`, `BonusStepTriggered`) |
| `CoefficientsReceived` | `float[]` | Пришли новые коэффициенты дорожки (поднимается только при изменении) |
| `SpinRequested` | `int` | Запрос спина не в mock-режиме (win=1, lose=0). Только из редактора (`DoSpin`) |
| `RestartRequested` | `RestartReason, string` | React просит перезапустить раунд. Несёт причину (`Win`/`Cashout`/`Lose`/`None`) и опциональную сумму выигрыша. **Кешаут приходит сюда с `reason == Cashout` и суммой** — отдельного события на кешаут нет |
| `BonusModePurchased` | `string, int` | Бонус куплен (modeId, кол-во позиций) |
| `BonusModePurchaseFailed` | `string` | Покупка бонуса не удалась (modeId) |
| `GameRestored` | `WebGameStatePayload` | Игра восстановлена (рестор после перезагрузки страницы) |
| `BonusStartRequested` | `WebBonusStartPayload` | Единая точка входа в бонус: и при свежей покупке, и при F5-восстановлении |
| `MockDifficultyChanged` | `string` | Сменилась сложность в mock-режиме |
| `BalanceReceived` | `float` | Получен баланс игрока (из конфига) |
| `WhiteLabelReceived` | `bool` | Пришёл флаг white-label (`true` — без брендинга) |

#### Методы React → Unity (через `SendMessage`)

| Метод | Параметр | Описание |
|---|---|---|
| `ApplyGameConfig(json)` | JSON `WebGameConfigPayload` | Применить конфиг игры |
| `ApplyGameState(json)` | JSON `WebGameStatePayload` | Применить состояние игры |
| `ApplyStepResult(json)` | JSON `WebGameStatePayload` | Применить результат хода |
| `CreateStep(json)` | JSON `WebGameStatePayload` | Создать ход (в mock — генерирует локально; умеет ветку рестора) |
| `RestoreGame(json)` | JSON `WebGameRestorePayload` | Восстановить игру (config + state) после F5 |
| `UpdateCoeffs(csv)` | строка `"1.1,1.2,1.4"` | Обновить коэффициенты (CSV, InvariantCulture) |
| `RestartRound(payload)` | `"<reason>\|<amount>"` напр. `"cashout\|$5.00"` | Перезапустить раунд |
| `StartBonus(json)` | JSON `WebBonusStartPayload` | Войти в бонус (покупка или F5-рестор) |
| `ApplyBonusPurchaseResult(json)` | JSON `WebBonusPurchasePayload` | Результат покупки бонуса |
| `ApplyWhiteLabel(int)` | `1` / `0` | Ответ React на `RequestWhiteLabel`: 1 = white-label, 0 = брендированная |
| `DoSpin(int win)` | `1` / `0` | **Только в редакторе** (`#if UNITY_EDITOR`). Отладочный спин без бэкенда |

> `Request*`-методы (`RequestGameConfig`, `RequestGameState`, `RequestActiveGameState`,
> `RequestWhiteLabel`) — это **исходящие запросы, которые вызывает Unity**, а не точки
> входа React → Unity. См. раздел ниже.

#### Методы Unity → React (вызывает игровой код / сам мост)

Это **исходящие** методы: Unity вызывает их, чтобы что-то отправить или запросить у
React. `Request*`-методы — запрос-ответ: Unity шлёт запрос, React отвечает вызовом
соответствующего `Apply*`-метода.

| Метод | Что шлёт в React | Ответ React |
|---|---|---|
| `RequestGameConfig()` | `RequestGameConfig` | → `ApplyGameConfig(json)` |
| `RequestGameState()` | `RequestGameState` | → `ApplyGameState(json)` |
| `RequestActiveGameState()` | `RequestActiveGameState` | → `RestoreGame` / `ApplyGameState`, если есть активный раунд |
| `RequestWhiteLabel()` | `RequestWhiteLabel` | → `ApplyWhiteLabel(int)` |
| `SaveBonusAutoPlayProgress(progress)` | `BonusProgressSave_{json}` — сохранить прогресс автоигры бонуса | — |
| `ClearBonusAutoPlayProgress()` | `BonusProgressClear` | — |
| `NotifyBonusActive()` | `BonusActive` | — |
| `NotifyBonusEnded()` | `BonusEnded` (React по нему открывает TransitionScreen на завершение бонуса) | — |
| `NotifyBonusCleared()` | `BonusCleared` | — |

> **Кто вызывает `Request*`.** На старте сцены сам `GameWebBridge` запускает
> бут-синхронизацию (`RequestGameConfig` + `RequestGameState` с повторами, пока не
> придёт конфиг). Игровой код дополнительно вызывает `RequestActiveGameState()`
> после того, как подпишется на `GameRestored`, чтобы безопасно восстановить активную
> игру. В mock-режиме `Request*` не шлют сообщений, а сразу применяют мок-данные локально.

Также есть хелперы без отправки в React:
- `ResolveBonusModesForShop()` — собирает список режимов бонуса (`WebBonusShopModePayload`) из конфига для UI магазина.
- `ResolveBonusPositionsForAutoPlay()` — позиции бонуса для автоигры (из последнего результата либо из мок-настроек).
- `ResetMockRound()` — сброс мок-раунда.

#### Свойства

| Свойство | Тип | Описание |
|---|---|---|
| `LastGameConfig` | `WebGameConfigPayload` | Последний конфиг |
| `LastGameState` | `WebGameStatePayload` | Последнее состояние |
| `LastStepResult` | `WebGameStatePayload` | Последний результат хода |
| `LastBalance` | `float?` | Последний баланс |
| `CurrentIsWhiteLabel` | `bool?` | Кешированный флаг white-label (доступен и тем, кто подписался после ответа) |
| `CurrentMockDifficulty` | `string` | Текущая сложность в mock |
| `IsRestoring` | `bool` | Идёт ли восстановление |
| `SuppressCoefficientUpdates` | `bool` (set) | Подавить поднятие `CoefficientsReceived` |
| `CanProcessMockSpin` | `Func<bool>` (set) | Необязательный гейт для мок-спинов |

---

### LayoutWebBridge

Управляет видимостью и интерактивностью HTML-оверлеев React поверх Unity-канваса.

#### События

| Событие | Аргументы | Описание |
|---|---|---|
| `MobileBetBarViewportChanged` | `WebMobileBetBarViewportPayload` | Сменились размеры/координаты мобильного бет-бара (в нормализованных viewport-координатах 0..1) |
| `BetBarHideStateChanged` | `WebBetBarHideStatePayload` | Сменилась видимость бет-баров (desktop/mobile) |

#### Методы

```csharp
SetHideDesktopBetBar(bool isHidden)
SetHideMobileBetBar(bool isHidden)
SetHideMobileLastWin(bool isHidden)
SetHideSettingsMenuButton(bool isHidden)
SetHideLogo(bool isHidden)
SetHideBottomBalancePanel(bool isHidden)
HideBottomBalancePanel()              // = SetHideBottomBalancePanel(true)
ShowBottomBalancePanel()              // = SetHideBottomBalancePanel(false)
SetBetBarInteractable(bool isInteractable)
SetMobileBetBarInteractable(bool isInteractable)

BeginBatch() / EndBatch()             // батчинг: SyncUiVisibility откладывается до закрытия батча
SyncUiVisibility()                    // шлёт в React UiVisibility_{json}
RequestBetBarViewportMetrics()        // шлёт в React RequestBetBarViewportMetrics
SetMobileBetBarViewportMetrics(json)  // React → Unity: метрики мобильного бет-бара
```

Любой `SetHide*` при изменении значения автоматически вызывает `SyncUiVisibility()`.
`BeginBatch`/`EndBatch` позволяют изменить несколько флагов и отправить в React
один общий апдейт (батчи вложенные — синхронизация происходит при закрытии внешнего).

#### Свойства

Геттеры состояния: `IsDesktopBetBarHidden`, `IsMobileBetBarHidden`,
`IsMobileLastWinHidden`, `IsSettingsMenuButtonHidden`, `IsLogoHidden`,
`IsBottomBalancePanelHidden`.

Метрики мобильного бет-бара (viewport 0..1): `MobileBetBarViewportWidth`,
`MobileBetBarViewportHeightEnd`, `MobileBetBarViewportWithoutBonusHeightEnd`,
`MobileBetBarBonusButtonRight`, `MobileBetBarRight`,
`MobileBetBarBonusProgressIndicatorTopLeft/TopRight/BottomLeft/BottomRight`,
`HasMobileBetBarBonusProgressIndicator`.

---

### ScreenOrientationWebBridge

Сообщает игре, в какой ориентации сейчас UI.

```csharp
public enum ScreenOrientationType { Desktop = 0, Mobile = 1 }

// React → Unity:
ChangeOrientation(int orientation)   // > 0 → Mobile, иначе Desktop

// Событие:
event Action<ScreenOrientationType> OrientationChanged;

// Свойство:
ScreenOrientationType CurrentOrientation { get; }
```

**Mock (только в редакторе).** Если включён mock, каждый кадр вычисляет ориентацию
по соотношению сторон `Screen.width / Screen.height`: при значении `<= _mockMobileAspectRatio`
(сериализуемое поле, по умолчанию `1.1`) считает ориентацию мобильной. Событие
поднимается только при смене ориентации.

---

### AudioWebBridge

Прослойка для звука. Звуки идентифицируются строковым ключом.

```csharp
PlaySound(string soundKey, float? volume = null)   // в WebGL шлёт PlaySound_{soundKey}[|{volume}]
PlayMusic(string soundKey, float? volume = null)   // в WebGL шлёт PlayMusic_{soundKey}[|{volume}]
```

**Громкость** (`volume`) — необязательный параметр в диапазоне `0..1` (значения
зажимаются через `Clamp01`). Если он не задан, сообщение остаётся прежним
(`PlaySound_{soundKey}`) — обратная совместимость сохранена. Если задан, к ключу
добавляется суффикс `|{volume}`, например `PlaySound_Jump|0.5`. Значение
форматируется в инвариантной культуре (разделитель дробной части — точка).

**В редакторе** мост не шлёт сообщения, а проигрывает звук локально: грузит
`{soundKey}.mp3` из папки, заданной в ассете `SoundKeys` (`SoundFolderPath`),
кеширует `AudioClip` и проигрывает (`PlaySound` — one-shot на SFX-источнике,
`PlayMusic` — зацикленно на music-источнике), применяя `volume`. Это позволяет
слышать звук при локальной разработке без React. См. [Звуки](#звуки).

---

### TranslationsWebBridge

Локализация: React передаёт словарь `ключ → перевод`.

```csharp
// React → Unity:
ApplyTranslations(string json)   // JSON-объект { "key": "value", ... }

// Unity → React:
RequestTranslations()            // шлёт RequestTranslations

// Чтение:
bool TryGet(string key, out string value)
string Get(string key)           // вернёт сам key, если перевода нет

// Событие / свойство:
event Action TranslationsChanged;
bool HasTranslations { get; }
```

При применении переводов из значений вырезаются невидимые управляющие символы
(zero-width / BiDi: ZWSP, ZWNJ, LRM, RLM, BOM и т.п.) — иначе TMP рисует
«tofu»-квадраты для шрифтов без соответствующих глифов.

---

### WebBridgeUI

Отражает жизненный цикл переходного экрана (TransitionScreen), которым **полностью
владеет React**. React сам проигрывает анимации IN/IDLE/OUT и уведомляет Unity о
каждой фазе. Unity открытие/закрытие не инициирует.

```csharp
// React → Unity (фазы перехода):
OnTransitionScreenOpenStarted()
OnTransitionScreenOpenFinished()
OnTransitionScreenCloseStarted()
OnTransitionScreenCloseFinished()

// События для игрового кода:
event Action TransitionScreenOpenStarted;
event Action TransitionScreenOpenFinished;
event Action TransitionScreenCloseStarted;
event Action TransitionScreenCloseFinished;

// Свойство:
bool IsTransitionScreenOpen { get; }   // true между OpenStarted и CloseFinished
```

---

### CheatBridge

Статический мост для отладочного управления RNG бэкенда. Используется отладочной
панелью `CheatDebugIMGUI`. Активен только при включённых читах (см. [Cheats](#cheats-режим)).

```csharp
CheatBridge.SendOn(int nonce);   // в WebGL: window.postMessage({ isActive: true, nonce })
CheatBridge.SendOff();           // в WebGL: window.postMessage({ isActive: false })
```

> В отличие от остальных сообщений (которые идут через `SendToReact`), читы
> отправляются напрямую через `window.postMessage`.

---

### WebBridgeUtils

Статический набор утилит, общий для всех мостов.

```csharp
static bool IsMockEnabled   { get; }   // состояние mock-режима (read-only)
static bool IsCheatsEnabled { get; }   // состояние cheats-режима (read-only)

static void Send(string message);                 // отправка в React (SendToReact) + лог

// localStorage React-страницы (в редакторе — заглушки):
static void   SaveToLocalStorage(string key, string value);
static string LoadFromLocalStorage(string key);   // null, если нет
static void   RemoveFromLocalStorage(string key);

// Парсинг payload:
static T DeserializePayload<T>(string json, string methodName) where T : class;
static string ReadString(JObject source, params string[] propertyNames);
static int? ReadInt(JObject source, params string[] propertyNames);
```

`DeserializePayload` устойчив к тому, что React иногда оборачивает payload в
массив: если на входе JSON-массив, берётся его первый элемент.

---

## Подключение игровой логики

Мосты поднимают события — игровой код подписывается на них. Зависимость
направлена от игры к мосту, не наоборот.

```csharp
using Modules.Road;
using UnityEngine;

public class RoadController : MonoBehaviour
{
    private void OnEnable()
    {
        GameWebBridge.Instance.CoefficientsReceived += OnCoefficients;
        GameWebBridge.Instance.StepResultActionReady += OnStepResult;
        GameWebBridge.Instance.RestartRequested += OnRestartRequested;
        ScreenOrientationWebBridge.Instance.OrientationChanged += OnOrientation;
    }

    private void OnDisable()
    {
        GameWebBridge.Instance.CoefficientsReceived -= OnCoefficients;
        GameWebBridge.Instance.StepResultActionReady -= OnStepResult;
        GameWebBridge.Instance.RestartRequested -= OnRestartRequested;
        ScreenOrientationWebBridge.Instance.OrientationChanged -= OnOrientation;
    }

    private void OnCoefficients(float[] coefficients)
    {
        // Сгенерировать шаги дорожки по коэффициентам.
    }

    private void OnStepResult(StepResultAction action)
    {
        // action.IsWin, action.BonusStepTriggered
    }

    private void OnRestartRequested(RestartReason reason, string winAmount)
    {
        // reason: Win / Cashout / Lose / None — решить, что показать перед перезапуском.
    }

    private void OnOrientation(ScreenOrientationType orientation)
    {
        bool isMobile = orientation == ScreenOrientationType.Mobile;
        // Переключить раскладку.
    }
}
```

Воспроизведение звука из игры:

```csharp
AudioWebBridge.Instance.PlaySound(_jumpSoundKey);
```

---

## Mock-режим

Mock-режим локально эмулирует ответы React, чтобы тестировать игру без веб-сборки.
Состояние читается напрямую из `WebBridgeUtils.IsMockEnabled` — переопределить его
из кода нельзя.

### Включение в редакторе

**Tools → WebBridge → Enable Mock** — хранится в `EditorPrefs`, работает только в
Play Mode редактора.

При включённом mock `GameWebBridge` в `Start` инициализирует мок-данные и
добавляет отладочную панель `MockDebugIMGUI`. Клавиша **D** переключает сложность
по кругу.

### Включение в сборке

**Tools → WebBridge → Enable Mock In Build** — добавляет символ компиляции
`WEBBRIDGE_MOCK`. Пока он задан, `IsMockEnabled` возвращает `true` и в билде.
**Не забудьте снять перед продакшен-сборкой.**

### Источник мок-данных

Коэффициенты по сложностям берутся из ScriptableObject `MockConfig`
(`Resources/MockConfig`), редактируется через **Tools → WebBridge → MockConfig**.
По умолчанию заданы сложности `easy` / `medium` / `hard`.

Параметры эмуляции настраиваются прямо в инспекторе `GameWebBridge` (секция `Mock`):

| Поле | Описание |
|---|---|
| `Mock Bonus Counts` | Режимы (Difficult / Count / Price / Currency) |
| `Mock Lose Chance` | Вероятность проигрыша хода (0–1) |
| `Mock Bonus Step Trigger Chance` | Вероятность триггера бонус-шага (0–1) |
| `Mock Bonus Steps Threshold` | Сколько бонус-шагов нужно для активации бонус-игры |
| `Mock Bet Amount` | Эмулируемая ставка |
| `Mock Win Decimals` | Знаков после запятой в строке выигрыша |
| `Mock Bonus Positions` | Позиции бонуса по умолчанию |
| `Mock Is White Label` | Значение, возвращаемое на `RequestWhiteLabel` в редакторе |

`ScreenOrientationWebBridge` имеет своё мок-поле: `Mock Mobile Aspect Ratio`.

---

## Cheats-режим

Включает отладочную панель `CheatDebugIMGUI` для управления RNG бэкенда (выбор
сложности и сценария → отправка `nonce` через `CheatBridge`).

- **Tools → WebBridge → Enable Cheats** — `EditorPrefs`, только Play Mode редактора.
- **Tools → WebBridge → Enable Cheats In Build** — символ компиляции `WEBBRIDGE_CHEATS`
  (тоже снимать перед продакшеном).

Флаг читается через `WebBridgeUtils.IsCheatsEnabled`; панель добавляется
`GameWebBridge` в `Start`. После каждого раунда в панели нужно нажать **OFF** —
иначе следующая ставка переиспользует тот же `nonce`.

---

## LocalStorage

Так как Unity-сохранения в WebGL ненадёжны, бридж умеет писать в `localStorage`
React-страницы через JS-плагин `WebBridgeStorage.jslib`:

```csharp
WebBridgeUtils.SaveToLocalStorage("key", "value");
string value = WebBridgeUtils.LoadFromLocalStorage("key"); // null, если нет
WebBridgeUtils.RemoveFromLocalStorage("key");
```

В редакторе это заглушки (`Load` всегда возвращает `null`), реальная работа —
только в WebGL-сборке.

---

## Звуки

Звуки задаются строковыми ключами. Чтобы выбирать их в инспекторе из выпадающего
списка, повесьте атрибут `[WebBridgeSound]` на строковое поле:

```csharp
using Modules.Road;
using UnityEngine;

public class Sample : MonoBehaviour
{
    [SerializeField, WebBridgeSound] private string _sampleSound;

    private void Test() => AudioWebBridge.Instance.PlaySound(_sampleSound);
}
```

- Доступные ключи и путь к папке со звуками хранятся в ScriptableObject `SoundKeys`.
- Редактируются через **Tools → WebBridge → Sounds**.
- Drawer `WebBridgeSoundDrawer` рисует выпадающий список ключей из `SoundKeys`.
- В редакторе `AudioWebBridge` грузит `{ключ}.mp3` из `SoundFolderPath` и проигрывает
  локально; в WebGL — шлёт `PlaySound_{ключ}` / `PlayMusic_{ключ}` в React.

---

## Меню редактора

| Пункт меню | Действие |
|---|---|
| **GameObject → WebBridge** | Создать инстанс префаба WebBridge в сцене |
| **Tools → WebBridge → Enable Mock** | Вкл/выкл mock в Play Mode (EditorPrefs) |
| **Tools → WebBridge → Enable Mock In Build** | Вкл/выкл символ `WEBBRIDGE_MOCK` |
| **Tools → WebBridge → Enable Cheats** | Вкл/выкл читы в Play Mode (EditorPrefs) |
| **Tools → WebBridge → Enable Cheats In Build** | Вкл/выкл символ `WEBBRIDGE_CHEATS` |
| **Tools → WebBridge → Sounds** | Окно редактирования `SoundKeys` |
| **Tools → WebBridge → MockConfig** | Окно редактирования `MockConfig` |

---

## Типы payload

JSON-имена полей указаны в `[JsonProperty]`. Ниже — C#-имена с пояснениями.

### StepResultAction

Обработанный результат хода (событие `StepResultActionReady`):

```csharp
class StepResultAction
{
    bool IsWin;               // выигрышный ли ход
    bool BonusStepTriggered;  // собран ли бонус-шаг
}
```

### WebGameConfigPayload

```csharp
class WebGameConfigPayload
{
    float[] Coefficients;                  // "coefficients"
    Dictionary<string, int> BonusCounts;   // "bonusCounts"
    JToken BonusModes;                      // "bonusModes" (объект или массив)
    string Currency;                        // "currency"
    float? MinBetAmount;                    // "minBetAmount"
    float? MaxBetAmount;                    // "maxBetAmount"
    float? Balance;                         // "balance"
}
```

### WebGameStatePayload

```csharp
class WebGameStatePayload
{
    string Status;                // "status": "in-game" | "win" | "lose"
    int? Step;                    // "lineNumber" — номер хода/линии
    int[] BonusStepsCollected;    // "coinsCollected"
    bool? BonusStepTriggered;     // "coinsTriggered"
    WebBonusGamePayload BonusGame;// "bonusGame"
    bool? IsWinMain;              // "isWinMain"
}
```

### WebBonusGamePayload

```csharp
class WebBonusGamePayload
{
    float BonusTotalCoefficient;  // "bonusTotalCoefficient"
    string BonusTotalWin;         // "bonusTotalWin"
    int[] BonusPositions;         // "bonusPositions"
    int? CompletedIterations;     // "completedIterations"
    float? AccumulatedCoefficient;// "accumulatedCoefficient"
    float? AccumulatedWin;        // "accumulatedWin"
    float? BetAmount;             // "betAmount"
    string BonusCurrency;         // "bonusCurrency"
    int? CurrentStep;             // "currentStep"
    string BonusCoefficients;     // "bonusCoefficients"
    string Difficulty;            // "difficulty"
}
```

### WebBonusStartPayload

Единый payload для `StartBonus` — покрывает и свежую покупку
(`completedIterations=0`, `accumulated*=0`), и F5-рестор (значения из сохранённого
прогресса):

```csharp
class WebBonusStartPayload
{
    string ModeId; int[] Positions; string BonusCoefficients; string Difficulty;
    float BetAmount; string Currency; float BonusTotalCoefficient; string BonusTotalWin;
    int CompletedIterations; float AccumulatedCoefficient; float AccumulatedWin; int CurrentStep;
}
```

### WebBonusAutoPlayProgress

Прогресс автоигры бонуса, который Unity сохраняет в React (`SaveBonusAutoPlayProgress`):

```csharp
class WebBonusAutoPlayProgress
{
    int[] Positions; int CompletedIterations; int TotalIterations;
    float AccumulatedCoefficient; float AccumulatedWin; float BetAmount;
    string Currency; int CurrentStep; string Difficulty; string BonusCoefficients;
}
```

### Прочие payload

- `WebBonusPurchasePayload` — результат покупки бонуса (`ModeId`, `IsPurchased`, `Error`, `BonusGame`).
- `WebBonusShopModePayload` — режим для UI магазина (`ModeName`, `Price`, `Currency`, `BonusAmount`).
- `WebUiVisibilityPayload` — флаги видимости/интерактивности UI (отправляется как `UiVisibility_{json}`).
- `WebMobileBetBarViewportPayload`, `WebViewportPoint`, `WebViewportRect` — метрики мобильного бет-бара.
- `WebBetBarHideStatePayload` — состояние видимости бет-баров.
- `WebGameRestorePayload` — `{ config, state }` для `RestoreGame`.

### RestartReason

```csharp
enum RestartReason { None = 0, Win = 1, Cashout = 2, Lose = 3 }
```

---

## Протокол сообщений

GameObject в Unity называется **`WebBridge`**. React шлёт команды через
`sendMessage('WebBridge', <method>, <param>)`, а принимает — слушая событие
`SendToReact` (строка).

### Unity → React (`WebBridgeUtils.Send`)

| Сообщение | Источник |
|---|---|
| `PlaySound_{key}` или `PlaySound_{key}\|{volume}` | `AudioWebBridge.PlaySound` |
| `PlayMusic_{key}` или `PlayMusic_{key}\|{volume}` | `AudioWebBridge.PlayMusic` |
| `UiVisibility_{json}` | `LayoutWebBridge.SyncUiVisibility` |
| `RequestBetBarViewportMetrics` | `LayoutWebBridge.RequestBetBarViewportMetrics` |
| `RequestGameConfig` | `GameWebBridge.RequestGameConfig` |
| `RequestGameState` | `GameWebBridge.RequestGameState` |
| `RequestActiveGameState` | `GameWebBridge.RequestActiveGameState` |
| `RequestWhiteLabel` | `GameWebBridge.RequestWhiteLabel` |
| `BonusProgressSave_{json}` | `GameWebBridge.SaveBonusAutoPlayProgress` |
| `BonusProgressClear` | `GameWebBridge.ClearBonusAutoPlayProgress` |
| `BonusActive` | `GameWebBridge.NotifyBonusActive` |
| `BonusEnded` | `GameWebBridge.NotifyBonusEnded` |
| `BonusCleared` | `GameWebBridge.NotifyBonusCleared` |
| `RequestTranslations` | `TranslationsWebBridge.RequestTranslations` |

Отдельно, **не** через `SendToReact`, а через `window.postMessage` (читы):
`{ isActive: true, nonce }` / `{ isActive: false }` — `CheatBridge`.

### React → Unity (`SendMessage` на GameObject `WebBridge`)

Методы перечислены в таблицах компонентов выше. Сводно:

- **GameWebBridge:** `ApplyGameConfig`, `ApplyGameState`, `ApplyStepResult`,
  `CreateStep`, `RestoreGame`, `UpdateCoeffs`, `RestartRound`, `StartBonus`,
  `ApplyBonusPurchaseResult`, `ApplyWhiteLabel`.
  (`Request*` — это исходящие запросы Unity, см. таблицу Unity → React выше.)
- **LayoutWebBridge:** `SetMobileBetBarViewportMetrics`, `SetHide*`, `SetBetBarInteractable`,
  `SetMobileBetBarInteractable`, `SyncUiVisibility`.
- **ScreenOrientationWebBridge:** `ChangeOrientation`.
- **TranslationsWebBridge:** `ApplyTranslations`.
- **WebBridgeUI:** `OnTransitionScreenOpenStarted`, `OnTransitionScreenOpenFinished`,
  `OnTransitionScreenCloseStarted`, `OnTransitionScreenCloseFinished`.

---

## Лицензия

Внутреннее использование.
