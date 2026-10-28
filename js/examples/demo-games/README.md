# demo-games

Демо-игры: по одной на каждый режим шелла. Это витрина бэкенда режима, и живут они во вкладке
«Демо игры» конфигуратора. Каждая игра — веб-игра на Canvas 2D поверх моста своего режима из
`@omega/webbridge-js`. Игра ходит по настоящему пути: `createWebBoot` / `registerWebBoot`, затем
`game.js` из папки билда конфигуратора. Раунд играется против dev-бэкенда режима через шелл.

Пакет живёт вне `@omega/webbridge-js` (в `js/examples/`, своим workspace), в релиз пакета не попадает,
а мост берёт по имени пакета — как любая игра.

## Запуск

```bash
npm install                                                   # в корне репозитория, один раз
DEMO_MODE=crush npm run dev -w js/examples/demo-games         # http://localhost:5192/?mock=1
```

| Режим | Порт dev-сервера | Мост | Mock-хост |
|---|---|---|---|
| `plinko` | 5190 | `PlinkoBridge` | `PlinkoMockHost` |
| `plinko-aztec` | 5191 | `PlinkoAztecBridge` | `PlinkoAztecMockHost` |
| `crush` | 5192 | `CrushBridge` | `MockHost` |
| `twist` | 5193 | `TwistBridge` | — (свой в `modes/twist/dev.ts`) |
| `slot-coin` | 5194 | `SlotCoinBridge` | `SlotCoinMockHost` |
| `wheel` | 5195 | `WheelBridge` | — (свой в `modes/wheel/dev.ts`) |
| `jumper` | 5196 | `JumperBridge` | `JumperMockHost` |

- `?mock=1` — вместо шелла mock-хост режима.
- Без `mock` dev-сервер отдаёт `/game.js` для шелла: `?localBuild=http://localhost:<порт>`.
- `npm run build` — все режимы в `dist/<mode>/game.js` (IIFE, один файл).
- `npm run export` — сборка, обложки и копирование в конфигуратор (`CONFIGURATOR_DIR=<путь>`):
  `public/demo-games/<mode>/{game.js,cover.svg}`.

## Режим изнутри

```
src/modes/<mode>/
  index.ts          DemoMode: title, accent, createBridge, createScene, startSync
  boot.ts           registerWebBoot(createDemoBoot(<mode>Mode)) — вход бандла
  dev.ts            DevMode для dev-страницы: boot, mock-хост, подсказка по клавишам
  <Mode>Controller  мост ↔ модель ↔ движения; шлёт событие конца хода
  <Mode>View        SceneRenderer + движения (реализует интерфейс *Motions контроллера)
  <модель>.ts       чистая логика раунда, без DOM
test/<mode>*.test.ts
```

- **Контроллер не рисует, вид не знает протокола.** Контроллер получает движения интерфейсом
  (`hop(): Promise<boolean>` и т. п.). Тест подставляет ручные движения (`test/recording.ts`,
  `manualMotions`) и проверяет главное правило ниже.
- **Темп раунда задаёт игра.** Событие конца хода (`SpinReady` / `DropFinished` / `RoundShown`)
  уходит только после того, как движение доиграло — `await` на промисе аниматора. Синхронно внутри
  `receive()` его не шлём никогда. Команды хоста играются по очереди (`kit/MoveQueue`).
- Движение, которое вернуло `false`, оборвано (игру уничтожили): дальше ничего не шлём.
- `createDemoBoot` уже делает общее для всех режимов: `host.ready()`, `UiVisibility`, `startSync`,
  тап по сцене как `RequestPlay`, тряску на `DisabledPlayPressed` и ленту команд в шапке.

## Стиль — один на все игры

- **Фон, шапка, лента бэкенда и конфетти — у сцены (`kit/Stage`).** Режим рисует только своё
  игровое поле в `frame.playfield`: это область под шапкой, без бет-бара хоста.
- **Цвета** — только из `kit/palette` (`PALETTE`), у режима свой акцент (`accent`). Акценты:
  crush — coral, twist — mint, slot-coin — amber, wheel — violet, plinko — sky, plinko-aztec — lime,
  jumper — pink. Поверхности — `panel` / `dusk`, текст — `ink` / `inkSoft` / `inkFaint`.
- **Шрифт** — `font()` / `drawText()` из кита: скруглённый системный, цифры 800, подписи 600–700.
  Большое число режима (множитель, выигрыш) — по центру сверху поля, над ним подпись капсом 12px
  `inkFaint`, под ним строка статуса 14px `inkSoft`.
- **Формы** — скруглённые (`fillRoundRect`, `RADIUS`), подсветка — `drawGlow` (радиальный градиент),
  а не `shadowBlur`.
- **Движение** — `kit/easing`. Переезды — `easeInOutCubic` 400–600 мс, появление — `easeOutBack`,
  посадка — короткий сквош 120–180 мс. Выигрыш — `stage.celebrate()`, проигрыш — `stage.shake()`
  и искры акцентом `coral`.
- **Подсказка в простое** («Tap to play») пульсирует, пока сцена ждёт хода (`isAnimating`).

## Производительность

Эталон — слабый Android рядом с шеллом.

- Кадры рисуются только по требованию (`kit/FrameLoop`): сцена в покое кадров не стоит.
- DPR ограничивает хост (`kit/Surface`).
- Градиенты фона кешируются.
- В кадре не создаём массивов и объектов без нужды.
