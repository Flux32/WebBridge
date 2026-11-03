/**
 * Dragon Pots plays the whole round — base spin, pots, jackpot pick, Hold & Win — from one ApplySpinResult
 * and answers it with one SpinReady; nothing else crosses its channel, no step either.
 */
import type { DragonPotsGameState, DragonPotsSpinResult, ModeProtocols } from '../src';
import {
  DRAGON_POTS_BOARD_SIZES,
  DRAGON_POTS_BONUS_BUYS,
  DRAGON_POTS_BONUS_TYPES,
  DRAGON_POTS_JACKPOT_TIERS,
  DRAGON_POTS_REELS,
  DRAGON_POTS_SYMBOLS,
} from '../src';
import type { Equal, Expect } from './typeEqual';

type Channel = ModeProtocols['dragonPots'];

const _spin: Channel['commands'] = { type: 'ApplySpinResult', payload: '' };
const _ready: Channel['events'] = { type: 'SpinReady' };

type _channel = Expect<Equal<Channel, ModeProtocols['mineSlot']>>;

// @ts-expect-error The round is atomic: the engine never asks for a step.
const _noRequestStep: Channel['events'] = { type: 'RequestStep' };

// @ts-expect-error The round is atomic: no step reply follows the spin reply.
const _noStepResult: Channel['commands'] = { type: 'ApplyBonusStepResult', payload: '' };

// @ts-expect-error A bought bonus comes back in the play reply, not as StartBonus.
const _noStartBonus: Channel['commands'] = { type: 'StartBonus', payload: {} };

// @ts-expect-error The round ends with SpinReady, not plinko's DropFinished.
const _noDropFinished: Channel['events'] = { type: 'DropFinished' };

type _bonusName = Expect<
  Equal<
    DragonPotsSpinResult['roundResult']['bonusTypeName'],
    '' | 'Mighty' | 'Mega' | 'Super' | 'Jackpot' | 'Ultra' | 'Supreme' | 'Ultimate' | 'Lose'
  >
>;
type _lenientCoeff = Expect<Equal<DragonPotsSpinResult['coeff'], number | string>>;
type _holdAndWinColumn = Expect<
  Equal<NonNullable<DragonPotsSpinResult['roundResult']['holdAndWinResult']>['initial']['coins'][number]['colIndex'], number>
>;
type _tiles = Expect<Equal<NonNullable<DragonPotsSpinResult['roundResult']['jackpotResult']>['scenario'][number], 1 | 2 | 3 | 4 | 5>>;

const _emptyState: DragonPotsGameState = {};
// @ts-expect-error get-game-state is always empty: there is no round to restore.
const _noRoundState: DragonPotsGameState = { status: 'none' };

const _grid: 15 = (DRAGON_POTS_REELS.count * DRAGON_POTS_REELS.rows) as 15;
const _coin: 'M' = DRAGON_POTS_SYMBOLS.coin;
const _superPrice: 80 = DRAGON_POTS_BONUS_BUYS.Super.priceInBets;
const _megaBoard: 4 = DRAGON_POTS_BOARD_SIZES[DRAGON_POTS_BONUS_BUYS.Mega.boardSize].rows;
const _ultimateIndex: 6 = DRAGON_POTS_BONUS_TYPES.Ultimate.index;
const _grand: 2000 = DRAGON_POTS_JACKPOT_TIERS[4].coeff;
