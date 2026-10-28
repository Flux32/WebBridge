/**
 * Mine Slot plays the whole round — free spins included — from one ApplySpinResult and answers it with
 * one SpinReady; nothing else crosses its channel.
 */
import type { MineSlotSpinResult, ModeProtocols } from '../src';
import { MINE_SLOT_BLOCKS, MINE_SLOT_FIELD, MINE_SLOT_REELS, MINE_SLOT_SYMBOLS } from '../src';
import type { Equal, Expect } from './typeEqual';

const _spin: ModeProtocols['mineSlot']['commands'] = { type: 'ApplySpinResult', payload: '' };
const _ready: ModeProtocols['mineSlot']['events'] = { type: 'SpinReady' };

// @ts-expect-error A bought bonus comes back inside the spin reply, not as StartBonus.
const _noStartBonus: ModeProtocols['mineSlot']['commands'] = { type: 'StartBonus', payload: {} };

// @ts-expect-error Mine Slot reports a played round with SpinReady, not plinko's DropFinished.
const _noDropFinished: ModeProtocols['mineSlot']['events'] = { type: 'DropFinished' };

type _channel = Expect<Equal<ModeProtocols['mineSlot'], ModeProtocols['slotCoin']>>;
type _hitRound = Expect<Equal<MineSlotSpinResult['pickaxes'][number]['round'], number>>;

const _grid: 15 = (MINE_SLOT_REELS.count * MINE_SLOT_REELS.rows) as 15;
const _field: 30 = (MINE_SLOT_FIELD.columns * MINE_SLOT_FIELD.depth) as 30;
const _codes: readonly string[] = [MINE_SLOT_SYMBOLS.enchantedPickaxe, MINE_SLOT_BLOCKS.obsidian.code];
