# Старт на Unity

> От пустого Unity-проекта до игры, которая играет раунд в React-шелле: поставить пакет
> `com.pixi.webbridge`, положить мост на сцену, подписать игру, прогнать в редакторе на mock, собрать WebGL и
> запустить в шелле — локально и на стенде тестировщика. Справочник API — [ядро Unity-моста](../reference/unity-core.md).

## Коротко

```json
// Packages/manifest.json
"com.pixi.webbridge": "https://github.com/Flux32/WebBridge.git?path=unity/Assets/WebBridge#main"
```

1. Поставить пакет (строка выше) и добавить в игру `Assets/Plugins/WebGL/WebSender.jslib` с `SendToReact`.
2. **GameObject → WebBridge → Create &lt;Mode&gt;WebBridge** — объект `WebBridge` на первой сцене.
3. Подписаться на события моста из своего `MonoBehaviour`.
4. **Tools → WebBridge → Enable Mock** → Play: раунд в редакторе без шелла.
5. Собрать WebGL (Brotli), загрузить ZIP в конфигуратор, нажать **Тестировщик**.

## 1. Что нужно

| Что | Версия | Зачем |
|---|---|---|
| Unity | 6 (`6000.0` и новее — поле `unity` в `package.json` пакета) | минимальная версия пакета |
| Модуль WebGL Build Support | под ту же версию | сборка для шелла |
| Доступ к `github.com/Flux32/WebBridge` | — | UPM тянет пакет из git |
| Для запуска в шелле | games-configurator (стенд или локальный) и RoadFrontent | см. [шаг 8](#8-запустить-в-шелле) |

Как устроена связка хост ↔ игра, — в [архитектуре](../concepts/architecture.md). Что делает режим и что хост
шлёт в каком порядке, — в `docs/modes/<id>/README.md`.

## 2. Поставить пакет

Пакет лежит не в корне репозитория, а в `unity/Assets/WebBridge`, поэтому git-URL несёт `?path=`. Строка в
`Packages/manifest.json` → `dependencies` (или **Window → Package Manager → + → Add package from git URL**):

| Вариант | Строка | Когда |
|---|---|---|
| Последний `main` | `https://github.com/Flux32/WebBridge.git?path=unity/Assets/WebBridge#main` | так подключены MegaBlockRemake и MegaGrab |
| По тегу | `…?path=unity/Assets/WebBridge#unity-v1.0.0` | воспроизводимая сборка; теги пакета — `unity-v<x.y.z>` |
| По коммиту | `…?path=unity/Assets/WebBridge#<sha>` | закрепить версию, на которую тега нет |
| Локальная папка | `file:/abs/path/to/WebBridge/unity/Assets/WebBridge` | правка пакета вместе с игрой |

Текущая версия пакета — **1.1.0** (в ней появился `MineSlotWebBridge`); последний выпущенный тег —
`unity-v1.0.0`. Для 1.1.0 — `#main` или хэш коммита. Как выпускается тег — [релиз](releasing.md).

**Зависимости** UPM ставит сам: `com.unity.nuget.newtonsoft-json` 3.2.1 и
`com.unity.modules.unitywebrequestaudio`. Ставить Newtonsoft вручную не нужно, а использовать его для
payload'ов моста — тоже: пакет разбирает JSON собственным `Json` с атрибутом `[JsonName]`
([справочник](../reference/unity-core.md#json-jsonvalue-jsonnameattribute)).

После импорта в проекте появляются сборки `WebBridge.Runtime` и `WebBridge.Editor` (обе `autoReferenced`):
код в `Assembly-CSharp` видит их без настройки. Если у игры свои `.asmdef`, в `references` добавить
`WebBridge.Runtime`.

## 3. Добавить `SendToReact`

`WebBridgeUtils.Send` в WebGL зовёт внешнюю функцию `SendToReact`, а в пакете её нет — её объявляет игра. Файл
`Assets/Plugins/WebGL/WebSender.jslib` (так он лежит в MegaBlockRemake и Zuma):

```js
mergeInto(LibraryManager.library, {
  SendToReact: function (message) {
    try {
      window.dispatchReactUnityEvent("SendToReact", UTF8ToString(message));
    } catch (e) {
      console.warn("Failed to dispatch event");
    }
  },
});
```

Без этого файла WebGL-сборка падает на линковке (`undefined symbol: SendToReact`). `dispatchReactUnityEvent`
ставит на `window` библиотека `react-unity-webgl` шелла.

## 4. Положить мост на сцену

**GameObject → WebBridge → Create &lt;Mode&gt;WebBridge** — по пункту на режим: `RoadWebBridge` (crush),
`PlinkoWebBridge`, `PlinkoAztecWebBridge`, `JumperWebBridge`, `MineSlotWebBridge`. Пункт ставит префаб и
называет объект **`WebBridge`**.

```
WebBridge                      ← имя обязательно: хост шлёт SendMessage("WebBridge", …)
  MineSlotWebBridge            мост режима (наследник WebBridgeBase<T>)
  LayoutWebBridge              видимость UI хоста; его UiVisibility — сигнал «мост жив»
  ScreenOrientationWebBridge   портрет / альбом
  AudioWebBridge               звуки ключами
  TranslationsWebBridge        тексты из Tolgee
  WebBridgeUI                  фазы переходного экрана
```

1. **Имя не менять.** Хост находит объект по имени; переименованный — `SendMessage: object WebBridge not found!`.
2. **Один мост на сцену.** Пункт меню не даст добавить второй.
3. **Сцена, которая живёт всю сессию.** Пакет не зовёт `DontDestroyOnLoad`: выгрузили сцену с мостом —
   команды хоста уходят в никуда.
4. **Компоненты не удалять.** Без `LayoutWebBridge` хост не дождётся готовности моста и не пришлёт конфиг.
5. **Wheel.** У `WheelWebBridge` префаба нет: создать объект `WebBridge`, повесить `WheelWebBridge` и пять
   сервисных компонентов вручную.

Настройки моста — в инспекторе: секция `Mock` (ставка, валюта, white label для редактора), у
`LayoutWebBridge` — стартовые флаги `Web UI`.

## 5. Подписать игру

Игра зависит от моста, мост — нет: он не знает ни про сцену, ни про игровые объекты. Игровой код получает
мост через `Instance`, подписывается на события и зовёт методы.

```csharp
using System.Collections;
using Modules.MineSlot;
using Modules.Road;
using UnityEngine;

public class MineSlotRound : MonoBehaviour
{
    [SerializeField, WebBridgeSound] private string _spinSound;

    private void Start()
    {
        MineSlotWebBridge bridge = MineSlotWebBridge.Instance;
        bridge.SpinResultReceived += OnSpinResult;
        bridge.FastGameChanged += OnFastGameChanged;
        ScreenOrientationWebBridge.Instance.OrientationChanged += OnOrientationChanged;
        OnFastGameChanged(bridge.IsFastGameEnabled);
    }

    private void OnDestroy()
    {
        if (MineSlotWebBridge.Instance != null)
        {
            MineSlotWebBridge.Instance.SpinResultReceived -= OnSpinResult;
            MineSlotWebBridge.Instance.FastGameChanged -= OnFastGameChanged;
        }

        if (ScreenOrientationWebBridge.Instance != null)
            ScreenOrientationWebBridge.Instance.OrientationChanged -= OnOrientationChanged;
    }

    // Tap on the field instead of the bet-bar Play: the host places the bet, not the game.
    public void OnFieldTapped() => MineSlotWebBridge.Instance.RequestPlay();

    private void OnSpinResult(WebMineSlotSpinResultPayload result) => StartCoroutine(PlayRound(result));

    private IEnumerator PlayRound(WebMineSlotSpinResultPayload result)
    {
        AudioWebBridge.Instance.PlaySound(_spinSound);
        yield return new WaitForSeconds(1f);           // the game's own presentation of the reply
        MineSlotWebBridge.Instance.NotifySpinReady();  // the host reveals the win and unlocks the bar on this
    }

    private void OnFastGameChanged(bool isFast) => Time.timeScale = isFast ? 2f : 1f;

    private void OnOrientationChanged(ScreenOrientationType orientation)
    {
        bool isPortrait = orientation == ScreenOrientationType.Mobile;
        // Switch the camera / layout here.
    }
}
```

1. **Подписка — в `Start`, отписка — в `OnDestroy`.** `Instance` ставится в `Awake` моста, а Unity при загрузке
   сцены зовёт `Awake` и `OnEnable` объект за объектом: в `OnEnable` чужого объекта мост может быть ещё не
   создан. Нужен `OnEnable` — поднять мост в **Project Settings → Script Execution Order**.
2. **Сначала раунд, потом сигнал.** Исход показывает игра, а хост ждёт её события конца хода (`SpinReady`,
   `DropFinished`…) и до него держит бет-бар залоченным. Порядок — в
   [жизненном цикле раунда](../concepts/round-lifecycle.md).
3. **Значения, пришедшие до подписки,** читаются из свойств: `IsFastGameEnabled`, `CurrentIsWhiteLabel`,
   `LastGameState`, `CurrentOrientation`, `HasTranslations`.
4. **Ставку игра не делает.** Свой UI на поле зовёт `RequestPlay()`, дальше решает хост.

API своего режима — в `docs/modes/<id>/unity.md` ([список](../reference/unity-core.md#мосты-режимов)).

## 6. Прогнать в редакторе на mock

В редакторе хоста нет: `WebBridgeUtils.Send` только пишет лог `[Unity -> React] …`, стартовая синхронизация не
запускается. Отвечать за хост и сервер умеет mock-хост моста.

1. **Tools → WebBridge → Enable Mock** — галочка хранится в `EditorPrefs` и действует только в Play Mode.
2. **Play.** Мост в `Start()` поднимает mock-хост и кладёт себе отладочную панель — перетаскиваемую кнопку
   у края экрана: **DBG** (crush), **PLK** (plinko-aztec), **JMP** (jumper), **MIN** (mine-slot). Панель
   заменяет бет-бар: спин, бонус, сброс.
3. **Параметры mock** — секция `Mock` в инспекторе моста; лесенки сложностей crush — **Tools → WebBridge →
   MockConfig** (`Assets/Resources/MockConfig.asset`).
4. **Ориентация.** С mock `ScreenOrientationWebBridge` сам считает портрет по соотношению сторон окна Game
   (`Mock Mobile Aspect Ratio`, по умолчанию `1.1`): сузить окно — игра получит `Mobile`.
5. **Звуки.** **Tools → WebBridge → Sounds**: указать папку с `.mp3`, нажать **Scan**. В редакторе
   `AudioWebBridge` играет `{папка}/{ключ}.mp3` сам; поля с `[WebBridgeSound]` становятся выпадающим списком.

У `PlinkoWebBridge` и `WheelWebBridge` mock-хоста нет: в редакторе им никто не отвечает. Что умеет каждый
mock-хост и как он повторяет сервер — [mock-режим](../concepts/mock-mode.md) и `unity.md` режима.

**Tools → WebBridge → Enable Cheats** включает панель **CHT** — фиксированный RNG бэкенда для crush; в
редакторе она только пишет лог, работает в WebGL-сборке внутри шелла.

## 7. Собрать WebGL

**File → Build Profiles → Web** (WebGL), затем **Player Settings → Publishing Settings**:

| Настройка | Значение | Почему |
|---|---|---|
| Compression Format | **Brotli** | шелл грузит `<id>.data.br`, `<id>.framework.js.br`, `<id>.wasm.br` (`useUnityAdapter.ts`) |
| Decompression Fallback | выключен | с ним файлы получают другие имена (`.unityweb`), шелл их не найдёт |
| Scripting Define Symbols | **без** `WEBBRIDGE_MOCK` и `WEBBRIDGE_CHEATS` | с `WEBBRIDGE_MOCK` сборка отвечает себе сама и ни разу не спросит хост |
| WebGL Template | любой | `index.html` сборки шелл не открывает: он сам монтирует `Build/<id>.loader.js` |

Проверка перед сборкой:

1. **Tools → WebBridge → Enable Mock In Build** и **Enable Cheats In Build** — без галочки.
2. В проекте есть jslib с `SendToReact` ([шаг 3](#3-добавить-sendtoreact)).
3. Свои payload-классы игры помечены `[Preserve]`: `link.xml` пакета защищает от стриппинга только
   `WebBridge.Runtime`, а JSON-маппер создаёт классы рефлексией.

Результат — папка с `Build/<id>.loader.js` и остальными файлами `<id>.*` рядом, `StreamingAssets/` и
`index.html`. Префикс `<id>` Unity берёт из имени папки сборки; конфигуратор узнаёт его по `*.loader.js`,
так что имя может быть любым. Для загрузки — ZIP этой папки (или одного содержимого `Build/`: конфигуратор
восстановит `Build/` сам), до 500 МБ.

## 8. Запустить в шелле

Unity-сборку шелл берёт **только из конфигуратора**: дескриптор игры даёт `build.baseUrl` и `build.buildId`,
шелл грузит `<baseUrl>/Build/<buildId>.*`. Параметр `?localBuild=` работает только для веб-игр (`game.js` с
dev-сервера) — Unity-сборке он не поможет.

### На стенде тестировщика

1. Конфигуратор стенда → игра нужного режима → вкладка **Билды** → перетащить ZIP.
2. Когда билд распакован, — **Сделать активным** (бейдж **Активный**).
3. **Тестировщик** — стенд с эмуляцией вьюпорта, языком, валютой и читами; игра идёт в шелле на активном билде.

Пока у игры нет своего активного билда, запуск и тестировщик идут на билде тестовой игры режима, а нет и его —
на заглушке движка (подсказка «Своего билда нет» над формой).

### Локально

Связка «шелл + конфигуратор» на своей машине — когда нужно править шелл или конфигуратор вместе с игрой.

1. **Конфигуратор** (репозиторий `games-configurator`): Docker Desktop, `docker compose up -d` (Postgres и
   MinIO), `npm run dev` (`next dev`, `:3000`). В `.env` — `NEXT_PUBLIC_GAME_SHELL_URL=http://localhost:5173`.
2. **Шелл** (`RoadFrontent`): `bun install`, `bun run dev` (`:5173`); в `.env.local` —
   `VITE_CONFIGURATOR_URL=http://localhost:3000`. Адреса меняются парой: шелл отвечает только той админке,
   чей адрес знает.
3. В локальном конфигураторе — загрузить ZIP во вкладку **Билды**, **Сделать активным**, открыть
   **Тестировщик** или ссылку запуска игры.

Ссылку запуска можно собрать и руками:
`http://localhost:5173/?operatorId=…&authToken=…&currency=USD&lang=en&gameMode=<gameMode>&gameCategory=<category>&configuratorGameId=<id игры>`.
Оператор и токен стенда — `STAND_SESSION`, `gameMode`/`gameCategory` по режиму — `LAUNCH_IDENTITY` в
`games-configurator/src/features/games/domain/game-launch.ts` (у crush, например, `gameCategory=road`, а
`gameMode` — `chicken-road-two` или `peperoad` с бонусом). Без `configuratorGameId` шелл остаётся на загрузке.

### Что проверить в шелле

1. **Логи моста.** В сборке `WebBridgeLogger` выключен. Включить — тумблер логов в чит-панели шелла (или
   `localStorage.gameLogsEnabled = 'true'` и перезагрузка): шелл пришлёт `SetLoggingEnabled(1)`, и в консоли
   появятся `[Unity -> React] …`.
2. **Старт.** В логе есть `UiVisibility_{…}`, затем `RequestGameConfig` / `RequestGameState` и ответы
   `ApplyGameConfig` / `ApplyGameState`.
3. **Раунд.** Ставка из бет-бара → команда режима → анимация → событие конца хода → бет-бар оживает.

## Частые ошибки

| Симптом | Причина | Как исправить |
|---|---|---|
| WebGL-сборка падает: `undefined symbol: SendToReact` | в игре нет jslib с `SendToReact` | добавить `Assets/Plugins/WebGL/WebSender.jslib` ([шаг 3](#3-добавить-sendtoreact)) |
| В консоли браузера `SendMessage: object WebBridge not found!` | объект переименован, лежит не на загруженной сцене или выключен | объект `WebBridge` на сцене, которая живёт всю сессию; не переименовывать |
| Шелл висит на загрузке, конфиг не приходит | хост не получил `UiVisibility` — на объекте нет `LayoutWebBridge` | вернуть компоненты префаба; объект собирать пунктом **Create &lt;Mode&gt;WebBridge** |
| Сборка не шлёт `RequestGameConfig`, живёт своей жизнью | в Scripting Define Symbols WebGL остался `WEBBRIDGE_MOCK` | снять **Enable Mock In Build**, пересобрать |
| Команда хоста не доходит до события C# | метод назван не так, компонент не на объекте `WebBridge` или payload не разобрался (`[WebBridge] Failed to parse …`) | сверить имя с `unity.md` режима; включить логи моста и посмотреть сырой payload |
| В WebGL поля payload'а пустые или `MissingMethodException` | IL2CPP вырезал класс игры, который маппер создаёт рефлексией | `[Preserve]` на классе или свой `link.xml`; проверить Managed Stripping Level |
| `NullReferenceException` на `…WebBridge.Instance` при старте | подписка в `Awake`/`OnEnable` раньше `Awake` моста | подписываться в `Start` или поднять мост в Script Execution Order |
| В консоли `Instance … already exists.`, мост пропал | на сцене два моста — второй уничтожает свой GameObject | оставить один объект `WebBridge` |
| В редакторе ничего не происходит, команды не приходят | без mock в редакторе хоста нет: `Send` только логирует | **Tools → WebBridge → Enable Mock** |
| В WebGL нет ни одного лога моста | `WebBridgeLogger` в сборке выключен | тумблер логов шелла → `SetLoggingEnabled(1)` |
| Шелл не находит файлы сборки (404 на `.data.br`) | сжатие не Brotli или включён Decompression Fallback | Compression Format = Brotli, Fallback выключен |
| `SendMessage: … does not have receiver for function SetDesktopBetBarViewportMetrics` (и подобные) | хост шлёт команду, приёмника которой в ядре нет | не ошибка; нужна команда — свой компонент на объекте `WebBridge` |
| `PlayMusic` не играет в шелле | трек выбирает хост, `PlayMusic` он игнорирует | музыку не запускать; приглушить играющую — `SetVolume` |
| Звук в редакторе не слышен | у `SoundKeys` не задана папка или нет `{ключ}.mp3` | **Tools → WebBridge → Sounds** → папка → **Scan** |

## Смотрите также

- [Ядро Unity-моста](../reference/unity-core.md) — весь API пакета
- [Архитектура](../concepts/architecture.md) · [Жизненный цикл раунда](../concepts/round-lifecycle.md) · [Общий протокол](../concepts/core-protocol.md) · [Mock-режим](../concepts/mock-mode.md)
- [Новый режим](adding-a-mode.md) · [Релиз](releasing.md) · [Старт на JS](getting-started-js.md)
