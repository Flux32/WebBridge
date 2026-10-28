/**
 * The two alphabets of the mine-slot backend: reel symbols (`boards`) and field blocks (`field`). Codes come
 * from the protocol; both alphabets reuse letters (`d` is a dynamite on the reels and dirt in the field), so
 * each is looked up in its own table.
 */
import { MINE_SLOT_BLOCKS, MINE_SLOT_SYMBOLS } from '@omega/webbridge-protocol';

export type PickaxeTier = 'wooden' | 'stone' | 'golden' | 'enchanted';

export type ReelSymbol =
  | { readonly kind: 'empty' }
  | { readonly kind: 'pickaxe'; readonly tier: PickaxeTier }
  | { readonly kind: 'dynamite' }
  | { readonly kind: 'book' }
  | { readonly kind: 'scatter' };

export type BlockTier = keyof typeof MINE_SLOT_BLOCKS;

export interface Block {
  readonly tier: BlockTier;
  readonly durability: number;
}

const SYMBOLS: ReadonlyMap<string, ReelSymbol> = new Map<string, ReelSymbol>([
  [MINE_SLOT_SYMBOLS.empty, { kind: 'empty' }],
  [MINE_SLOT_SYMBOLS.woodenPickaxe, { kind: 'pickaxe', tier: 'wooden' }],
  [MINE_SLOT_SYMBOLS.stonePickaxe, { kind: 'pickaxe', tier: 'stone' }],
  [MINE_SLOT_SYMBOLS.goldenPickaxe, { kind: 'pickaxe', tier: 'golden' }],
  [MINE_SLOT_SYMBOLS.enchantedPickaxe, { kind: 'pickaxe', tier: 'enchanted' }],
  [MINE_SLOT_SYMBOLS.dynamite, { kind: 'dynamite' }],
  [MINE_SLOT_SYMBOLS.enchantmentBook, { kind: 'book' }],
  [MINE_SLOT_SYMBOLS.scatter, { kind: 'scatter' }],
]);

// `Object.keys` widens to `string[]`; the table is a const literal, so its keys are exactly the tiers.
const BLOCK_TIERS = Object.keys(MINE_SLOT_BLOCKS) as BlockTier[];

/** One frozen object per code: the field is drawn every frame without allocating. */
const BLOCKS: ReadonlyMap<string, Block> = new Map(
  BLOCK_TIERS.map((tier) => {
    const { code, durability } = MINE_SLOT_BLOCKS[tier];
    return [code, Object.freeze({ tier, durability })] as const;
  }),
);

/** `null` for a code outside the alphabet: the caller decides how loud to fail. */
export const reelSymbolOf = (code: string): ReelSymbol | null => SYMBOLS.get(code) ?? null;

export const blockOf = (code: string): Block | null => BLOCKS.get(code) ?? null;

/** Fillers for a spinning strip: mostly empty cells and the common pickaxes, as the reels show them. */
export const FILLER_SYMBOLS: readonly ReelSymbol[] = [...'xx1x2x3d'].flatMap((code) => {
  const symbol = SYMBOLS.get(code);
  return symbol === undefined ? [] : [symbol];
});
