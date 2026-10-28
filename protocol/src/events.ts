/**
 * События игра → React. Сырой формат движка (префиксы `PlaySound_`, JSON-строки
 * у Unity) разбирается транспортом — бизнес-логика видит только `event.type`.
 */
import type {
  BonusPurchaseRequestPayload,
  UiVisibilityPayload,
  UnityFrameSamplePayload,
} from './payloads.js';

/** События, которые шлёт любой мост независимо от игры. */
export type CoreEvent =
  | { type: 'PlaySound'; key: string; volume?: number }
  | { type: 'PlayMusic'; key: string; volume?: number }
  | { type: 'PlayLoop'; key: string; volume?: number }
  | { type: 'StopLoop'; key: string }
  // Громкость уже играющего звука, включая музыку.
  | { type: 'SetVolume'; key: string; volume: number }
  | { type: 'UiVisibility'; payload: UiVisibilityPayload }
  | { type: 'RequestGameConfig' }
  | { type: 'RequestGameState' }
  | { type: 'RequestWhiteLabel' }
  | { type: 'RequestFastGame' }
  // Поля событий лежат на верхнем уровне, без обёртки payload — как key/volume
  // у звуковых и raw у прогресса бонуса.
  | { type: 'FastGameChanged'; enabled: boolean }
  | { type: 'RequestTranslations' }
  | { type: 'RequestBetBarViewportMetrics' }
  // Игрок сделал ход в самой сцене (тап по полю, своя кнопка игры), а не кнопкой Play бет-бара.
  // Ставку игра не делает и не решает, можно ли её делать: ставка, лимиты, баланс и блокировка
  // кнопки живут в хосте. Хост отвечает так же, как на нажатие Play бет-бара: ход идёт обычным
  // путём (результат приходит командой своего режима), а если Play сейчас неактивна — приходит
  // `DisabledPlayPressed`. Автоплей этим событием не переключается: пока он идёт, ответ тот же отказ.
  | { type: 'RequestPlay' }
  | { type: 'OpenTransitionScreen' }
  | { type: 'CloseTransitionScreen' };

/**
 * Движок доиграл анимацию шага/спина и готов принять следующий ход: этим
 * React разблокирует бет-бар. Общее для всех server-driven раундовых
 * режимов (crush, twist, slot-coin), не только Crush.
 */
export type RoundEvent = { type: 'SpinReady' };

/** События режима Crush. */
export type CrushEvent =
  | { type: 'BonusProgressSave'; raw: string }
  | { type: 'BonusProgressClear' }
  | { type: 'BonusActive' }
  | { type: 'BonusEnded' }
  | { type: 'BonusCleared' }
  | RoundEvent
  | { type: 'BonusPurchaseRequest'; payload: BonusPurchaseRequestPayload };

/** События Plinko. */
export type PlinkoEvent =
  | { type: 'DropFinished' }
  | { type: 'RequestBallsAmount' }
  | { type: 'RequestBetPerBall' }
  | { type: 'RequestStep' };

/** События колеса: раунд показан игроку. */
export type WheelEvent = { type: 'RoundShown' };

/** Телеметрия, которую умеет только Unity-сборка. */
export type UnityOnlyEvent = { type: 'UnityFrameSample'; payload: UnityFrameSamplePayload };

export type EngineEvent =
  | CoreEvent
  | CrushEvent
  | PlinkoEvent
  | WheelEvent
  | UnityOnlyEvent;

export type EngineEventType = EngineEvent['type'];

/** События бонуса — их хост маршрутизирует отдельно от остальных. */
export type BonusEngineEvent = Extract<
  EngineEvent,
  { type: 'BonusProgressSave' | 'BonusProgressClear' | 'BonusActive' | 'BonusEnded' | 'BonusCleared' }
>;

const BONUS_EVENT_TYPES = new Set<EngineEventType>([
  'BonusProgressSave',
  'BonusProgressClear',
  'BonusActive',
  'BonusEnded',
  'BonusCleared',
]);

export const isBonusEngineEvent = (event: EngineEvent): event is BonusEngineEvent =>
  BONUS_EVENT_TYPES.has(event.type);
