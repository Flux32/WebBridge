/**
 * One Dragon Pots round as the stage backend deals it, for the mock host: the whole round in one reply.
 * The pots' outcome is drawn first (or forced, or bought), then the coins that land are placed to fit it —
 * every pot that triggers got a coin, and a coin may land in a pot that does not trigger. The base board's
 * ways are evaluated on the final matrix, coins included; a jackpot pick and a Hold & Win follow the
 * outcome. A bought bonus is a Hold & Win with an empty `bonusTypeName`, a base board that pays nothing and
 * coefficients against its full price.
 */
import type {
  DragonPotsBonusBuy,
  DragonPotsBonusTypeName,
  DragonPotsBoardSize,
  DragonPotsCoin,
  DragonPotsPotColor,
  DragonPotsSpinResult,
} from '@omega/webbridge-protocol';
import { dealMatrix, drawSpots, evaluateWays, highlightOf, withCoins, withoutWays } from './dragonPotsMockBoard';
import { decimal, drawInt, shuffled, topWinAmount, type RandomSource } from './dragonPotsMockDraw';
import { playHoldAndWin, playJackpot } from './dragonPotsMockFeatures';

/** What the pots may trigger: every name of the server but the empty one. */
export type DragonPotsMockOutcome = Exclude<DragonPotsBonusTypeName, ''>;

interface Feature {
  readonly index: number;
  readonly pots: readonly DragonPotsPotColor[];
  readonly boardSize: DragonPotsBoardSize | null;
  readonly hasJackpot: boolean;
}

// Local copies of the protocol's tables (see `dragonPotsMockFeatures`).
const FEATURES: Readonly<Record<DragonPotsMockOutcome, Feature>> = {
  Mighty: { index: 0, pots: ['Blue'], boardSize: '3x5', hasJackpot: false },
  Mega: { index: 1, pots: ['Green'], boardSize: '4x5', hasJackpot: false },
  Super: { index: 2, pots: ['Blue', 'Green'], boardSize: '5x5', hasJackpot: false },
  Jackpot: { index: 3, pots: ['Red'], boardSize: null, hasJackpot: true },
  Ultra: { index: 4, pots: ['Red', 'Blue'], boardSize: '3x5', hasJackpot: true },
  Supreme: { index: 5, pots: ['Red', 'Green'], boardSize: '4x5', hasJackpot: true },
  Ultimate: { index: 6, pots: ['Red', 'Blue', 'Green'], boardSize: '5x5', hasJackpot: true },
  Lose: { index: 7, pots: [], boardSize: null, hasJackpot: false },
};
const BUYS: Readonly<Record<DragonPotsBonusBuy, { priceInBets: number; outcome: DragonPotsMockOutcome }>> = {
  Mighty: { priceInBets: 30, outcome: 'Mighty' },
  Mega: { priceInBets: 55, outcome: 'Mega' },
  Super: { priceInBets: 80, outcome: 'Super' },
};
const COLORS: readonly DragonPotsPotColor[] = ['Red', 'Green', 'Blue'];
/** Chance of a coin in each cell of a plain spin; about half the spins land none. */
const COIN_CHANCE = 0.045;
/** Chance that a pot with a coin in it triggers. */
const TRIGGER_CHANCE: Readonly<Record<DragonPotsPotColor, number>> = { Red: 0.07, Green: 0.1, Blue: 0.12 };
const GOLD_CHANCE = 0.2;
const CELLS = 15;

export interface DragonPotsMockPlay {
  /** The bet; a buy charges `bet × price`. */
  readonly bet: number;
  readonly currency: string;
  readonly random: RandomSource;
  /** The pots trigger this, whatever the draw: the dev keys force a feature with it. */
  readonly outcome?: DragonPotsMockOutcome;
  readonly bonusBuy?: DragonPotsBonusBuy;
}

const outcomeOf = (triggered: readonly DragonPotsPotColor[]): DragonPotsMockOutcome => {
  const key = (pots: readonly DragonPotsPotColor[]): string => [...pots].sort().join('+');
  const found = (Object.keys(FEATURES) as DragonPotsMockOutcome[]).find((name) => key(FEATURES[name].pots) === key(triggered));
  return found ?? 'Lose';
};

