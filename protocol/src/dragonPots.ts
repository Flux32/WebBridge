/**
 * Dragon Pots: a 5 × 3 slot, 243 ways, paying left to right. Coins that land fly into three pots over the
 * reels — Red, Green and Blue; a pot that triggers starts its feature: Blue and Green a Hold & Win on a
 * bigger board, Red a jackpot pick. The server decides everything; the client only animates.
 *
 * The round is atomic, as mine-slot's (`ModeProtocols['dragonPots']`):
 * 1. The host forwards the server's play reply as is: `ApplySpinResult` (JSON string). It carries the whole
 *    round — there are no steps.
 * 2. The engine plays, in this order: the base spin and its ways wins → the coins into their pots → the
 *    jackpot pick, when `roundResult.isJackpot` (reveal `jackpotResult.scenario` tile by tile) → the
 *    Hold & Win, when `roundResult.holdAndWinResult` is present (the initial coins, then spin by spin each
 *    try and its opened coins with their running totals) → the round's total win. Then it sends ONE
 *    `SpinReady`; until then the host keeps the bet bar locked and the win parked.
 * 3. `get-game-state` is always `{}`: nothing is left to resume, so `ApplyGameState` carries `{}`.
 *
 * Read the features by presence, not by `bonusTypeName`: a bought bonus is a reply with `holdAndWinResult`
 * and an empty `bonusTypeName`. Money fields are decimal strings; the top-level `winAmount` is the round's
 * authoritative win, rounded down to `bet.decimalPlaces` — every inner `winAmount` is unrounded.
 */

/** The base game's reels; `matrix[row][reel]`, row 0 on top. */
export const DRAGON_POTS_REELS = { count: 5, rows: 3 } as const;

/** Cell codes of `mainGameResult.matrix` and of a win's path cells. */
export const DRAGON_POTS_SYMBOLS = {
  nine: '9',
  ten: '10',
  j: 'J',
  q: 'Q',
  k: 'K',
  a: 'A',
  dragon: 'Dr',
  flower: 'Fl',
  lantern: 'Ln',
  coins: '3C',
  fish: 'Fi',
  /** Stands in for every paying symbol. */
  wild: 'Wi',
  /** A pot coin landed here; its colour is in `roundResult.coins`. It never pays in a way. */
  coin: 'M',
} as const;

export type DragonPotsSymbol = (typeof DRAGON_POTS_SYMBOLS)[keyof typeof DRAGON_POTS_SYMBOLS];

/** The three pots, as `coins[].color` names them, left to right over the reels. */
export const DRAGON_POTS_POT_COLORS = ['Red', 'Green', 'Blue'] as const;

export type DragonPotsPotColor = (typeof DRAGON_POTS_POT_COLORS)[number];

/** Hold & Win boards, `rows x reels`. Cells are `{rowIndex, colIndex}`, row 0 on top. */
export const DRAGON_POTS_BOARD_SIZES = {
  '3x5': { rows: 3, columns: 5 },
  '4x5': { rows: 4, columns: 5 },
  '5x5': { rows: 5, columns: 5 },
} as const;

export type DragonPotsBoardSize = keyof typeof DRAGON_POTS_BOARD_SIZES;

/**
 * What the pots triggered: `roundResult.bonusTypeName` and its `bonusTypeIndex`, with the pots that burst
 * and the features they start. `Lose` — coins landed, no pot triggered. Ultra (index 4) has not been seen
 * on the stage backend yet; its index follows the original game's order.
 */
