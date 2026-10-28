/**
 * The Mine Slot rules the mock host plays a round by — a simplified model of the backend, close enough for
 * a scene to be tried on real-looking replies: per column the pickaxes fall from wooden to enchanted, then
 * the dynamite from the left column to the right; a column broken through opens its chest.
 */
import type { MineSlotChest, MineSlotHit, MineSlotSpinResult } from '@omega/webbridge-protocol';

const REEL_ROWS = 3;
const FIELD_COLUMNS = 5;
const FIELD_DEPTH = 6;
const PICKAXE_STRENGTH: Readonly<Record<string, number>> = { '1': 1, '2': 2, '3': 3, '5': 5 };
const ENCHANTED_STRENGTH = 5;
const DYNAMITE = 'd';
const ENCHANTMENT_BOOK = 'e';
const DYNAMITE_DAMAGE = 2;
const BLOCKS: Readonly<Record<string, { durability: number; coeff: number }>> = {
  d: { durability: 1, coeff: 0 },
  s: { durability: 2, coeff: 0.1 },
  r: { durability: 4, coeff: 1 },
  g: { durability: 5, coeff: 3 },
  c: { durability: 6, coeff: 5 },
  o: { durability: 7, coeff: 25 },
};
const CHEST_COEFFS = [2, 3, 4, 5, 10, 25, 50, 100];

export interface MineSlotRoundsInput {
  readonly boards: readonly string[];
  readonly field: string;
  readonly betAmount: number;
  readonly random?: () => number;
}

export type MineSlotPlayedRounds = Pick<
  MineSlotSpinResult,
  'rounds' | 'boards' | 'field' | 'pickaxes' | 'tnt' | 'chests' | 'coeff'
>;

const money = (amount: number): string => (Math.round(amount * 100) / 100).toFixed(2);

class MineField {
  private readonly durability: number[];
  public paidCoeff = 0;

  public constructor(field: string, private readonly betAmount: number) {
    this.durability = [...field].map((code) => BLOCKS[code]?.durability ?? 0);
  }

  public isBrokenThrough(column: number): boolean {
    return this.levels(column).every((cell) => this.durability[cell] === 0);
  }

  /** The top block of the column still standing, or null. */
  public topOf(column: number): number | null {
    return this.levels(column).find((cell) => (this.durability[cell] ?? 0) > 0) ?? null;
  }

  /** Deals up to `damage` to one block; returns the hit, or null if nothing was left to break. */
  public hit(cell: number, damage: number, code: string): MineSlotHit['brokenBlocks'][number] | null {
    const left = this.durability[cell] ?? 0;
    if (left === 0) return null;
    const dealt = Math.min(left, damage);
    this.durability[cell] = left - dealt;
    const coeff = BLOCKS[code]?.coeff ?? 0;
    if (this.durability[cell] > 0 || coeff === 0) return { index: cell, damage: dealt };
    this.paidCoeff += coeff;
    return { index: cell, damage: dealt, coeff, payout: money(coeff * this.betAmount) };
  }

  private levels(column: number): number[] {
    return Array.from({ length: FIELD_DEPTH }, (_, level) => column * FIELD_DEPTH + level);
  }
}

const pickaxesOf = (board: string, reel: number): { index: number; strength: number }[] => {
  const cells = Array.from({ length: REEL_ROWS }, (_, row) => reel * REEL_ROWS + row);
  const isEnchanted = cells.some((cell) => board[cell] === ENCHANTMENT_BOOK);
  return cells
    .filter((cell) => PICKAXE_STRENGTH[board[cell] ?? ''] !== undefined)
    .map((cell) => ({ cell, base: PICKAXE_STRENGTH[board[cell] ?? ''] ?? 0 }))
    .sort((a, b) => a.base - b.base)
    .map(({ cell, base }) => ({ index: cell, strength: isEnchanted ? ENCHANTED_STRENGTH : base }));
};

const dig = (field: MineField, codes: string, column: number, strength: number): MineSlotHit['brokenBlocks'] => {
  const broken: MineSlotHit['brokenBlocks'] = [];
  let left = strength;
  for (let cell = field.topOf(column); cell !== null && left > 0; cell = field.topOf(column)) {
    const block = field.hit(cell, left, codes[cell] ?? '');
    if (block === null) break;
    broken.push(block);
    left -= block.damage;
  }
  return broken;
};

const blast = (field: MineField, codes: string, column: number): MineSlotHit['brokenBlocks'] =>
  [column, column - 1, column + 1]
    .filter((target) => target >= 0 && target < FIELD_COLUMNS)
    .map((target) => field.topOf(target))
    .flatMap((cell) => (cell === null ? [] : [field.hit(cell, DYNAMITE_DAMAGE, codes[cell] ?? '')]))
    .filter((block): block is NonNullable<typeof block> => block !== null);

/** Plays every round on one field, as the bonus game does, and totals the coefficient. */
export const playMineSlotRounds = ({ boards, field, betAmount, random = Math.random }: MineSlotRoundsInput): MineSlotPlayedRounds => {
  const mine = new MineField(field, betAmount);
  const pickaxes: MineSlotHit[] = [];
  const tnt: MineSlotHit[] = [];
  const chests: MineSlotChest[] = [];
  boards.forEach((board, round) => {
    for (let reel = 0; reel < FIELD_COLUMNS; reel += 1) {
      for (const pickaxe of pickaxesOf(board, reel)) {
        pickaxes.push({ round, index: pickaxe.index, brokenBlocks: dig(mine, field, reel, pickaxe.strength) });
      }
    }
    for (let cell = 0; cell < board.length; cell += 1) {
      if (board[cell] !== DYNAMITE) continue;
      tnt.push({ round, index: cell, brokenBlocks: blast(mine, field, Math.floor(cell / REEL_ROWS)) });
    }
    openChests(mine, chests, betAmount, random);
  });
  const multiplier = chests.reduce((product, chest) => product * chest.coeff, 1);
  const coeff = Math.round(mine.paidCoeff * multiplier * 100) / 100;
  return { rounds: boards.length, boards: [...boards], field, pickaxes, tnt, chests, coeff };
};

const openChests = (mine: MineField, chests: MineSlotChest[], betAmount: number, random: () => number): void => {
  for (let col = 0; col < FIELD_COLUMNS; col += 1) {
    if (!mine.isBrokenThrough(col) || chests.some((chest) => chest.col === col)) continue;
    const coeff = CHEST_COEFFS[Math.floor(random() * CHEST_COEFFS.length)]!;
    chests.push({ col, coeff, payout: money(coeff * betAmount) });
  }
};
