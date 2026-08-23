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
  | { type: 'UiVisibility'; payload: UiVisibilityPayload }
  | { type: 'RequestGameConfig' }
  | { type: 'RequestGameState' }
  | { type: 'RequestWhiteLabel' }
  | { type: 'RequestFastGame' }
  | { type: 'FastGameChanged'; payload: boolean }
  | { type: 'RequestTranslations' }
  | { type: 'RequestBetBarViewportMetrics' };

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
  | { type: 'OpenTransitionScreen' }
  | { type: 'BonusPurchaseRequest'; payload: BonusPurchaseRequestPayload };

/** Телеметрия, которую умеет только Unity-сборка. */
export type UnityOnlyEvent = { type: 'UnityFrameSample'; payload: UnityFrameSamplePayload };

export type EngineEvent = CoreEvent | CrushEvent | UnityOnlyEvent;
export type EngineEventType = EngineEvent['type'];
