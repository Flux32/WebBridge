/**
 * Every engine command/event belongs to the core set or to exactly one
 * mode's channel, and a mode's command/event union does not silently gain
 * a member that belongs to a different mode.
 */
import type {
  CoreCommand,
  CoreEvent,
  EngineCommand,
  EngineEvent,
  ModeProtocolId,
  ModeProtocols,
  UnityOnlyEvent,
  UnityPlainMessage,
} from '../src';
import type { Equal, Expect } from './typeEqual';

type AllChannelCommands = ModeProtocols[ModeProtocolId]['commands'];
type AllChannelEvents = ModeProtocols[ModeProtocolId]['events'];

type _commandsCoverEngine = Expect<Equal<CoreCommand | AllChannelCommands, EngineCommand>>;
type _eventsCoverEngine = Expect<Equal<CoreEvent | UnityOnlyEvent | AllChannelEvents, EngineEvent>>;

// Negative cases: a command/event stays out of a channel it does not belong to.
// @ts-expect-error ApplySpinResult is the twist/slot spin command, not crush's.
const _crushHasNoApplySpinResult: ModeProtocols['crush']['commands'] = { type: 'ApplySpinResult', payload: '' };

// @ts-expect-error ApplyStepResult is crush's ladder-step command, not plinko's.
const _plinkoHasNoApplyStepResult: ModeProtocols['plinko']['commands'] = { type: 'ApplyStepResult' };

// @ts-expect-error SpinReady is the crush/twist/slot round-ready event, not wheel's.
const _wheelHasNoSpinReady: ModeProtocols['wheel']['events'] = { type: 'SpinReady' };

// Positive cases from the brief.
const _plinkoAztecHasApplyBonusStepResult: ModeProtocols['plinkoAztec']['commands'] = {
  type: 'ApplyBonusStepResult',
  payload: '',
};

const _plinkoAztecHasSetBetPerBall: ModeProtocols['plinkoAztec']['commands'] = {
  type: 'SetBetPerBall',
  payload: '0.2',
};
const _plinkoAztecHasRequestBetPerBall: ModeProtocols['plinkoAztec']['events'] = { type: 'RequestBetPerBall' };

// The bet-per-ball request is a bare string on the Unity wire, like RequestBallsAmount.
const _requestBetPerBallIsPlain: UnityPlainMessage = 'RequestBetPerBall';

// Classic plinko has no bet bar of its own on the engine side.
// @ts-expect-error SetBetPerBall belongs to plinko-aztec's channel, not plinko's.
const _plinkoHasNoSetBetPerBall: ModeProtocols['plinko']['commands'] = { type: 'SetBetPerBall', payload: '1' };

// @ts-expect-error RequestBetPerBall belongs to plinko-aztec's channel, not plinko's.
const _plinkoHasNoRequestBetPerBall: ModeProtocols['plinko']['events'] = { type: 'RequestBetPerBall' };

const _twistHasSpinReady: ModeProtocols['twist']['events'] = { type: 'SpinReady' };
const _slotHasSpinReady: ModeProtocols['slot']['events'] = { type: 'SpinReady' };

// The twist bridge (TwistReact) never sends these; the host drives twist's
// bonus purchase itself via StartBonus, and BonusCleared is crush-only.
// @ts-expect-error BonusPurchaseRequest is not sent by the twist bridge.
const _twistHasNoBonusPurchaseRequest: ModeProtocols['twist']['events'] = { type: 'BonusPurchaseRequest', payload: {} };

// @ts-expect-error BonusCleared is not sent by the twist bridge.
const _twistHasNoBonusCleared: ModeProtocols['twist']['events'] = { type: 'BonusCleared' };

void _crushHasNoApplySpinResult;
void _plinkoHasNoApplyStepResult;
void _wheelHasNoSpinReady;
void _plinkoAztecHasApplyBonusStepResult;
void _plinkoAztecHasSetBetPerBall;
void _plinkoAztecHasRequestBetPerBall;
void _requestBetPerBallIsPlain;
void _plinkoHasNoSetBetPerBall;
void _plinkoHasNoRequestBetPerBall;
void _twistHasSpinReady;
void _slotHasSpinReady;
void _twistHasNoBonusPurchaseRequest;
void _twistHasNoBonusCleared;
