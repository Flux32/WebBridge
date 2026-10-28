/**
 * Mine Slot: a 5 × 3 slot whose pickaxe symbols fall down their reel's column into a field of blocks under
 * the reels and break them; a column broken through reaches a chest whose multipliers multiply.
 *
 * The host forwards the server's play reply as is (`ApplySpinResult`, JSON string). It carries the whole
 * round: the base spin and, after three scatters or a bought bonus, every free spin (`rounds` boards). The
 * engine plays them in order — the field is not regenerated between free spins — and answers once with
 * `SpinReady`. Money fields are decimal strings of the platform; `coeff` is a number.
 */

/** The reels: board strings are column-major, `reel * rows + row`, top row first. */
export const MINE_SLOT_REELS = { count: 5, rows: 3 } as const;

/** The field under the reels: column-major, `column * depth + level`, the top block first. */
export const MINE_SLOT_FIELD = { columns: 5, depth: 6 } as const;

/** Reel symbol codes. A pickaxe's strength is the damage it deals in its column. */
export const MINE_SLOT_SYMBOLS = {
  empty: 'x',
  woodenPickaxe: '1',
  stonePickaxe: '2',
  goldenPickaxe: '3',
  enchantedPickaxe: '5',
  /** Falls after every pickaxe and deals 2 damage around itself. */
  dynamite: 'd',
  /** Makes every pickaxe of its reel strength 5. */
  enchantmentBook: 'e',
  /** Three or more start the bonus game: four free spins. */
  scatter: 'b',
} as const;

export type MineSlotSymbol = (typeof MINE_SLOT_SYMBOLS)[keyof typeof MINE_SLOT_SYMBOLS];

/** Field block codes: durability is the damage that breaks the block, coeff what breaking it pays. */
export const MINE_SLOT_BLOCKS = {
  dirt: { code: 'd', durability: 1, coeff: 0 },
  stone: { code: 's', durability: 2, coeff: 0.1 },
  redstone: { code: 'r', durability: 4, coeff: 1 },
  gold: { code: 'g', durability: 5, coeff: 3 },
  crystal: { code: 'c', durability: 6, coeff: 5 },
  obsidian: { code: 'o', durability: 7, coeff: 25 },
} as const;

export type MineSlotBlock = (typeof MINE_SLOT_BLOCKS)[keyof typeof MINE_SLOT_BLOCKS]['code'];

/** The multipliers a chest can hold. */
export const MINE_SLOT_CHEST_COEFFS = [2, 3, 4, 5, 10, 25, 50, 100] as const;

/** `value.bonusType` of the host's play request: a bought bonus game, or a boosted chance of one. */
export type MineSlotBonusType = 'bonus-buy' | 'bonus-boost';

/** Damage to one block. `coeff` and `payout` come only with the hit that breaks the block. */
export interface MineSlotBrokenBlock {
  /** Field cell, `column * depth + level`. */
  index: number;
  damage: number;
  coeff?: number;
  payout?: string;
}

/**
 * A pickaxe's or a dynamite's fall. Order of the list is the order of play: per column the pickaxes from
 * wooden to enchanted, then the dynamite from the left column to the right.
 */
export interface MineSlotHit {
  /** Which round (index into `boards`) the symbol landed in. */
  round: number;
  /** Board cell of the symbol, `reel * rows + row`. */
  index: number;
  brokenBlocks: MineSlotBrokenBlock[];
}

/** A chest reached by breaking through a column. */
export interface MineSlotChest {
  col: number;
  coeff: number;
  payout: string;
}

/** The play reply of the Mine Slot backend: GameState with the mode's fields on the top level. */
export interface MineSlotSpinResult {
  status: 'win' | 'lose' | 'in-game' | 'none';
  bet?: { amount: string; currency: string; decimalPlaces: number };
  betAmount: string;
  currency: string;
  coeff: number;
  isFinished: boolean;
  isWin: boolean;
  winAmount: string;
  /** 1 for a plain spin; the base spin plus the free spins when a bonus game played. */
  rounds: number;
  /** One 15-symbol string per round. */
  boards: string[];
  /** The 30 blocks as they stood when the round began. */
  field: string;
  pickaxes: MineSlotHit[];
  tnt: MineSlotHit[];
  chests: MineSlotChest[];
}
