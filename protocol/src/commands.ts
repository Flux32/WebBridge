/**
 * Команды React → игра. Дискриминированное объединение: `type` — доменное имя,
 * `payload` — нативное значение.
 *
 * Часть payload'ов типизирована как `string` намеренно: они приходят уже
 * сериализованными от своих билдеров, и на этой строке держится дедуп в
 * `useAppLogic` (lastGameConfigPayloadRef). Мост на стороне игры парсит их сам.
 */
import type {
  BonusPurchaseResultPayload,
  Orientation,
  StartBonusPayload,
  StepResultPayload,
  WinWindowSignalPayload,
} from './payloads.js';
import type { JumperDifficulty, JumperMovePayload } from './jumper.js';

/** Команды, которые понимает любой мост независимо от игры (см. C# WebBridgeBase + Layout/Orientation/UI). */
export type CoreCommand =
  | { type: 'ApplyWhiteLabel'; payload: boolean }
  | { type: 'SetFastGame'; payload: boolean }
  | { type: 'SetLoggingEnabled'; payload: boolean }
  | { type: 'ChangeOrientation'; payload: Orientation }
  | { type: 'SetAssetsBasePath'; payload: string }
  | { type: 'ApplyTranslations'; payload: string }
  // Конфиг и состояние сессии нужны любой игре: «приведи сцену к этому».
  // Ими же идёт восстановление после перезагрузки — отдельного
  // RestoreGame(config+state) нет, движок сам запрашивает и то и другое на
  // старте сцены и повторяет запрос, пока не получит ответ.
  | { type: 'ApplyGameConfig'; payload: string }
  | { type: 'ApplyGameState'; payload: string }
  | { type: 'SetDesktopBetBarViewportMetrics'; payload: string }
  | { type: 'SetMobileBetBarViewportMetrics'; payload: string }
  // Размер холста движка в CSS-пикселях страницы: JSON `CanvasSizePayload`. Игра сама его не
  // узнает: `Screen` в WebGL меряет буфер холста, а он умножен на devicePixelRatio, который хост
  // подбирает под устройство и меняет на ходу. Хост шлёт размер после загрузки движка, при
  // каждом ресайзе холста и в ответ на `RequestBetBarViewportMetrics`.
  | { type: 'SetCanvasSize'; payload: string }
  | { type: 'SyncUiVisibility' }
  // Игрок нажал Play, пока бет-бар держит кнопку неактивной (раунд ещё идёт, не хватает
  // баланса, ставка вне лимитов). Ставка при этом не уходит: команда нужна движку, чтобы
  // отыграть отказ — состояния кнопки у него нет, её блокировку знает только React.
  | { type: 'DisabledPlayPressed' }
  // Полный кэшаут выплачен. Хост шлёт её, когда сервер уже заплатил, в том же такте, где
  // открывает окно результата (без окна — вместе с RestartRound), и раньше payout-команды
  // режима. RestartRound приходит лишь когда окно закрылось, поэтому это единственный момент,
  // когда игра может убрать со сцены то, что принадлежит живому раунду, вместе с появлением
  // окна. Отказ payout её не шлёт: раунд остаётся живым. Команда общая: кэшаут есть не
  // только в Crush, и приёмник для неё стоит на базе моста, а не на режиме.
  | { type: 'CashoutPressed' }
  // Окно результата раунда (cashout / win / mega / super и финальное окно бонуски) появилось на
  // экране / полностью ушло. Движок гасит на это свой геймплейный UI (кэф-бар, бонус-панель) и
  // возвращает его только после закрытия: RestartRound уходит ещё во время показа окна, поэтому по
  // событиям раунда движок не может отличить «окно ещё висит» от «экран свободен».
  | { type: 'WinWindowOpened' }
  | { type: 'WinWindowClosed' }
  // Сценарий окна результата дошёл до именованной отметки. Имя расставляет
  // админ в games-configurator, и смысл его знает игра: хост только доносит
  // имя вместе с ключом окна, которое его назвало.
  | { type: 'WinWindowSignal'; payload: WinWindowSignalPayload }
  | { type: 'TransitionScreenOpenStarted' }
  | { type: 'TransitionScreenOpenFinished' }
  | { type: 'TransitionScreenCloseStarted' }
  | { type: 'TransitionScreenCloseFinished' };

/**
 * Crush difficulty levels by the backend's names (`value.difficulty`). The set
 * is closed and travels by name, not by index, so the wire never depends on
 * the order of an engine-side enum.
 */
export const CRUSH_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'DAREDEVIL'] as const;

export type CrushDifficulty = (typeof CRUSH_DIFFICULTIES)[number];

