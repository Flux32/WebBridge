# @omega/webbridge-js

Мост WebBridge для **веб-игр** на любом JS-движке (Phaser, Pixi, three.js, Canvas): принимает команды
React-шелла и шлёт ему события. Зеркало Unity-пакета `com.pixi.webbridge`: те же классы и сигналы, только
без строк на проводе.

```bash
npm install \
  https://github.com/Flux32/WebBridge/releases/download/js-v1.15.0/omega-webbridge-js-1.15.0.tgz \
  https://github.com/Flux32/WebBridge/releases/download/protocol-v1.17.0/omega-webbridge-protocol-1.17.0.tgz
```

```ts
import { createWebBoot, registerWebBoot, MineSlotBridge } from '@omega/webbridge-js';

registerWebBoot(
  createWebBoot({
    createBridge: (transport) => new MineSlotBridge(transport),
    createGame: (bridge, container, options, host) => new MyGame(bridge, container, host),
    destroyGame: (game) => game.destroy(),
  }),
);
```

## Что внутри

| Экспорт | Что это |
|---|---|
| `BridgeBase`, `Signal`, `BridgeTransport`, `BridgeStorage`, `BridgeLogger`, `isMockEnabled` | ядро моста |
| `createWebBoot`, `registerWebBoot` | точка входа бандла: `window.__WEB_GAME_BOOT__` |
| `CrushBridge`, `TwistBridge`, `SlotCoinBridge`, `WheelBridge`, `PlinkoBridge`, `PlinkoAztecBridge`, `JumperBridge`, `MineSlotBridge` | мосты режимов |
| `MockHost`, `MockPanel`, `<Mode>MockHost` | mock-хосты: игра без шелла (`?mock=1`) |
| `@omega/webbridge-js/vite` | vite-плагин: `localBuild` для шелла, связка с конфигуратором |

| C# (`com.pixi.webbridge`) | TS |
|---|---|
| `WebBridgeBase<T>` | `BridgeBase` |
| `RoadWebBridge` · `PlinkoWebBridge` · `MineSlotWebBridge` … | `CrushBridge` · `PlinkoBridge` · `MineSlotBridge` … |
| `event Action<T>` | `Signal<T>` |
| `WebBridgeUtils.Send` | `BridgeTransport.send` |

## Документация

- [Старт на JS](../../docs/guides/getting-started-js.md): от пустого проекта до игры в шелле и в конфигураторе
- [Ядро JS-моста](../../docs/reference/js-core.md): полный API
- Режимы: [crush](../../docs/modes/crush/js.md) · [twist](../../docs/modes/twist/js.md) ·
  [slot-coin](../../docs/modes/slot-coin/js.md) · [wheel](../../docs/modes/wheel/js.md) ·
  [plinko](../../docs/modes/plinko/js.md) · [plinko-aztec](../../docs/modes/plinko-aztec/js.md) ·
  [jumper](../../docs/modes/jumper/js.md) · [mine-slot](../../docs/modes/mine-slot/js.md)
- [Вся документация WebBridge](../../README.md)

```bash
npm run build -w @omega/webbridge-js     # tsc -b
npm test -w @omega/webbridge-js          # vitest
```
