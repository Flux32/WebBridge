/**
 * События игра → React. Сырой формат движка (префиксы `PlaySound_`, JSON-строки
 * у Unity) разбирается транспортом — бизнес-логика видит только `event.type`.
 */
import type {
  BonusPurchaseRequestPayload,
  UiVisibilityPayload,
  UnityFrameSamplePayload,
} from './payloads';

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
  | { type: 'OpenTransitionScreen' }
  | { type: 'CloseTransitionScreen' };

/** События режима Crush. */
export type CrushEvent =
  | { type: 'BonusProgressSave'; raw: string }
  | { type: 'BonusProgressClear' }
  | { type: 'BonusActive' }
  | { type: 'BonusEnded' }
  | { type: 'BonusCleared' }
  // Движок доиграл анимацию шага и готов принять следующий: этим React
  // разблокирует бет-бар.
  | { type: 'SpinReady' }
  | { type: 'BonusPurchaseRequest'; payload: BonusPurchaseRequestPayload };

/** События Plinko. */
export type PlinkoEvent =
  | { type: 'DropFinished' }
  | { type: 'RequestBallsAmount' }
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
