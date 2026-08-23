# @omega/webbridge-js

Игровая сторона моста для Phaser — то же, что `unity/Assets/WebBridge` для Unity.
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

1. **Ядро не знает про Phaser.** `BridgeBase`/`CrushBridge` работают с
   `BridgeTransport` — интерфейсом «отправить `EngineEvent`». Phaser появляется
   только в `phaser/createPhaserBoot.ts`.
2. **Ядро не знает про строки.** Парсинг `SendMessage`-строк — беда одного лишь
   Unity; сюда команда приходит уже структурой. Исключение — `ApplyGameConfig` /
   `ApplyGameState` / `ApplyTranslations`, которые контрактом объявлены строками
   (на них держится дедуп во фронтенде), их мост парсит сам.
3. **Игра зависит от моста, мост от игры — нет.** То же правило, что и в Unity:
   сцены подписываются на сигналы моста, мост не импортирует ни одной игровой сущности.

## Точка входа

```ts
import { createPhaserBoot, CrushBridge } from '@omega/webbridge-js';

window.__PHASER_BOOT__ = createPhaserBoot({
  createBridge: (transport) => new CrushBridge(transport),
  createGame: (bridge, container, options) => new Phaser.Game(makeConfig(bridge, container, options)),
  destroyGame: (game) => game.destroy(true),
});
```

## Что осталось (скелет)

- `CrushBridge` покрывает базовый цикл (config/state/step/coeffs/bonus); остальные
  команды из `CrushCommand` доводятся по мере готовности сцен;
- нет аналогов `AudioWebBridge`/`LayoutWebBridge` как отдельных классов — сейчас
  их сообщения уходят прямо через `BridgeBase`; выделять в отдельные модули,
  когда набежит логика;
- нет mock-режима с данными (`MockConfig` в C#) — есть только флаг `isMockEnabled`.
