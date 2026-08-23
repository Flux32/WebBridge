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

/** Команды конкретно игры Road. Другая игра добавляет свой союз рядом. */
export type RoadCommand =
  | { type: 'SetAutoplay'; payload: boolean }
  | { type: 'RestartRound'; payload: string }
  | { type: 'UpdateCoeffs'; payload: number[] }
  | { type: 'ApplyStepResult'; payload: StepResultPayload }
  | { type: 'ApplyGameConfig'; payload: string }
  // Состояние сессии: «приведи сцену к этому». Им же идёт восстановление после
  // перезагрузки — отдельного RestoreGame(config+state) в мосте нет, движок сам
  // запрашивает config и state на старте сцены (RequestGameConfig / RequestGameState)
  // и повторяет запрос, пока не получит ответ.
  | { type: 'ApplyGameState'; payload: string }
  | { type: 'StartBonus'; payload: StartBonusPayload }
  | { type: 'ApplyBonusPurchaseResult'; payload: BonusPurchaseResultPayload }
  // Игрок нажал Cashout. Уходит в движок сразу по нажатию — до payout-запроса и до открытия окна,
  // то есть примерно за полсекунды до RestartRound. Движок использует эту фору, чтобы поднять
  // камеру к верхушке башни, ПОКА окно открывается.
  | { type: 'CashoutPressed' };

export type EngineCommand = CoreCommand | RoadCommand;
export type EngineCommandType = EngineCommand['type'];
