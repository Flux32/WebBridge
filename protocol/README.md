# @public/webbridge-protocol

Словарь, на котором говорят **все** участники: React-фронтенд, Unity-мост
(`unity/Assets/WebBridge`, C#) и JS-мост (`js/webbridge`, Phaser).

Правило одно: **ничего движко-специфичного здесь нет**. Имена доменные
(`ApplyStepResult`, `StartBonus`), а как они лягут на провод — забота стороны:

| | транспорт | где живёт маппинг |
|---|---|---|
| Unity | `SendMessage('WebBridge', method, string)` + строка в `SendToReact` | `src/unityWire.ts` (константы) + C#-мост |
| Phaser | тот же `window`, структурированный объект | `js/webbridge` |

## Состав

- `payloads.ts` — формы данных;
- `commands.ts` — React → игра;
- `events.ts` — игра → React;
- `phaser.ts` — контракт загрузки Phaser-бандла (`__PHASER_BOOT__`);
- `unityWire.ts` — имена и префиксы проводного формата Unity.

## Публикация

Пакет уезжает в тот же приватный реестр, что `@public/client-core` и
`@public/ui-kit`, — поэтому у фронтенда и CI уже настроен auth на scope
`@public`, менять инфраструктуру не нужно.

```bash
npm publish -w @public/webbridge-protocol
```

`prepublishOnly` соберёт `dist/` (в git его нет). После бампа контракта —
поднять `version` и опубликовать заново, иначе потребители останутся на старой.

## Куда девать дубли

Сейчас контракт продублирован трижды: здесь, в `RoadFrontent/src/engine/protocol.ts`
и в C#-payload'ах. Порядок устранения:

1. ✅ фронтенд импортирует пакет вместо своей копии, `src/engine/protocol.ts` удалён;
2. на C#-стороне добавляется тест, сверяющий имена методов моста и поля payload'ов
   с `unityWire.ts` (генерацию C# из TS не делаем — дорого и ломко).
