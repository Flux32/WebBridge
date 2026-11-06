/**
 * Joker Slot plays the whole round — base board and every bonus board, landed or bought — from one
 * ApplySpinResult and answers it with one SpinReady; nothing else crosses its channel, no step either.
 */
import type { JokerSlotAction, JokerSlotBonusBuy, JokerSlotGameState, JokerSlotSpinResult, ModeProtocols } from '../src';
import {
  JOKER_SLOT_ACTIONS,
  JOKER_SLOT_BONUS_BUYS,
  JOKER_SLOT_COIN_COEFFS,
  JOKER_SLOT_REELS,
  JOKER_SLOT_SYMBOLS,
  JOKER_SLOT_WIN_LINES,
} from '../src';
import type { Equal, Expect } from './typeEqual';

type Channel = ModeProtocols['jokerSlot'];

const _spin: Channel['commands'] = { type: 'ApplySpinResult', payload: '' };
const _ready: Channel['events'] = { type: 'SpinReady' };

type _channel = Expect<Equal<Channel, ModeProtocols['slotCoin']>>;

// @ts-expect-error The round is atomic: the engine never asks for a step.
const _noRequestStep: Channel['events'] = { type: 'RequestStep' };

// @ts-expect-error A bought bonus comes back in the play reply, not as StartBonus.
const _noStartBonus: Channel['commands'] = { type: 'StartBonus', payload: {} };

// @ts-expect-error The bonus is the engine's own run of boards: it sends no BonusActive.
const _noBonusActive: Channel['events'] = { type: 'BonusActive', payload: true };

type _buys = Expect<Equal<JokerSlotBonusBuy, 'x75' | 'x200'>>;
type _lenientCoeff = Expect<Equal<JokerSlotSpinResult['coeff'], number | string>>;
type _openActions = Expect<Equal<JokerSlotSpinResult['actions'][number][number], JokerSlotAction>>;

const _state: JokerSlotGameState = { status: 'none' };
// @ts-expect-error get-game-state never carries a round to restore.
const _noRoundState: JokerSlotGameState = { status: 'in-game' };

const _unknownAction: JokerSlotAction = { action: 'SOMETHING_NEW', extra: 1 };

const _grid: 12 = (JOKER_SLOT_REELS.count * JOKER_SLOT_REELS.rows) as 12;
const _joker: 'l' = JOKER_SLOT_SYMBOLS.joker;
const _superJoker: 'm' = JOKER_SLOT_SYMBOLS.superJoker;
const _superPrice: 200 = JOKER_SLOT_BONUS_BUYS.x200;
const _grand: 1000 = JOKER_SLOT_COIN_COEFFS.k;
const _middleRow: readonly [1, 5, 9] = JOKER_SLOT_WIN_LINES[1];
const _collection: 'STRIKE_COINS_COLLECTION' = JOKER_SLOT_ACTIONS.coinsCollection;
