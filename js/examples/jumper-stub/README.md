# jumper-stub

Заглушка игры режима `jumper`: `JumperBridge` + Canvas 2D, без движка и ассетов. Нужна, чтобы
проверить режим jumper в шелле RoadFrontent вживую, пока настоящего движка Jumper нет. Игра
ходит по настоящему пути веб-игры — `createWebBoot` / `registerWebBoot`, `/game.js` с
dev-сервера через `localBuildServer` — и отвечает хосту так, как обязан настоящий движок.

Живёт вне пакета `@omega/webbridge-js` (в `js/examples/`, своим workspace): в релиз пакета не
попадает, а мост берёт так же, как любая игра, — по имени пакета.

## Запуск

```bash
npm install                               # в корне репозитория, один раз
npm run dev -w js/examples/jumper-stub    # http://localhost:5181, порт фиксирован
```

`dev` сначала собирает мост (`tsc -b js/webbridge`) — заглушка берёт его `dist`, как игра из
npm. Правка моста подхватывается перезапуском `dev`.

### В шелле

Шелл стенда или локальный (`npm run dev` в RoadFrontent) с параметрами:

```text
?operatorId=…&authToken=…&currency=USD&lang=en&gameMode=jumper&gameCategory=jumper&configuratorGameId=…&localBuild=http://localhost:5181
```

- `engine=web` не нужен: `localBuild` сам ставит веб-движок поверх движка из конфигурации
  (`EngineProvider` шелла).
- Шелл грузит `http://localhost:5181/game.js` модулем; адрес — только `localhost` /
  `127.0.0.1` / `[::1]`, и только на стенде: в релизном пакете `localBuild` нет.
- `gameCategory=jumper` шелл принимает, когда в нём есть режим jumper.

Через админку: редактор игры с `?localBuild=http%3A%2F%2Flocalhost%3A5181` — ссылку на
подключение dev-сервер печатает в консоль при старте (`WebBridge admin: …`). Браузер сам не
открывается (`server.open: false`).

### Без шелла

`http://localhost:5181/?mock=1` — вместо шелла `JumperMockHost`, игра та же.

| Ввод | Что делает |
|---|---|
| Тап / Пробел | Ход: первый открывает раунд и прыгает на ступень 0 |
| C | Кэшаут |
| B | Купить бонус (между раундами) |
| D | Следующая сложность (между раундами) |

## Что делает заглушка

| Хост → игра | Игра |
|---|---|
| старт | `UiVisibility` (бары видны и активны), `RequestGameConfig`, `RequestGameState`, затем `host.ready()` на первом кадре |
| `ApplyGameConfig` + `SetJumperDifficulty` | Рисует лесенку текущей сложности с коэффициентами |
| `ApplyGameState` | Восстанавливает раунд: слоты, ступень игрока, коэффициент |
| `ApplyJumperMove` `play` | Раскладывает слоты (`HIDDEN`), игрок на старте; `SpinReady` нет |
| `ApplyJumperMove` `step` | Прыжок и цепочка ускорителей по `visitedSteps` за ~600 мс, на проигрыше — падение на `collisionPosition`; затем `SpinReady` |
| `ApplyJumperMove` `payout` | Закрытый раунд (крестик на `collisionPosition`), ждёт `RestartRound` |
| `RestartRound` | Сцена сброшена |
| `StartBonus` | `BonusActive`; каждый фри-гейм по маршруту ~300 мс, после него `BonusProgressSave` `{ completedIterations, totalIterations }`; затем `BonusEnded` |
| `DisabledPlayPressed` | Короткая тряска сцены |

Тап по канвасу — `RequestPlay`. Слот раскрывается, когда игрок до него долетел. Звука нет.
