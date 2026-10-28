# Новый режим

> Как провести новую механику через все три репозитория: контракт → мосты → демо → шелл → конфигуратор →
> документация. Порядок важен: каждый следующий шаг опирается на предыдущий.

Пример ниже — режим `mine-slot`, добавленный 28.10.2026. Его коммиты — хороший образец каждого шага.

## 0. Решить до кода

| Вопрос | Пример (mine-slot) |
|---|---|
| Id режима: kebab-case для шелла и конфигуратора, camelCase для канала протокола | `mine-slot` / `mineSlot` |
| `gameMode` бэкенда (имя на сервере) | `mine-slot` |
| Что приходит от сервера за один ход и что из этого нужно игре | весь раунд с фри-спинами одним ответом |
| Какая команда несёт ход и какое событие его заканчивает | `ApplySpinResult` → `SpinReady` |
| Нужны ли свои команды или хватает общих | хватает общих (`SpinCommand`, `RoundEvent`) |
| Где бонус: в ответе или серией через `StartBonus` | в ответе |

Спецификация бэкенда — в Confluence. Форму ответа надо снять с dev-бэка, а не брать из документа:
документ и сервер расходятся (у mine-slot `amount` оказался полной ценой, а не ставкой).

## 1. Протокол — `protocol/`

1. Типы и константы режима — в своём файле (`protocol/src/mineSlot.ts`): payload ответа, коды, размеры.
2. Канал — в `ModeProtocols` (`protocol/src/modes.ts`). Если у режима свои команды, их союз — в
   `commands.ts`, события — в `events.ts`, и тогда они входят в `EngineCommand` / `EngineEvent`.
3. Экспорт — из `protocol/src/index.ts`.
4. Версия — **minor** (`1.17.0` → `1.18.0`): изменение только добавляет.
5. Новые Unity-сообщения без payload'а — в `UNITY_PLAIN_MESSAGES` (`unityWire.ts`).

## 2. JS-мост — `js/webbridge/`

1. `src/<mode-id>/<Mode>Bridge.ts` — `extends BridgeBase`: сигналы режима, `applyGameConfig`,
   `applyGameState`, `handleGameCommand` (чужая команда — `BridgeLogger.warn`, общая синхронизация хоста
   вроде `UpdateCoeffs` — тихо пропустить), методы `notify*`, `start()` с `beginInitialSync()`.
2. `src/<mode-id>/<Mode>MockHost.ts` — `implements WebHostBridge`: отвечает на синхронизацию, сдаёт ходы в
   форме сервера, держит «бар» до события конца хода ([mock-режим](../concepts/mock-mode.md)).
3. Экспорт — из `src/index.ts`; тесты — в `test/`.
4. Версия — minor; зависимость от протокола указывает на tarball новой версии
   ([релизы](releasing.md)). Пока протокол не выпущен, импортируйте из него только типы: тогда мост
   работает и на выпущенной версии.

## 3. Unity-мост — `unity/Assets/WebBridge/`

1. `Runtime/<Mode>WebBridge.cs` — `[Preserve] public class <Mode>WebBridge : WebBridgeBase<<Mode>WebBridge>`
   в namespace `Modules.<Mode>`: события C#, публичные методы с именами команд (их зовёт `SendMessage`),
   `Notify*` → `WebBridgeUtils.Send("<Event>")`.
2. `Runtime/Web<Mode>Payloads.cs` — `[Preserve] [Serializable]` классы с `[JsonName("…")]` на каждом поле.
3. Mock: `<Mode>MockHost`, `<Mode>MockSettings` (поле на компоненте), `<Mode>MockDebugIMGUI : DebugPanelIMGUI`.
4. Префаб `Runtime/Prefabs/<Mode>WebBridge.prefab` и пункт **GameObject → WebBridge → Create
   <Mode>WebBridge** в `Editor/WebBridgeMenuItems.cs`. Новый мост надо добавить и в проверку «один мост
   на сцене».
5. Версия пакета — minor в `unity/Assets/WebBridge/package.json`.

## 4. Демо-игра — `js/examples/demo-games/`

1. `src/modes/<mode-id>/` — сцена на Canvas 2D по kit'у демо: `index.ts` (`DemoMode`), `boot.ts`
   (`registerWebBoot(createDemoBoot(…))`), `dev.ts` (mock-хост для `?mock=1`), контроллер и вид.
2. Id — в конец `DEMO_MODE_IDS` (`src/modes/modeIds.ts`): порядок задаёт порт dev-сервера.
3. Обложка — мотив в `scripts/coverMotifs.ts`.

## 5. Шелл — RoadFrontent

Работа идёт по правилам `CLAUDE.md` шелла: TDD, `bun run verify`, коммиты по шагам.

1. Регистрация: `MODE_IDS`, define `__MODE_<ID>__`, загрузчик в `app/modes/modeRegistry.ts`, матрица
   `bundle:check` в CI, бюджет в `bundle-budgets.json`, строки во всех таблицах по `ModeId`.
2. Модуль `src/modes/<mode-id>/`: схема ответа (zod) на границе, раунд (запрос, парковка исхода, команда
   движку), обработчик событий движка (событие конца хода раскрывает исход и снимает лок), сессия, экран.
3. Записанные ответы dev-бэка — в `fixtures/`, на них интеграционные тесты.

## 6. Конфигуратор — games-configurator

1. `GameMode` + миграция enum'а БД, launch identity (`gameMode` бэкенда + `gameCategory` шелла), подписи,
   токен обложки.
2. Демо-игра — в реестр `features/demo-games` и экспортом из WebBridge:
   `CONFIGURATOR_DIR=<путь> npm run export -w js/examples/demo-games`.

## 7. Документация — `docs/`

1. Три файла по шаблонам `docs/_templates/` → `docs/modes/<mode-id>/README.md`, `js.md`, `unity.md`
   ([как писать](../_templates/README.md)).
2. Строка в таблице режимов корневого `README.md`, строки в таблицах [архитектуры](../concepts/architecture.md#режим),
   [жизненного цикла](../concepts/round-lifecycle.md) и [mock-режима](../concepts/mock-mode.md#какие-есть).

## 8. Проверка и выпуск

1. Живой раунд демо-игры против dev-бэка: в шелле локально (`?localBuild=`) и на стенде тестировщика.
2. Выпуск — шелл раньше конфигуратора: иначе конфигуратор запустит режим, которого шелл ещё не знает.
   Протокол и JS-пакет — по [релизам](releasing.md).
