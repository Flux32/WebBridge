# WebBridge for Unity — `com.pixi.webbridge`

UPM-пакет моста WebBridge для **Unity WebGL**: принимает команды React-шелла (`SendMessage` на объект
`WebBridge`) и шлёт ему события (`SendToReact`). Мосты — транспорт без геймплея: игра зависит от них,
они от игры — нет.

```json
// Packages/manifest.json → dependencies
"com.pixi.webbridge": "https://github.com/Flux32/WebBridge.git?path=unity/Assets/WebBridge#unity-v1.0.0"
```

Дальше: **GameObject → WebBridge → Create &lt;Mode&gt;WebBridge** кладёт на сцену префаб моста своего режима
под именем `WebBridge`, а игра подписывается на его события.

## Что внутри

| Компонент | Что делает |
|---|---|
| `WebBridgeBase<T>` | база каждого моста: синглтон, стартовая синхронизация, white label, быстрая игра, логи |
| `RoadWebBridge`, `PlinkoWebBridge`, `PlinkoAztecWebBridge`, `WheelWebBridge`, `JumperWebBridge`, `MineSlotWebBridge` | мосты режимов |
| `LayoutWebBridge`, `ScreenOrientationWebBridge`, `AudioWebBridge`, `TranslationsWebBridge`, `WebBridgeUI` | сервисы: видимость UI и метрики бара, ориентация, звук, переводы, экран перехода |
| `WebBridgeUtils`, `Json`, `JsonValue`, `[JsonName]` | отправка, разбор payload'ов, localStorage, флаги mock и cheats |
| `CheatBridge`, mock-хосты, IMGUI-панели | отладка: управление RNG, игра без React |
| меню **Tools → WebBridge** | mock, cheats, ключи звуков, `MockConfig` |

## Документация

- [Старт на Unity](../../../docs/guides/getting-started-unity.md): пакет, сцена, mock, сборка WebGL, шелл
- [Ядро Unity-моста](../../../docs/reference/unity-core.md): полный API пакета
- Режимы: [crush](../../../docs/modes/crush/unity.md) · [twist](../../../docs/modes/twist/unity.md) ·
  [slot-coin](../../../docs/modes/slot-coin/unity.md) · [wheel](../../../docs/modes/wheel/unity.md) ·
  [plinko](../../../docs/modes/plinko/unity.md) · [plinko-aztec](../../../docs/modes/plinko-aztec/unity.md) ·
  [jumper](../../../docs/modes/jumper/unity.md) · [mine-slot](../../../docs/modes/mine-slot/unity.md)
- [Вся документация WebBridge](../../../README.md)
