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
} from './payloads';

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
  | { type: 'SyncUiVisibility' }
  // Окно результата раунда (cashout / win / mega / super и финальное окно бонуски) появилось на
  // экране / полностью ушло. Движок гасит на это свой геймплейный UI (кэф-бар, бонус-панель) и
  // возвращает его только после закрытия: RestartRound уходит ещё во время показа окна, поэтому по
  // событиям раунда движок не может отличить «окно ещё висит» от «экран свободен».
  | { type: 'WinWindowOpened' }
  | { type: 'WinWindowClosed' }
  | { type: 'TransitionScreenOpenStarted' }
  | { type: 'TransitionScreenOpenFinished' }
  | { type: 'TransitionScreenCloseStarted' }
  | { type: 'TransitionScreenCloseFinished' };

/**
 * Команды режима Crush — «шаг по лесенке коэффициентов + кэшаут». Это режим
 * бэка (`gameType` в play/step/payout), а не одна игра: на нём живут Road,
 * MegaGrab и AngryMoney. Режим с другой механикой добавляет свой союз рядом.
 */
export type CrushCommand =
  | { type: 'SetAutoplay'; payload: boolean }
  | { type: 'RestartRound'; payload: string }
  | { type: 'UpdateCoeffs'; payload: number[] }
  | { type: 'ApplyStepResult'; payload: StepResultPayload }
  | { type: 'StartBonus'; payload: StartBonusPayload }
  | { type: 'ApplyBonusPurchaseResult'; payload: BonusPurchaseResultPayload }
  // Игрок нажал Cashout. Уходит в движок сразу по нажатию — до payout-запроса и до открытия окна,
  // то есть примерно за полсекунды до RestartRound. Движок использует эту фору, чтобы поднять
  // камеру к верхушке башни, ПОКА окно открывается.
  | { type: 'CashoutPressed' };

/** Команды Plinko: шарики и их падение. */
export type PlinkoCommand =
  | { type: 'SetBallsAmount'; payload: number }
  | { type: 'ApplyDropResult'; payload: string };

/** Команды колеса. */
export type WheelCommand = { type: 'ApplyRound'; payload: string };

/**
 * Команды Twist: спин живой сессии и шаг купленной серии фри-спинов. Оба
 * payload'а — сырой GameState-JSON, игра проигрывает их одним и тем же путём.
 */
export type TwistCommand =
  | { type: 'ApplySpinResult'; payload: string }
  | { type: 'ApplyBonusStepResult'; payload: string };

export type EngineCommand =
  | CoreCommand
  | CrushCommand
  | PlinkoCommand
  | WheelCommand
  | TwistCommand;
export type EngineCommandType = EngineCommand['type'];
