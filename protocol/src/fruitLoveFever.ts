/**
 * Fruit Love Fever: a 5 × 3 line slot (20 fixed lines, pays left to right, line wins add up) with a bonus
 * game of free spins in which every Wild that lands sticks to its cell until the bonus ends.
 *
 * Round flow on the channel (`ModeProtocols['fruitLoveFever']`):
 * 1. The host forwards the server's play reply as is: `ApplySpinResult` (JSON string). The engine plays the
 *    base spin.
 * 2. `isFinished: true` — a plain spin: the engine answers `SpinReady` and the round is over.
 * 3. `isFinished: false` — three scatters or a bought bonus: the engine plays the bonus intro, then for each
 *    free spin sends `RequestStep` and waits for the host's `ApplyBonusStepResult` (the server's step reply,
 *    JSON string), plays it, and asks again until it has played a reply with `isFinished: true`. Only then
 *    does it send the round's one `SpinReady`.
 * 4. Reload / reconnect: `ApplyGameState` with `isFinished: false` is a bonus in progress — the engine shows
 *    that board and continues with `RequestStep`. An `ApplyGameState` that arrives while the engine waits for
 *    a step makes it send `RequestStep` again.
 *
 * Money fields are decimal strings of the platform. The server is loose about the rest: `coeff` comes as a
 * number on the top level and as a decimal string elsewhere, `line` as a number or a string; read both.
 */

/** The reels: `slot.reelsCells` is keyed by reel `"1"`..`"5"`, each with `rows` cells, top row first. */
export const FRUIT_LOVE_FEVER_REELS = { count: 5, rows: 3 } as const;

/**
 * Reel symbol codes (`outcomeNumber`) — the only authoritative id of a cell. The stage server's `outcome`
 * strings are leftovers of chicken-road ("hydrant", "police", "taxi"…): never key on them.
 */
export const FRUIT_LOVE_FEVER_SYMBOLS = {
  /** Replaces every symbol but the scatter; may carry a multiplier (`coeff`). Sticky in free spins. */
  wild: 0,
  pineapple: 1,
  banana: 2,
  coconut: 3,
  strawberry: 4,
  mojito: 5,
  bra: 6,
  a: 7,
  k: 8,
  q: 9,
  j: 10,
  ten: 11,
  /** Three or more start the bonus game. */
  scatter: 12,
} as const;

export type FruitLoveFeverSymbol = (typeof FRUIT_LOVE_FEVER_SYMBOLS)[keyof typeof FRUIT_LOVE_FEVER_SYMBOLS];

/** Display names by symbol code: `FRUIT_LOVE_FEVER_SYMBOL_NAMES[outcomeNumber]`. */
export const FRUIT_LOVE_FEVER_SYMBOL_NAMES = [
  'Wild',
  'Pineapple',
  'Banana',
  'Coconut',
  'Strawberry',
  'Mojito',
  'Bra',
  'A',
  'K',
  'Q',
  'J',
  'Ten',
  'Scatter',
] as const;

/**
 * Bonus buys, `value.bonusBuy` of the host's play request. The price is in bets, and the play's `amount` is
 * the full price: a buy at bet 1 sends `amount` 75 (or 200), and the server charges exactly `amount`.
 * `get-game-config` carries no prices — they come from the buy id itself.
 */
export const FRUIT_LOVE_FEVER_BONUS_BUYS = {
  x75: { title: 'Standard Buy', priceInBets: 75 },
  x200: { title: 'High-Value Buy', priceInBets: 200 },
} as const;

export type FruitLoveFeverBonusBuy = keyof typeof FRUIT_LOVE_FEVER_BONUS_BUYS;

/** A reel id of `reelsCells` / `reelsPosition`. */
export type FruitLoveFeverReel = '1' | '2' | '3' | '4' | '5';

export interface FruitLoveFeverCell {
  outcomeNumber: FruitLoveFeverSymbol;
  /** A leftover name of the stage server; see `FRUIT_LOVE_FEVER_SYMBOLS`. */
  outcome: string;
  /** Row, 0 = top. */
  index: number;
  /** A Wild's multiplier ("2"). */
  coeff?: number | string;
}

export interface FruitLoveFeverWinLine {
  /** Line number, 1..20. */
  line: number | string;
  /** What the line pays, in bets of the base game (amount / price inside a bought bonus). */
  coeff: number | string;
  /** The row of each cell of the combination, reel by reel from reel 1; the length is the combination's. */
  inclusionIndexes: number[];
}

export interface FruitLoveFeverSlot {
  reelsCells: Record<FruitLoveFeverReel, FruitLoveFeverCell[]>;
  reelsPosition: Record<FruitLoveFeverReel, number>;
  winLines: FruitLoveFeverWinLine[];
}

export interface FruitLoveFeverBonusGame {
  /** The free spin this reply played, 1..`totalFreeSpinsAmount`; `null` before the first one. */
  currentGameNumber: number | null;
  totalFreeSpinsAmount: number;
  /** This free spin's coefficient, not the bonus total. */
  coeff: number | string;
  /** This free spin's win, not the bonus total (that is the top-level `winAmount`). */
  winAmount: string;
}

/** The play reply of the Fruit Love Fever backend: GameState with the mode's fields on the top level. */
export interface FruitLoveFeverSpinResult {
  status: 'win' | 'lose';
  bet: { amount: string; currency: string; decimalPlaces: number };
  /** The amount the play charged — the full price for a bought bonus. */
  betAmount: string;
  currency: string;
  /**
   * The round's coefficient against `betAmount`. Inside a bonus the server leaves it at the base spin's
   * value until the last free spin: read the running total from `winAmount`.
   */
  coeff: number | string;
  /** `false` while a bonus game has free spins to play. */
  isFinished: boolean;
  isWin: boolean;
  /** The round's total win so far. */
  winAmount: string;
  slot: FruitLoveFeverSlot;
  bonusBuy?: FruitLoveFeverBonusBuy;
  /** Present from the reply that starts a bonus game to its last free spin. */
  bonusGame?: FruitLoveFeverBonusGame;
}

/** The step reply: one free spin, the same GameState with `bonusGame` always present. */
export interface FruitLoveFeverStepResult extends FruitLoveFeverSpinResult {
  bonusGame: FruitLoveFeverBonusGame;
}

/** `get-game-state`: the last reply of a round in progress, or no round at all. */
export type FruitLoveFeverGameState = FruitLoveFeverSpinResult | { status: 'none' };