/**
 * Команды режима Crush — «шаг по лесенке коэффициентов + кэшаут». Это режим
 * бэка (`gameType` в play/step/payout), а не одна игра: на нём живут Road,
 * MegaGrab и AngryMoney. Режим с другой механикой добавляет свой союз рядом.
 */
export type CrushCommand =
  | { type: 'SetAutoplay'; payload: boolean }
  | { type: 'RestartRound'; payload: string }
  // The difficulty in play. The host sends it before the ladder (UpdateCoeffs/ApplyGameConfig)
  // of the same sync pass, so the engine already knows it when the new coefficients arrive.
  | { type: 'SetDifficulty'; payload: CrushDifficulty }
  | { type: 'UpdateCoeffs'; payload: number[] }
  | { type: 'ApplyStepResult'; payload: StepResultPayload }
  | { type: 'StartBonus'; payload: StartBonusPayload }
  | { type: 'ApplyBonusPurchaseResult'; payload: BonusPurchaseResultPayload };

/** Команды Plinko: шарики, ставка за шар, падение и шаг бонуса plinko-aztec. */
export type PlinkoCommand =
  | { type: 'SetBallsAmount'; payload: number }
  // Ставка за шар — десятичная строка как `betPerBall` бэкенда ("0.2", "2"): деньги не идут через number.
  | { type: 'SetBetPerBall'; payload: string }
  | { type: 'ApplyDropResult'; payload: string }
  // Ответ сервера на шаг бонусной игры plinko-aztec и фри-спин fruit-love-fever (после `RequestStep`):
  // сырой GameState-JSON.
  | { type: 'ApplyBonusStepResult'; payload: string };

/** Команды колеса. */
export type WheelCommand =
  | { type: 'ApplyRound'; payload: string }
  // Где бар колеса встречается с игрой: JSON `WheelBetBarMetricsPayload`. Своя команда, а не
  // общий `Set*BetBarViewportMetrics`: у бара колеса нет ни кнопки, ни панели бонуса, его края —
  // полоса отсчёта раунда и лента истории. Хост шлёт её заново, когда бар сдвинулся или сменил
  // масштаб, и в ответ на `RequestBetBarViewportMetrics`.
  | { type: 'SetWheelBetBarMetrics'; payload: string };

/**
 * Jumper commands beyond the round flow it shares with crush (autoplay, restart,
 * bonus start). The difficulty has its own command: jumper's set has no DAREDEVIL.
 */
export type JumperCommand =
  | { type: 'SetJumperDifficulty'; payload: JumperDifficulty }
  | { type: 'ApplyJumperMove'; payload: JumperMovePayload };

/**
 * Результат спина — общий для всех барабанных механик. Payload сериализован:
 * Twist шлёт сырой GameState-JSON, slot-coin — `SlotCoinSpinResult`. Имя команды на
 * проводе одно (фронтенд шлёт именно его обеим механикам), поэтому член союза
 * тоже один, а разбирает payload мост своей механики.
 */
export type SpinCommand = { type: 'ApplySpinResult'; payload: string };

/**
 * Команды Twist: спин живой сессии (сырой GameState-JSON) и отмашка серии
 * фри-спинов. Шаги серии хост не шлёт: её игра крутит сама из `StartBonus`.
 */
export type TwistCommand =
  | SpinCommand
  // Интро иконки фри-спинов на стороне хоста доиграло — серию можно крутить.
  // Серию ведёт игра, поэтому и отмашка нужна ей: `StartBonus` приходит ещё под
  // закрытой шторкой перехода, там игра меняет локацию и готовит доску, а
  // первый спин ждёт этой команды. Хост шлёт её и когда интро не играет вовсе
  // (иконка не загружена), чтобы игра никогда не ждала впустую.
  | { type: 'FreeGamesIntroFinished' };

/**
 * Команды режима slot-coin. Раунд приходит целиком одним `ApplySpinResult` — включая
 * бонусные доски, — поэтому докручивать здесь нечего: своих команд у механики
 * нет, а восстанавливать между спинами барабану тоже нечего
 * (`slotCoinSession.restoreCommands` во фронтенде пуст).
 */
export type SlotCoinCommand = SpinCommand;

/**
 * Команды Mine Slot. Как и у slot-coin, раунд приходит целиком одним `ApplySpinResult` — ответ сервера на
 * play с фри-спинами купленного или выпавшего бонуса, — поэтому своих команд у механики нет.
 */
export type MineSlotCommand = SpinCommand;

export type EngineCommand =
  | CoreCommand
  | CrushCommand
  | PlinkoCommand
  | WheelCommand
  | JumperCommand
  | TwistCommand
  | SlotCoinCommand
  | MineSlotCommand;
export type EngineCommandType = EngineCommand['type'];
