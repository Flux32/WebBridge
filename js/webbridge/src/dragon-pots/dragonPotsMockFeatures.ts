/**
 * The two features of the dragon-pots mock, played as the stage backend reports them.
 *
 * Jackpot pick: tiles revealed one by one until a tier has shown three times; that tier is won. The other
 * tiers and UPGRADE show at most twice, so the prize is never doubled — as in every recorded reply.
 *
 * Hold & Win: the initial coins sit on the board and pay nothing on their own; each spin has up to three
 * tries, and a try that lands coins ends the spin (the tries reset). Every landing coin collects the value
 * of all the coins already on the board — the running total is `currentCoeff`. Three empty tries, or a full
 * board, end it. Values are in base bets; the tiers' weights and the coin values are illustrative.
 */
import type {
  DragonPotsBoardSize,
  DragonPotsHoldAndWinCoin,
  DragonPotsHoldAndWinResult,
  DragonPotsHoldAndWinSpin,
  DragonPotsHoldAndWinTry,
  DragonPotsJackpotResult,
  DragonPotsJackpotTile,
} from '@omega/webbridge-protocol';
import { decimal, drawInt, drawWeighted, shuffled, type RandomSource } from './dragonPotsMockDraw';

// Local copies of the protocol's tables: the bridge imports only protocol types, so it runs on the
// released protocol until it moves to the one that has these constants.
const JACKPOT_COEFFS: Readonly<Record<Exclude<DragonPotsJackpotTile, 5>, number>> = { 1: 20, 2: 50, 3: 250, 4: 2000 };
const UPGRADE = 5;
const JACKPOT_MATCH = 3;
const BOARD_ROWS: Readonly<Record<DragonPotsBoardSize, number>> = { '3x5': 3, '4x5': 4, '5x5': 5 };
const BOARD_COLUMNS = 5;
/** Coins on the board when a Hold & Win starts, by its board: 6 / 8 / 10 as in every recorded one. */
export const START_COINS: Readonly<Record<DragonPotsBoardSize, number>> = { '3x5': 6, '4x5': 8, '5x5': 10 };
const TRIES_PER_SPIN = 3;

const TIER_WEIGHTS: readonly (readonly [Exclude<DragonPotsJackpotTile, 5>, number])[] = [
  [1, 70],
  [2, 20],
  [3, 8],
  [4, 2],
];
const COIN_VALUES: readonly (readonly [number, number])[] = [
  [0.25, 40],
  [0.5, 18],
  [0.75, 12],
  [1, 10],
  [1.25, 6],
  [1.5, 4],
  [2, 5],
  [4, 2],
  [5, 2],
  [10, 1],
];
/** Chance that a try lands coins, and how many it lands. */
const LANDING_CHANCE = 0.33;
const LANDING_COUNTS: readonly (readonly [number, number])[] = [
  [1, 60],
  [2, 25],
  [3, 10],
  [4, 5],
];

export const playJackpot = (baseBet: number, random: RandomSource): DragonPotsJackpotResult => {
  const won = drawWeighted(TIER_WEIGHTS, random);
  const others: DragonPotsJackpotTile[] = [1, 2, 3, 4, UPGRADE];
  const misses = others.filter((tile) => tile !== won).flatMap((tile) => Array.from({ length: drawInt(0, JACKPOT_MATCH - 1, random) }, () => tile));
  const body = shuffled([...misses, ...Array.from({ length: JACKPOT_MATCH - 1 }, () => won)], random);
  const coeff = JACKPOT_COEFFS[won];
  return { scenario: [...body, won], coeff, winAmount: decimal(coeff * baseBet), isDouble: false };
};

interface Board {
  readonly free: { rowIndex: number; colIndex: number }[];
  sum: number;
  total: number;
}

const coinAt = (cell: { rowIndex: number; colIndex: number }, coinCoeff: number, board: Board, baseBet: number): DragonPotsHoldAndWinCoin => ({
  ...cell,
  coinCoeff,
  coinWinAmount: decimal(coinCoeff * baseBet),
  currentCoeff: board.total,
  currentWinAmount: decimal(board.total * baseBet),
});

const takeCell = (board: Board, random: RandomSource): { rowIndex: number; colIndex: number } =>
  board.free.splice(Math.floor(random() * board.free.length), 1)[0]!;

/** One spin: empty tries until one lands coins, each collecting the board before it lands. */
const playSpin = (spinIndex: number, board: Board, baseBet: number, random: RandomSource): DragonPotsHoldAndWinSpin => {
  const tries: DragonPotsHoldAndWinTry[] = [];
  for (let tryIndex = 0; tryIndex < TRIES_PER_SPIN; tryIndex += 1) {
    if (random() >= LANDING_CHANCE) {
      tries.push({ tryIndex, openedCoins: [] });
      continue;
    }
    const count = Math.min(board.free.length, drawWeighted(LANDING_COUNTS, random));
    const openedCoins = Array.from({ length: count }, () => {
      const value = drawWeighted(COIN_VALUES, random);
      board.total += board.sum;
      board.sum += value;
      return coinAt(takeCell(board, random), value, board, baseBet);
    });
    tries.push({ tryIndex, openedCoins });
    break;
  }
  return { spinIndex, currentCoeff: board.total, tries };
};

/**
 * `baseBet` — the bet the coin values are in: the play's amount, or amount / price of a bought bonus.
 * `priceInBets` turns the total into the reply's `coeff` against the play's amount (1 when not bought).
 */
export const playHoldAndWin = (
  boardSize: DragonPotsBoardSize,
  { baseBet, priceInBets, random }: { baseBet: number; priceInBets: number; random: RandomSource },
): DragonPotsHoldAndWinResult => {
  const cells = Array.from({ length: BOARD_ROWS[boardSize] * BOARD_COLUMNS }, (_, index) => ({ rowIndex: Math.floor(index / BOARD_COLUMNS), colIndex: index % BOARD_COLUMNS }));
  const board: Board = { free: shuffled(cells, random), sum: 0, total: 0 };
  const initial = Array.from({ length: START_COINS[boardSize] }, () => {
    const coin = coinAt(takeCell(board, random), drawWeighted(COIN_VALUES, random), board, baseBet);
    board.sum += coin.coinCoeff;
    return coin;
  });
  const spins: DragonPotsHoldAndWinSpin[] = [];
  for (;;) {
    const spin = playSpin(spins.length, board, baseBet, random);
    spins.push(spin);
    const hasLanded = spin.tries.some((attempt) => attempt.openedCoins.length > 0);
    if (!hasLanded || board.free.length === 0) break;
  }
  return {
    boardSize,
    coeff: board.total / priceInBets,
    winAmount: decimal(board.total * baseBet),
    finalCoinsCount: cells.length - board.free.length,
    initial: { currentCoeff: 0, coins: initial },
    spins,
  };
};
