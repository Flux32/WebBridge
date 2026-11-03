/** The base reels' symbols by the backend's codes (`matrix` cells); codes come from the protocol. */
import { DRAGON_POTS_SYMBOLS, type DragonPotsSymbol } from '@omega/webbridge-protocol';

export type SymbolKind = keyof typeof DRAGON_POTS_SYMBOLS;

// `Object.keys` widens to `string[]`; the table is a const literal, so its keys are exactly the kinds.
const KINDS = Object.keys(DRAGON_POTS_SYMBOLS) as SymbolKind[];

export const SYMBOL_CODES: readonly DragonPotsSymbol[] = KINDS.map((kind) => DRAGON_POTS_SYMBOLS[kind]);

const KIND_BY_CODE: ReadonlyMap<string, SymbolKind> = new Map(KINDS.map((kind) => [DRAGON_POTS_SYMBOLS[kind], kind]));

/** `null` for a code outside the alphabet: the caller decides how loud to fail. */
export const symbolKindOf = (code: string): SymbolKind | null => KIND_BY_CODE.get(code) ?? null;

/** Fillers for a spinning strip: the paying symbols; wilds and coins only land for real. */
export const FILLER_KINDS: readonly SymbolKind[] = KINDS.filter((kind) => kind !== 'wild' && kind !== 'coin');
