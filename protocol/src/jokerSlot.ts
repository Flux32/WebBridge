/**
 * Joker Slot (backend `joker-pyre`): a 3 × 4 coin slot of the chicken-coin family. Coins and jackpot
 * medallions land on the outer reels, a Joker Coin (`l`) or a Super Joker Coin (`m`) on the middle one; a
 * joker collects every coin on the board. Joker coins also start the bonus — a hold-and-win run where the
 * jokers stick and collect each spin's coins until three spins in a row bring nothing new.
 *
 * The round is atomic (`ModeProtocols['jokerSlot']`):
 * 1. The host forwards the server's play reply as is: `ApplySpinResult` (JSON string). It carries the whole
 *    round — the base board and, after a bonus trigger or a bought bonus, every bonus board (`rounds`).
 * 2. The engine plays `boards[i]` with `actions[i]` in order and then sends ONE `SpinReady`; until then the
 *    host keeps the bet bar locked and the win parked.
 * 3. `get-game-state` is always `{ status: 'none' }`: nothing is left to resume.
 *
 * A bonus is bought with the play itself: `value.bonusBuy` names the buy, and the play's `amount` is the full
 * price, bet × `JOKER_SLOT_BONUS_BUYS[buy]` (the server does not check it). Money fields are decimal strings
 * of the platform; the top-level `coeff` is a number. Inside a bought bonus every coin's `payout` is against
 * the base bet, `betAmount / price` — only the top-level `winAmount` is the round's win.
 */

/** The cabinet: three reels, four symbols tall. A board string is column-major, `reel * rows + row`. */
export const JOKER_SLOT_REELS = { count: 3, rows: 4 } as const;

/**
 * Board codes, named as the original client names them (`joker-pyre.inout.games`). A code is a key, not a
 * number: they run `0`…`9`, then `a`…`m`.
 */
export const JOKER_SLOT_SYMBOLS = {
  /** Only on bonus boards: no coin landed in the cell. */
  empty: '0',
  bar: '1',
  bell: '2',
  cherry: '3',
  grape: '4',
  lemon: '5',
  orange: '6',
  seven: '7',
  plum: '8',
  watermelon: '9',
  coinX1: 'a',
  coinX2: 'b',
  coinX3: 'c',
  coinX5: 'd',
  coinX7: 'e',
  coinX10: 'f',
  coinX15: 'g',
  mini: 'h',
  minor: 'i',
  major: 'j',
  grand: 'k',
  /** The Joker Coin: collects every coin on the board. Lands on the middle reel only. */
  joker: 'l',
  /** The Super Joker Coin: a joker that also adds coins (or a multiplier) before it collects. */
  superJoker: 'm',
} as const;

export type JokerSlotSymbol = (typeof JOKER_SLOT_SYMBOLS)[keyof typeof JOKER_SLOT_SYMBOLS];

/** What a coin or a medallion pays, in bets, by its code. */
export const JOKER_SLOT_COIN_COEFFS = {
  a: 1,
  b: 2,
  c: 3,
  d: 5,
  e: 7,
  f: 10,
  g: 15,
  h: 25,
  i: 50,
  j: 150,
  k: 1000,
} as const;

/** The eight paylines by `winLineNumber`: the board cells of each, left reel to right. */
export const JOKER_SLOT_WIN_LINES = [
  [0, 4, 8],
  [1, 5, 9],
  [2, 6, 10],
  [3, 7, 11],
  [0, 5, 10],
  [1, 6, 11],
  [2, 5, 8],
  [3, 6, 9],
] as const;

/**
 * Bonus buys: `value.bonusBuy` of the play and the price in bets. `get-game-config` also lists `x300` in
 * `bonusBuyMultiplier`, but the server refuses it — the game sells these two. `x75` starts with one or more
 * Joker Coins, `x200` with one Super Joker Coin.
 */
export const JOKER_SLOT_BONUS_BUYS = { x75: 75, x200: 200 } as const;

export type JokerSlotBonusBuy = keyof typeof JOKER_SLOT_BONUS_BUYS;

/** `action` of the steps the server describes a board with. The list is open: skip what you do not know. */
export const JOKER_SLOT_ACTIONS = {
  winLines: 'WIN_LINES',
  coinsCollection: 'STRIKE_COINS_COLLECTION',
  superJokerCoinsAdded: 'SUPER_STRIKE_COINS_ADDED',
  superJokerMultiplierAdded: 'SUPER_STRIKE_MULTIPLIER_ADDED',
  superJokerMultiplierCollected: 'SUPER_STRIKE_MULTIPLIER_COLLECTED',
  superJokerJackpotAdded: 'SUPER_STRIKE_JACKPOT_ADDED',
  enhancedSuperJoker: 'ENHANCED_SUPER_STRIKE',
  bonusTriggered: 'PILE_OF_GOLD',
  bonusBought: 'BONUS_BUY',
  bonusRun: 'BONUS_RUN',
  bonusSpinsCount: 'BONUS_SPINS_COUNT',
} as const;

