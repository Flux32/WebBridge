/**
 * Fruit Love Fever plays the base spin from ApplySpinResult, a bonus game free spin by free spin
 * (RequestStep → ApplyBonusStepResult), and answers the round with one SpinReady. The wire names are
 * plinko-aztec's; nothing else crosses the channel.
 */
import type { FruitLoveFeverGameState, FruitLoveFeverSpinResult, FruitLoveFeverStepResult, ModeProtocols } from '../src';
import {
  FRUIT_LOVE_FEVER_BONUS_BUYS,
  FRUIT_LOVE_FEVER_REELS,
  FRUIT_LOVE_FEVER_SYMBOL_NAMES,
  FRUIT_LOVE_FEVER_SYMBOLS,
} from '../src';
import type { Equal, Expect } from './typeEqual';

type Channel = ModeProtocols['fruitLoveFever'];

const _spin: Channel['commands'] = { type: 'ApplySpinResult', payload: '' };
const _step: Channel['commands'] = { type: 'ApplyBonusStepResult', payload: '' };
const _ready: Channel['events'] = { type: 'SpinReady' };
const _requestStep: Channel['events'] = { type: 'RequestStep' };

type _commands = Expect<Equal<Channel['commands']['type'], 'ApplySpinResult' | 'ApplyBonusStepResult'>>;
type _events = Expect<Equal<Channel['events']['type'], 'SpinReady' | 'RequestStep'>>;

// @ts-expect-error A bought bonus comes back in the play reply, not as StartBonus.
const _noStartBonus: Channel['commands'] = { type: 'StartBonus', payload: {} };

// @ts-expect-error The round ends with SpinReady, not plinko's DropFinished.
const _noDropFinished: Channel['events'] = { type: 'DropFinished' };

// @ts-expect-error The bet bar is the host's; no balls amount crosses this channel.
const _noBallsAmount: Channel['commands'] = { type: 'SetBallsAmount', payload: 1 };

type _stepHasBonus = Expect<Equal<FruitLoveFeverStepResult['bonusGame']['currentGameNumber'], number | null>>;
type _lenientLine = Expect<Equal<FruitLoveFeverSpinResult['slot']['winLines'][number]['line'], number | string>>;
type _lenientCoeff = Expect<Equal<FruitLoveFeverSpinResult['coeff'], number | string>>;
type _buys = Expect<Equal<NonNullable<FruitLoveFeverSpinResult['bonusBuy']>, 'x75' | 'x200'>>;

const _noRound: FruitLoveFeverGameState = { status: 'none' };
const _grid: 15 = (FRUIT_LOVE_FEVER_REELS.count * FRUIT_LOVE_FEVER_REELS.rows) as 15;
const _scatterName: 'Scatter' = FRUIT_LOVE_FEVER_SYMBOL_NAMES[FRUIT_LOVE_FEVER_SYMBOLS.scatter];
const _price: 200 = FRUIT_LOVE_FEVER_BONUS_BUYS.x200.priceInBets;
