# @omega/webbridge-protocol

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

Пока — тарболом в GitHub Releases: реестр `packages.inoutgames.dev` принадлежит
партнёрам, публиковать туда мы не можем, а свой GitLab Package Registry на
`git.x-web.cloud` ещё не заведён. Имя пакета уже под scope `@omega`, чтобы при
переезде туда его не менять (GitLab требует, чтобы scope совпадал с корневой
группой).

```bash
npm version patch -w @omega/webbridge-protocol
npm pack -w @omega/webbridge-protocol
gh release create protocol-v<версия> omega-webbridge-protocol-<версия>.tgz \
  --repo Flux32/WebBridge --title "protocol v<версия>"
```

`prepack` соберёт `dist/` (в git его нет). Дальше во фронтенде правится URL
тарбола в `dependencies` — версии иммутабельны, semver-диапазонов тут нет,
ссылка всегда точная.

## Куда девать дубли

Сейчас контракт продублирован трижды: здесь, в `RoadFrontent/src/engine/protocol.ts`
и в C#-payload'ах. Порядок устранения:

1. ✅ фронтенд импортирует пакет вместо своей копии, `src/engine/protocol.ts` удалён;
2. на C#-стороне добавляется тест, сверяющий имена методов моста и поля payload'ов
   с `unityWire.ts` (генерацию C# из TS не делаем — дорого и ломко).
