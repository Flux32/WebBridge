/**
 * Guards the 1.7.0 shape of the types this step does not touch. `RoundEvent`
 * is a new alias for the same `{ type: 'SpinReady' }` shape `CrushEvent`
 * carried inline before, so it must stay structurally invisible here.
 */
import type {
  BonusPurchaseRequestPayload,
  BonusPurchaseResultPayload,
  Orientation,
  StartBonusPayload,
  StepResultPayload,
  UiVisibilityPayload,
  UnityFrameSamplePayload,
  WinWindowSignalPayload,
} from '../src';
import type { CrushEvent, EngineCommand, EngineEvent } from '../src';
import type { Equal, Expect } from './typeEqual';

type CrushEvent170 =
  | { type: 'BonusProgressSave'; raw: string }
  | { type: 'BonusProgressClear' }
  | { type: 'BonusActive' }
  | { type: 'BonusEnded' }
  | { type: 'BonusCleared' }
  | { type: 'SpinReady' }
  | { type: 'BonusPurchaseRequest'; payload: BonusPurchaseRequestPayload };

type _crushEventUnchanged = Expect<Equal<CrushEvent, CrushEvent170>>;

type EngineCommand170 =
  | { type: 'ApplyWhiteLabel'; payload: boolean }
  | { type: 'SetFastGame'; payload: boolean }
  | { type: 'SetLoggingEnabled'; payload: boolean }
  | { type: 'ChangeOrientation'; payload: Orientation }
  | { type: 'SetAssetsBasePath'; payload: string }
  | { type: 'ApplyTranslations'; payload: string }
  | { type: 'ApplyGameConfig'; payload: string }
  | { type: 'ApplyGameState'; payload: string }
  | { type: 'SetDesktopBetBarViewportMetrics'; payload: string }
  | { type: 'SetMobileBetBarViewportMetrics'; payload: string }
  | { type: 'SyncUiVisibility' }
  | { type: 'DisabledPlayPressed' }
  | { type: 'CashoutPressed' }
  | { type: 'WinWindowOpened' }
  | { type: 'WinWindowClosed' }
  | { type: 'WinWindowSignal'; payload: WinWindowSignalPayload }
  | { type: 'TransitionScreenOpenStarted' }
  | { type: 'TransitionScreenOpenFinished' }
  | { type: 'TransitionScreenCloseStarted' }
  | { type: 'TransitionScreenCloseFinished' }
  | { type: 'SetAutoplay'; payload: boolean }
  | { type: 'RestartRound'; payload: string }
  | { type: 'UpdateCoeffs'; payload: number[] }
  | { type: 'ApplyStepResult'; payload: StepResultPayload }
  | { type: 'StartBonus'; payload: StartBonusPayload }
  | { type: 'ApplyBonusPurchaseResult'; payload: BonusPurchaseResultPayload }
  | { type: 'SetBallsAmount'; payload: number }
  | { type: 'ApplyDropResult'; payload: string }
  | { type: 'ApplyRound'; payload: string }
  | { type: 'ApplySpinResult'; payload: string }
  | { type: 'ApplyBonusStepResult'; payload: string }
  | { type: 'FreeGamesIntroFinished' };

type _engineCommandUnchanged = Expect<Equal<EngineCommand, EngineCommand170>>;

type EngineEvent170 =
  | { type: 'PlaySound'; key: string; volume?: number }
  | { type: 'PlayMusic'; key: string; volume?: number }
  | { type: 'PlayLoop'; key: string; volume?: number }
  | { type: 'StopLoop'; key: string }
  | { type: 'SetVolume'; key: string; volume: number }
  | { type: 'UiVisibility'; payload: UiVisibilityPayload }
  | { type: 'RequestGameConfig' }
  | { type: 'RequestGameState' }
  | { type: 'RequestWhiteLabel' }
  | { type: 'RequestFastGame' }
  | { type: 'FastGameChanged'; enabled: boolean }
  | { type: 'RequestTranslations' }
  | { type: 'RequestBetBarViewportMetrics' }
  | { type: 'OpenTransitionScreen' }
  | { type: 'CloseTransitionScreen' }
  | CrushEvent170
  | { type: 'DropFinished' }
  | { type: 'RequestBallsAmount' }
  | { type: 'RequestStep' }
  | { type: 'RoundShown' }
  | { type: 'UnityFrameSample'; payload: UnityFrameSamplePayload };

type _engineEventUnchanged = Expect<Equal<EngineEvent, EngineEvent170>>;