export type JokerSlotActionName = (typeof JOKER_SLOT_ACTIONS)[keyof typeof JOKER_SLOT_ACTIONS];

/** A symbol on a board cell. */
export interface JokerSlotCell {
  /** Board cell, `reel * rows + row`. */
  index: number;
  symbol: string;
}

/** A coin a joker collected: what it paid, `coeff` in bets and `payout` in money. */
export interface JokerSlotPaidCell extends JokerSlotCell {
  coeff: string;
  payout: string;
}

export interface JokerSlotWinLine {
  /** Index into `JOKER_SLOT_WIN_LINES`. */
  winLineNumber: number;
  coeff: string;
  payout: string;
}

/** Three equal symbols on paylines of the board. */
export interface JokerSlotWinLinesAction {
  action: typeof JOKER_SLOT_ACTIONS.winLines;
  winLines: JokerSlotWinLine[];
  totalCoeff: string;
  totalPayout: string;
}

/** The joker in `triggerIndex` collects `coins`; with several jokers on the board each one collects them. */
export interface JokerSlotCoinsCollectionAction {
  action: typeof JOKER_SLOT_ACTIONS.coinsCollection;
  triggerIndex: number;
  coins: JokerSlotPaidCell[];
  totalCoeff: string;
  totalPayout: string;
}

/** The Super Joker in `triggerIndex` puts `coins` onto their cells; the board string does not show them. */
export interface JokerSlotSuperJokerCoinsAddedAction {
  action: typeof JOKER_SLOT_ACTIONS.superJokerCoinsAdded;
  triggerIndex: number;
  coins: JokerSlotCell[];
}

/** The Super Joker in `triggerIndex` multiplies what it collects. */
export interface JokerSlotSuperJokerMultiplierAddedAction {
  action: typeof JOKER_SLOT_ACTIONS.superJokerMultiplierAdded;
  triggerIndex: number;
  multiplier: number;
}

/** A Super Joker collects the jokers in `strikes`: what they collected pays once more. */
export interface JokerSlotEnhancedSuperJokerAction {
  action: typeof JOKER_SLOT_ACTIONS.enhancedSuperJoker;
  triggerIndex: number;
  strikes: JokerSlotPaidCell[];
  totalCoeff: string;
  totalPayout: string;
}

/**
 * The bonus starts on this board: from landed jokers (`PILE_OF_GOLD`) or a bought bonus (`BONUS_BUY`). The
 * listed coins and jokers carry over onto the bonus board.
 */
export interface JokerSlotBonusStartAction {
  action: typeof JOKER_SLOT_ACTIONS.bonusTriggered | typeof JOKER_SLOT_ACTIONS.bonusBought;
  coins: JokerSlotCell[];
  strikes: JokerSlotCell[];
}

/**
 * The first board of the bonus, after the base board: one single-code array per cell (12), `"0"` — empty.
 * The steps after it on the same board play on this board.
 */
export interface JokerSlotBonusRunAction {
  action: typeof JOKER_SLOT_ACTIONS.bonusRun;
  board: string[][];
  multiplier?: number;
}

/** Bonus spins left after this board: 3 again when something new landed, 0 ends the bonus. */
export interface JokerSlotBonusSpinsCountAction {
  action: typeof JOKER_SLOT_ACTIONS.bonusSpinsCount;
  count: number;
}

/** Any other step: the list is open. */
export interface JokerSlotOtherAction {
  action: string;
  [field: string]: unknown;
}

export type JokerSlotAction =
  | JokerSlotWinLinesAction
  | JokerSlotCoinsCollectionAction
  | JokerSlotSuperJokerCoinsAddedAction
  | JokerSlotSuperJokerMultiplierAddedAction
  | JokerSlotEnhancedSuperJokerAction
  | JokerSlotBonusStartAction
  | JokerSlotBonusRunAction
  | JokerSlotBonusSpinsCountAction
  | JokerSlotOtherAction;

/** The play reply of the Joker Slot backend: GameState with the boards on the top level. */
export interface JokerSlotSpinResult {
  status: 'win' | 'lose';
  bet: { amount: string; currency: string; decimalPlaces: number };
  /** What the play charged — the full price for a bought bonus. */
  betAmount: string;
  /** The round's coefficient against `betAmount`. */
  coeff: number | string;
  currency: string;
  /** Always true: the round is atomic. */
  isFinished: boolean;
  isWin: boolean;
  /** The round's win — the one to show and the one the balance gets. */
  winAmount: string;
  /** `boards.length`. */
  rounds: number;
  /** The base board, then the bonus boards in order. */
  boards: string[];
  /** The steps of `boards[i]`, in order of play. */
  actions: JokerSlotAction[][];
}

/** `get-game-state`: always `{ status: 'none' }` — a round never outlives its reply. */
export interface JokerSlotGameState {
  status: 'none';
}
