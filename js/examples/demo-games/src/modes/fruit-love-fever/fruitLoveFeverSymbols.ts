/**
 * The reel symbols by the backend's `outcomeNumber` — the only id of a cell the scene trusts (the stage
 * server's `outcome` strings are chicken-road leftovers). Codes and names come from the protocol.
 */
import { FRUIT_LOVE_FEVER_SYMBOL_NAMES, FRUIT_LOVE_FEVER_SYMBOLS } from '@omega/webbridge-protocol';

export type SymbolKind = keyof typeof FRUIT_LOVE_FEVER_SYMBOLS;

export interface ReelSymbol {
  readonly kind: SymbolKind;
  readonly name: string;
  /** A wild's multiplier; `null` on every other symbol and on a wild without one. */
  readonly multiplier: number | null;
}

// `Object.keys` widens to `string[]`; the table is a const literal, so its keys are exactly the kinds.
const KINDS = Object.keys(FRUIT_LOVE_FEVER_SYMBOLS) as SymbolKind[];

/** One frozen symbol per code without a multiplier: fillers and plain cells allocate nothing per frame. */
const PLAIN: ReadonlyMap<number, ReelSymbol> = new Map(
  KINDS.map((kind) => {
    const code = FRUIT_LOVE_FEVER_SYMBOLS[kind];
    return [code, Object.freeze({ kind, name: FRUIT_LOVE_FEVER_SYMBOL_NAMES[code], multiplier: null })] as const;
  }),
);

/** `null` for a code outside the alphabet: the caller decides how loud to fail. */
export const symbolOf = (code: number, multiplier: number | null): ReelSymbol | null => {
  const plain = PLAIN.get(code);
  if (plain === undefined || multiplier === null) return plain ?? null;
  return { ...plain, multiplier };
};

export const isWild = (symbol: ReelSymbol): boolean => symbol.kind === 'wild';

/** Fillers for a spinning strip: the fruits and the card ranks; wilds and scatters only land for real. */
export const FILLER_SYMBOLS: readonly ReelSymbol[] = [...PLAIN.values()].filter(
  (symbol) => symbol.kind !== 'wild' && symbol.kind !== 'scatter',
);