export const DRAGON_POTS_BONUS_TYPES = {
  Mighty: { index: 0, pots: ['Blue'], boardSize: '3x5', hasJackpot: false },
  Mega: { index: 1, pots: ['Green'], boardSize: '4x5', hasJackpot: false },
  Super: { index: 2, pots: ['Blue', 'Green'], boardSize: '5x5', hasJackpot: false },
  Jackpot: { index: 3, pots: ['Red'], boardSize: null, hasJackpot: true },
  Ultra: { index: 4, pots: ['Red', 'Blue'], boardSize: '3x5', hasJackpot: true },
  Supreme: { index: 5, pots: ['Red', 'Green'], boardSize: '4x5', hasJackpot: true },
  Ultimate: { index: 6, pots: ['Red', 'Blue', 'Green'], boardSize: '5x5', hasJackpot: true },
  Lose: { index: 7, pots: [], boardSize: null, hasJackpot: false },
} as const satisfies Record<
  string,
  {
    index: number;
    pots: readonly DragonPotsPotColor[];
    boardSize: DragonPotsBoardSize | null;
    hasJackpot: boolean;
  }
>;

/** `bonusTypeName` of a reply; `''` when no coin landed, and on every bought bonus. */
export type DragonPotsBonusTypeName = keyof typeof DRAGON_POTS_BONUS_TYPES | '';

/**
 * Bonus buys of the host's shop: `value.buyBonusType` of the play request (case-sensitive). The play's
 * `amount` is the full price, bet × `priceInBets`, and the server does not check it — the host computes it.
 * `get-game-config` carries no prices; they are the original game's constants. `pots` are the colours the
 * bought round's base board shows landing.
 */
export const DRAGON_POTS_BONUS_BUYS = {
  Mighty: { priceInBets: 30, boardSize: '3x5', startCoins: 6, pots: ['Blue'] },
  Mega: { priceInBets: 55, boardSize: '4x5', startCoins: 8, pots: ['Green'] },
  Super: { priceInBets: 80, boardSize: '5x5', startCoins: 10, pots: ['Blue', 'Green'] },
} as const satisfies Record<
  string,
  { priceInBets: number; boardSize: DragonPotsBoardSize; startCoins: number; pots: readonly DragonPotsPotColor[] }
>;

export type DragonPotsBonusBuy = keyof typeof DRAGON_POTS_BONUS_BUYS;

/**
 * Tiles of the jackpot pick (`jackpotResult.scenario`), with what the tier pays in bets. The pick ends when
 * one tier has shown `DRAGON_POTS_JACKPOT_MATCH` times — that tier is won. UPGRADE pays nothing itself; in
 * the original game three of them double the won jackpot (`isDouble`). Show `jackpotResult.coeff` /
 * `winAmount` / `isDouble` as the truth and `scenario` as the order of the tiles.
 */
export const DRAGON_POTS_JACKPOT_TIERS = {
  1: { name: 'MINI', coeff: 20 },
  2: { name: 'MINOR', coeff: 50 },
  3: { name: 'MAJOR', coeff: 250 },
  4: { name: 'GRAND', coeff: 2000 },
  5: { name: 'UPGRADE', coeff: null },
} as const;

export type DragonPotsJackpotTile = keyof typeof DRAGON_POTS_JACKPOT_TIERS;

/** Tiles of one tier that end the pick and win it. */
export const DRAGON_POTS_JACKPOT_MATCH = 3;

/** A cell of the base reels. */
export interface DragonPotsCell {
  reelIndex: number;
  /** 0 = top. */
  rowIndex: number;
  symbol: DragonPotsSymbol;
}

/** One paying symbol: `ways` combinations of `matches` reels, each paying `coeff`. */
export interface DragonPotsWin {
  symbol: DragonPotsSymbol;
  /** Reels from the left the combination covers, 3..5. */
  matches: number;
  ways: number;
  /** What one way pays, in bets. */
  coeff: number;
  /** `coeff × ways`, in bets. */
  payout: number;
  /** Every way: one cell per reel, reel 0 first. */
  paths: DragonPotsCell[][];
}

/** The same win with the union of its cells — what to light up. */
export interface DragonPotsWinHighlight extends Omit<DragonPotsWin, 'paths'> {
  path: DragonPotsCell[];
}

