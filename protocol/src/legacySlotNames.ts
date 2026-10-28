/**
 * Прежние имена режима slot-coin — до 1.17.0 он назывался просто `slot`, пока
 * слот был один. Живут, пока живут хосты и игры на старых именах; удаляются
 * только сменой мажорной версии. Канал `ModeProtocols.slot` — там же, в `modes.ts`.
 */
import type { SlotCoinCommand } from './commands.js';
import type {
  SlotCoinAction,
  SlotCoinBoardCoin,
  SlotCoinCollectionAction,
  SlotCoinSpinResult,
} from './payloads.js';
import { SLOT_COIN_ACTIONS } from './payloads.js';

/** @deprecated Используйте `SlotCoinCommand`. */
export type SlotCommand = SlotCoinCommand;
/** @deprecated Используйте `SlotCoinSpinResult`. */
export type SlotSpinResult = SlotCoinSpinResult;
/** @deprecated Используйте `SlotCoinAction`. */
export type SlotAction = SlotCoinAction;
/** @deprecated Используйте `SlotCoinBoardCoin`. */
export type SlotCoin = SlotCoinBoardCoin;
/** @deprecated Используйте `SlotCoinCollectionAction`. */
export type SlotCoinsCollectionAction = SlotCoinCollectionAction;

/** @deprecated Используйте `SLOT_COIN_ACTIONS`. */
export const SLOT_ACTIONS = SLOT_COIN_ACTIONS;
