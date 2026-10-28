# Релизы

> Как выпустить пакеты WebBridge и подключить новую версию в шелле и играх.

## Что выпускается

| Пакет | Версия в | Тег | Где лежит | Кто потребляет |
|---|---|---|---|---|
| `@omega/webbridge-protocol` | `protocol/package.json` | `protocol-v<x.y.z>` | tarball в GitHub Release | шелл, JS-мост, демо |
| `@omega/webbridge-js` | `js/webbridge/package.json` | `js-v<x.y.z>` | tarball в GitHub Release | веб-игры |
| `com.pixi.webbridge` | `unity/Assets/WebBridge/package.json` | `unity-v<x.y.z>` | git-тег репозитория | Unity-игры (UPM по git URL) |

npm-реестра у пакетов пока нет: `packages.inoutgames.dev` принадлежит партнёрам, свой GitLab Package
Registry не заведён. Поэтому зависимость — точная ссылка на tarball, без semver-диапазонов. Scope `@omega`
выбран заранее, под будущий GitLab.

## Правила версий

1. **Протокол только растёт.** Новая команда, событие или поле — **minor**. Исправление типов без
   изменения провода — **patch**. Удаление или переименование на проводе — только с `@deprecated`-
   псевдонимом и переходным периодом: выпущенные игры и шеллы живут со старыми версиями.
2. **JS-мост** следует за протоколом. Новый мост или mock — minor, исправление — patch. Пока нужная
   версия протокола не выпущена, мост импортирует из неё только типы (`import type`): тогда он работает
   и на выпущенной версии.
3. **Unity-пакет** версионируется отдельно; новый мост режима — minor.
4. **Один релиз — один коммит** `chore(<пакет>): release <x.y.z> with <что>`: в нём только версия и
   `package-lock.json`.

## Протокол

```bash
npm version minor -w @omega/webbridge-protocol --no-git-tag-version
npm install                                   # обновить package-lock.json
git commit -am "chore(protocol): release 1.18.0 with the mine-slot channel"
npm pack -w @omega/webbridge-protocol         # prepack соберёт dist/
gh release create protocol-v1.18.0 omega-webbridge-protocol-1.18.0.tgz \
  --repo Flux32/WebBridge --title "protocol v1.18.0 — mine-slot channel"
```

## JS-мост

1. В `js/webbridge/package.json` указать tarball нужного протокола:
   `"@omega/webbridge-protocol": "https://github.com/Flux32/WebBridge/releases/download/protocol-v1.18.0/omega-webbridge-protocol-1.18.0.tgz"`.
2. `npm install` в корне: после смены протокола иначе в `js/webbridge/node_modules` останется старая копия.
3. Версия, коммит, `npm pack -w @omega/webbridge-js`, `gh release create js-v<x.y.z> omega-webbridge-js-<x.y.z>.tgz`.

## Unity-пакет

```bash
git tag unity-v1.1.0 && git push origin unity-v1.1.0
```

Игры подключают пакет по git URL с тегом:

```json
"com.pixi.webbridge": "https://github.com/Flux32/WebBridge.git?path=unity/Assets/WebBridge#unity-v1.1.0"
```

## После выпуска

| Где | Что сделать |
|---|---|
| Шелл (RoadFrontent) | обновить URL tarball'а протокола в `package.json` отдельным коммитом, `bun install`, **очистить `node_modules/.vite`** и перезапустить dev-сервер: иначе шелл грузится на старом пребандле |
| Веб-игры | обновить URL tarball'а `@omega/webbridge-js` |
| Unity-игры | сменить тег в `manifest.json` |
| Конфигуратор | пересобрать демо-игры (`npm run export -w js/examples/demo-games`), если менялся мост |

## Проверить перед релизом

```bash
npm run typecheck      # протокол, мост, демо, заглушки
npm test               # тесты моста и демо-игр
```

И живой раунд затронутых режимов в шелле ([старт на JS](getting-started-js.md),
[старт на Unity](getting-started-unity.md)).