export interface DragonPotsMainGameResult {
  /** `matrix[row][reel]`, 3 rows of 5. */
  matrix: DragonPotsSymbol[][];
  wins: DragonPotsWin[];
  winsHighlight: DragonPotsWinHighlight[];
  /** The base spin's pay in bets (0 in a bought bonus). */
  coeff: number;
  winAmount: string;
}

/** A pot coin on the base reels (its cell holds `M`). */
export interface DragonPotsCoin {
  reelIndex: number;
  rowIndex: number;
  color: DragonPotsPotColor;
  /** A bigger, golden coin: a visual, no other field changes. */
  isGold: boolean;
}

export interface DragonPotsJackpotResult {
  /** The tiles in the order they are revealed; the last one completes the won tier. */
  scenario: DragonPotsJackpotTile[];
  /** The prize in bets. */
  coeff: number;
  winAmount: string;
  isDouble: boolean;
}

/** A coin on the Hold & Win board. */
export interface DragonPotsHoldAndWinCoin {
  /** 0 = top. */
  rowIndex: number;
  /** The board's column (not `reelIndex`). */
  colIndex: number;
  /** The coin's value in base bets: the bet, or `betAmount / priceInBets` for a bought bonus. */
  coinCoeff: number;
  coinWinAmount: string;
  /**
   * The Hold & Win total after this coin, in base bets: a landing coin collects the value of every coin
   * already on the board. 0 on the initial coins — they pay only through the coins that land after them.
   */
  currentCoeff: number;
  currentWinAmount: string;
}

/** One respin attempt; only the try that lands coins has any, and it is the last of its spin. */
export interface DragonPotsHoldAndWinTry {
  tryIndex: number;
  openedCoins: DragonPotsHoldAndWinCoin[];
}

/** Up to three tries until coins land; a landing resets the tries, three empty ones end the Hold & Win. */
export interface DragonPotsHoldAndWinSpin {
  spinIndex: number;
  /** The total after this spin, in base bets. */
  currentCoeff: number;
  tries: DragonPotsHoldAndWinTry[];
}

export interface DragonPotsHoldAndWinResult {
  boardSize: DragonPotsBoardSize;
  /** The Hold & Win's pay against `betAmount` (for a buy: the last `currentCoeff` / `priceInBets`). */
  coeff: number;
  winAmount: string;
  finalCoinsCount: number;
  initial: { currentCoeff: number; coins: DragonPotsHoldAndWinCoin[] };
  spins: DragonPotsHoldAndWinSpin[];
}

export interface DragonPotsRoundResult {
  /** `mainGameResult.coeff + jackpotResult.coeff + holdAndWinResult.coeff`, against `betAmount`. */
  totalCoeff: number;
  /** Unrounded; may be a cent above the top-level `winAmount` — do not show it. */
  winAmount: string;
  totalWinAmount: string;
  mainGameResult: DragonPotsMainGameResult;
  isJackpot: boolean;
  /** Only with `isJackpot: true`. */
  jackpotResult?: DragonPotsJackpotResult;
  /** Only with a Hold & Win — triggered by the pots or bought. */
  holdAndWinResult?: DragonPotsHoldAndWinResult;
  bonusTypeIndex: number | null;
  bonusTypeName: DragonPotsBonusTypeName;
  coins: DragonPotsCoin[];
}

/** The play reply of the Dragon Pots backend: GameState with the round in `roundResult`. */
export interface DragonPotsSpinResult {
  status: 'win' | 'lose';
  bet: { amount: string; currency: string; decimalPlaces: number };
  /** What the play charged — the full price for a bought bonus. */
  betAmount: string;
  /** The round's coefficient against `betAmount`: a number on stage, a decimal string on prod. */
  coeff: number | string;
  currency: string;
  /** Always true: the round is atomic. */
  isFinished: boolean;
  isWin: boolean;
  /** The round's win, rounded down — the one to show and the one the balance gets. */
  winAmount: string;
  roundResult: DragonPotsRoundResult;
}

/** `get-game-state`: always empty — a round never outlives its reply. */
export type DragonPotsGameState = Record<string, never>;