/** The colours that land: a random spin's own draw, or the forced outcome's pots and maybe one more. */
const landedColors = (random: RandomSource, outcome: DragonPotsMockOutcome | undefined): DragonPotsPotColor[] => {
  if (outcome === undefined) {
    const count = Array.from({ length: CELLS }, () => random() < COIN_CHANCE).filter(Boolean).length;
    return Array.from({ length: count }, () => COLORS[Math.floor(random() * COLORS.length)]!);
  }
  const { pots } = FEATURES[outcome];
  const idle = COLORS.filter((color) => !pots.includes(color));
  const extra = idle.length > 0 && random() < 0.5 ? [idle[Math.floor(random() * idle.length)]!] : [];
  return shuffled([...(pots.length === 0 ? [COLORS[drawInt(0, 2, random)]!] : pots), ...extra], random);
};

const drawOutcome = (colors: readonly DragonPotsPotColor[], random: RandomSource): DragonPotsMockOutcome | null => {
  if (colors.length === 0) return null;
  return outcomeOf([...new Set(colors)].filter((color) => random() < TRIGGER_CHANCE[color]));
};

export const dealDragonPotsRound = (play: DragonPotsMockPlay): DragonPotsSpinResult => {
  const { bet, currency, random, bonusBuy } = play;
  const buy = bonusBuy === undefined ? null : BUYS[bonusBuy];
  const amount = buy === null ? bet : bet * buy.priceInBets;
  // A bought round's board shows exactly the pots of the bought feature landing, as recorded.
  const colors = buy === null ? landedColors(random, play.outcome) : [...FEATURES[buy.outcome].pots];
  // A forced outcome is what triggers; a bought one triggers nothing the server names.
  const outcome = buy !== null ? null : (play.outcome ?? drawOutcome(colors, random));
  const feature = FEATURES[buy?.outcome ?? outcome ?? 'Lose'];

  const dealt = buy === null ? dealMatrix(random) : withoutWays(dealMatrix(random));
  const spots = drawSpots(colors.length, random);
  const matrix = withCoins(dealt, spots);
  const coins: DragonPotsCoin[] = spots.map((spot, index) => ({ reelIndex: spot.reel, rowIndex: spot.row, color: colors[index]!, isGold: random() < GOLD_CHANCE }));
  const wins = evaluateWays(matrix);
  const mainCoeff = Number(wins.reduce((sum, win) => sum + win.payout, 0).toFixed(10));

  const jackpotResult = feature.hasJackpot && buy === null ? playJackpot(bet, random) : undefined;
  const holdAndWinResult =
    feature.boardSize === null ? undefined : playHoldAndWin(feature.boardSize, { baseBet: bet, priceInBets: buy?.priceInBets ?? 1, random });
  const totalCoeff = mainCoeff + (jackpotResult?.coeff ?? 0) + (holdAndWinResult?.coeff ?? 0);
  const totalWin = decimal(mainCoeff * bet + Number(jackpotResult?.winAmount ?? 0) + Number(holdAndWinResult?.winAmount ?? 0));
  const isWin = totalCoeff > 0;

  return {
    status: isWin ? 'win' : 'lose',
    bet: { amount: amount.toFixed(2), currency, decimalPlaces: 2 },
    betAmount: amount.toFixed(2),
    coeff: totalCoeff,
    currency,
    isFinished: true,
    isWin,
    winAmount: topWinAmount(totalCoeff, amount),
    roundResult: {
      totalCoeff,
      winAmount: totalWin,
      totalWinAmount: totalWin,
      mainGameResult: { matrix, wins, winsHighlight: wins.map(highlightOf), coeff: mainCoeff, winAmount: decimal(mainCoeff * bet) },
      isJackpot: jackpotResult !== undefined,
      ...(jackpotResult === undefined ? {} : { jackpotResult }),
      ...(holdAndWinResult === undefined ? {} : { holdAndWinResult }),
      bonusTypeIndex: outcome === null ? null : FEATURES[outcome].index,
      bonusTypeName: outcome ?? '',
      coins,
    },
  };
};
