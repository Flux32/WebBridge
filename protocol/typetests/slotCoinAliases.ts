/**
 * The pre-1.17.0 slot names are the very same types as the slot-coin ones: a host or a
 * game still on the old names speaks the same contract as one on the new names.
 */
import type {
  ModeProtocols,
  SlotAction,
  SlotCoin,
  SlotCoinAction,
  SlotCoinBoardCoin,
  SlotCoinCollectionAction,
  SlotCoinCommand,
  SlotCoinsCollectionAction,
  SlotCoinSpinResult,
  SlotCommand,
  SlotSpinResult,
} from '../src';
import { SLOT_ACTIONS, SLOT_COIN_ACTIONS } from '../src';
import type { Equal, Expect } from './typeEqual';

type _commandAlias = Expect<Equal<SlotCommand, SlotCoinCommand>>;
type _spinResultAlias = Expect<Equal<SlotSpinResult, SlotCoinSpinResult>>;
type _actionAlias = Expect<Equal<SlotAction, SlotCoinAction>>;
type _coinAlias = Expect<Equal<SlotCoin, SlotCoinBoardCoin>>;
type _collectionAlias = Expect<Equal<SlotCoinsCollectionAction, SlotCoinCollectionAction>>;
type _actionsAlias = Expect<Equal<typeof SLOT_ACTIONS, typeof SLOT_COIN_ACTIONS>>;
type _channelAlias = Expect<Equal<ModeProtocols['slot'], ModeProtocols['slotCoin']>>;
