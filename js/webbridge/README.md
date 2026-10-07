# @omega/webbridge-js

Игровая сторона моста для веб-игр — Phaser, Pixi, three.js, любой JS-движок — то же, что `unity/Assets/WebBridge` для Unity.
Имена классов, методов и событий сознательно зеркалят C#, чтобы корневой
`README.md` описывал оба моста разом:

| C# | TS |
|---|---|
| `WebBridgeBase<T>` | `BridgeBase` |
| `RoadWebBridge` | `CrushBridge` |
| `event Action<T>` | `Signal<T>` |
| `WebBridgeUtils.Send` | `BridgeTransport.send` |
| `WebBridgeUtils.*LocalStorage` | `BridgeStorage` |
| `WebBridgeLogger` | `BridgeLogger` |

## Архитектурные границы

1. **Ядро не знает про движок.** `BridgeBase`/`CrushBridge` работают с
   `BridgeTransport` — интерфейсом «отправить `EngineEvent`». Хост веб-игры
   появляется только в `web/createWebBoot.ts`.
2. **Ядро не знает про строки.** Парсинг `SendMessage`-строк — беда одного лишь
   Unity; сюда команда приходит уже структурой. Исключение — `ApplyGameConfig` /
   `ApplyGameState` / `ApplyTranslations`, которые контрактом объявлены строками
   (на них держится дедуп во фронтенде), их мост парсит сам.
3. **Игра зависит от моста, мост от игры — нет.** То же правило, что и в Unity:
   сцены подписываются на сигналы моста, мост не импортирует ни одной игровой сущности.

## Метрики хоста

`desktopBetBarViewportMetricsReceived` / `mobileBetBarViewportMetricsReceived` отдают
JSON-строку как есть; её форма — `BetBarViewportMetricsPayload` (реэкспорт из
протокола). Все величины — доли холста 0..1: `heightEndViewport` — сколько снизу
закрывает бет-бар, `heightStartViewport` — сколько сверху закрывает полоса Live wins
(нет поля — сверху ничего).

## Точка входа

```ts
import { createWebBoot, registerWebBoot, CrushBridge } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new CrushBridge(transport),
    createGame: (bridge, container, options) => new Phaser.Game(makeConfig(bridge, container, options)),
    destroyGame: (game) => game.destroy(true),
  }),
);
```

Движок любой: для Pixi `createGame` создаёт `Application` в `container` (разрешение —
`options.devicePixelRatio`), `destroyGame` зовёт `app.destroy()`. `registerWebBoot`
выставляет фабрику как `__WEB_GAME_BOOT__` и под прежним именем `__PHASER_BOOT__` —
его ищут шеллы старых тегов. `createPhaserBoot` / `PhaserBootConfig` остаются
устаревшими синонимами.

## Игра в настоящем шелле без сборки

Плагин отдаёт игру с dev-сервера стенду шелла: конфигурация, редактор раскладки и
бэк — стендовые, код игры — тот, что пишется прямо сейчас.

```ts
import { localBuildServer } from '@omega/webbridge-js/vite';

export default defineConfig({
  plugins: [localBuildServer({ entry: '/src/bridge/boot.ts', mode: 'crush' })],
  server: { port: 5180 },
});
```

`npm run dev` сам открывает админку:

1. Если не вошли — вход, после него админка вернёт на нужную страницу.
2. Пока проект не связан с игрой — настройка проекта: выбрать игру из админки или
   создать новую (`mode` подставит её режим). Выбор админка присылает dev-серверу,
   и тот записывает `webbridge.json` в корень проекта — файл стоит закоммитить,
   чтобы вся команда работала с одной игрой.
3. Дальше каждый запуск открывает сразу редактор раскладки этой игры, с кодом
   игры с dev-сервера. Выхода в админку из него нет — только «Сменить игру
   проекта», который ведёт обратно на настройку.

Опции: `configuratorUrl` — админка (по умолчанию боевая, для локальной —
`http://127.0.0.1:3000`); `server.open: false` в конфиге проекта отключает
открытие браузера, адрес админки dev-сервер всё равно печатает в консоль.
Связь с игрой dev-сервер принимает только с origin этой админки.

Вручную: ссылка на игру со стенда + `&localBuild=http://localhost:5180`. Шелл
возьмёт `/game.js` модулем; правка кода перезагружает страницу.

- Только ПК в Chrome: шелл пускает код лишь с `localhost` / `127.0.0.1` / `[::1]`.
  Chrome один раз спросит доступ к локальной сети — разрешить.
- Порт фиксированный (`strictPort`): по нему строятся полные адреса ассетов.
- Ассеты игра адресует от своего модуля (`import`, `new URL(…, import.meta.url)`):
  `document.currentScript` у модуля пуст.
- Релизный пакет шелла этой возможности не содержит.

## Что осталось (скелет)

- `CrushBridge` покрывает базовый цикл (config/state/step/coeffs) и запуск бонуса
  с уведомлениями. Бонус в Crush полноценный — в C#-мосте есть покупка
  (`BonusModePurchased`/`BonusModePurchaseFailed`), режимы магазина
  (`ResolveBonusModesForShop`) и восстановление позиций автоплея
  (`ResolveBonusPositionsForAutoPlay`); здесь этого пока нет;
- нет аналогов `AudioWebBridge`/`LayoutWebBridge` как отдельных классов — сейчас
  их сообщения уходят прямо через `BridgeBase`; выделять в отдельные модули,
  когда набежит логика;
- нет mock-режима с данными (`MockConfig` в C#) — есть только флаг `isMockEnabled`.
