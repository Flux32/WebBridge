# @omega/webbridge-protocol

Контракт WebBridge — **единственный источник истины** для React-шелла, Unity-моста (C#) и JS-моста (веб-игры):
команды хоста, события игры, payload'ы. Здесь нет ничего движко-специфичного: имена доменные
(`ApplyStepResult`, `SpinReady`), а как они ложатся на провод, решает каждая сторона.

## Что внутри

| Файл | Что описывает |
|---|---|
| `src/commands.ts` | `EngineCommand`: общие `CoreCommand` и команды режимов |
| `src/events.ts` | `EngineEvent`: общие `CoreEvent`, `RoundEvent` (`SpinReady`) и события режимов |
| `src/modes.ts` | `ModeProtocols`: канал команд и событий каждого режима |
| `src/payloads.ts`, `src/jumper.ts`, `src/mineSlot.ts`, `src/fruitLoveFever.ts` | payload'ы и словари режимов |
| `src/web.ts` | контракт веб-игры: `WebHostBridge`, `WebGameBridge`, `__WEB_GAME_BOOT__` |
| `src/unityWire.ts` | проводной формат Unity: имя объекта `WebBridge`, событие `SendToReact`, префиксы |
| `src/legacy*.ts` | `@deprecated`-псевдонимы переименований (`slot` → `slot-coin`, `__PHASER_BOOT__`) |

## Документация

- [Общий протокол](../docs/concepts/core-protocol.md): все общие команды и события, оба провода
- Контракты режимов: [crush](../docs/modes/crush/README.md) · [twist](../docs/modes/twist/README.md) ·
  [slot-coin](../docs/modes/slot-coin/README.md) · [wheel](../docs/modes/wheel/README.md) ·
  [plinko](../docs/modes/plinko/README.md) · [plinko-aztec](../docs/modes/plinko-aztec/README.md) ·
  [jumper](../docs/modes/jumper/README.md) · [mine-slot](../docs/modes/mine-slot/README.md) ·
  [fruit-love-fever](../docs/modes/fruit-love-fever/README.md)
- [Релизы](../docs/guides/releasing.md): версии и выпуск tarball'а в GitHub Releases
- [Вся документация WebBridge](../README.md)
