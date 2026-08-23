## Стек
1. Unity 6

## Правила для агента
1. Не добавляй fallback код
2. Не делай проверку зависимостей на null
3. Не добавляй автоподтягивание зависимостей
4. Соблюдай принципы SOLID, KISS, DRY
5. Разделяй ответственности, если класс становится больши дели его на классы
6. Соблюдай code-style конвецию Microsoft C#
7. Пиши код уровня Senior разработчика


## Архитектура
1. Важно, чтобы WebBridge компоненты не имели геймплейных зависимостей, а был просто прослойкой между React и Unity. То есть игровые объекты должны зависеть от него, а не он от игровых объектов.

## Внешние ресурсы (фронтенд и платформа)
Unity-часть (этот репозиторий) — только Unity-сторона моста. React-сторона и платформенный бэкенд живут отдельно; ниже ссылки, к которым стоит обращаться при интеграции нового моста (payload'ы, команды, UI).

1. **client-core API — https://typebook.inoutgames.dev/modules**
   TypeDoc-документация TypeScript-модулей платформы. Главный модуль — `client-core`: это полноценный клиент бэкенда по WebSocket (Socket.IO), общий для всех игр платформы.
   - `createStore({ gameType })` → `RootStore` с полями `game` (`GameStore`), `bet`, `wallet`, `user`.
   - `GameStore`: игровые команды `play(value)`, `step()`, `payout()` и неигровые `getGameConfig()`, `getGameState()`, `getGameHistory()`, `getGameSeeds()`.
   - Базовый `GameState` (общий для всех игр): `status` (`none`/`in-game`/`win`/`lose`), `bet{amount,currency,decimalPlaces}`, `isFinished`, `isWin`, `coeff`, `winAmount`. Игро-специфичные поля приходят на верхнем уровне (extendGameState).
   Это источник истины по формам данных, которые React прокидывает в Unity-мост. C#-payload'ы (`WebGameStateBase` и наследники) должны соответствовать этим типам.

2. **UI Kit (Storybook) — https://ui-kit.inoutgames.dev/?path=/docs/getting-started-overview--docs**
   Storybook общей React UI-библиотеки платформы (кнопки ставок, модалки, BetBar, панели баланса и т.п.), которую переиспользуют фронтенды всех игр. Смотреть, когда нужно понять, какие UI-элементы уже есть на React-стороне и как они себя ведут (например, что мост НЕ должен дублировать в Unity).

3. **Референс-фронтенд Road — /Users/flux/Documents/GitHub/Pixi/RoadFrontent**
   Рабочий React-фронтенд игры Road. Показывает связку целиком: `@public/client-core` (бэкенд) + UI Kit + драйв Unity через `unityInstance.SendMessage("WebBridge", <метод>, payload)`. Это шаблон, по которому делается фронт новой игры (например Plinko): как слать команды в бэк, как форвардить результат в Unity-мост, какие имена методов/GameObject использовать.

## Структура репозитория
```
protocol/          @public/webbridge-protocol — движко-агностичный контракт (команды, события, payload'ы)
js/webbridge/      @public/webbridge-js — игровая сторона моста для Phaser (зеркало C#-пакета)
unity/             Unity-проект; UPM-пакет — unity/Assets/WebBridge
```
1. Контракт правится ТОЛЬКО в `protocol/` — остальные стороны его потребляют.
2. TS-мост зеркалит имена C#: `WebBridgeBase<T>` → `BridgeBase`, `RoadWebBridge` → `RoadBridge`, `event Action<T>` → `Signal<T>`.
3. Ядро TS-моста не знает ни про Phaser, ни про строки: движок появляется только в `phaser/createPhaserBoot.ts`, парсинг строк — только в Unity.
4. Сборка: `npm run build` в корне (TS project references, `tsc -b js/webbridge`).

### Связь с Unity-мостом
- React адресует Unity-объект по имени GameObject (`"WebBridge"`) + имени публичного метода моста — имя C#-класса роли не играет.
- Каждой игре — свой мост (`RoadWebBridge`, `PlinkoWebBridge`), наследник game-agnostic базы `WebBridgeBase<T>` (namespace `WebBridge`). Общие типы (`Json`, `JsonValue`, `JsonName`, `WebBridgeUtils`, `WebGameStateBase`) лежат в namespace `WebBridge`, игро-специфика — в `Modules.<Game>`.