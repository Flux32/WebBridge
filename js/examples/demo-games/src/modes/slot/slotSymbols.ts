/**
 * The board alphabet of the slot backend. A symbol is a key, not a number: codes run `0`…`9`, then
 * `a`…`m`, so they are looked up, never folded by arithmetic (see `SlotMockHost` of the bridge package).
 */
export type JackpotTier = 'MINI' | 'MINOR' | 'MAJOR' | 'GRAND';

export type SlotSymbol =
  | { readonly kind: 'empty' }
  | { readonly kind: 'base'; readonly rank: number }
  | { readonly kind: 'coin'; readonly coeff: number }
  | { readonly kind: 'jackpot'; readonly tier: JackpotTier; readonly coeff: number }
  | { readonly kind: 'trigger' }
  | { readonly kind: 'special' };

const COIN_COEFFS: Readonly<Record<string, number>> = { a: 1, b: 2, c: 3, d: 5, e: 7, f: 10, g: 15 };
const JACKPOTS: Readonly<Record<string, { tier: JackpotTier; coeff: number }>> = {
  h: { tier: 'MINI', coeff: 25 },
  i: { tier: 'MINOR', coeff: 50 },
  j: { tier: 'MAJOR', coeff: 150 },
  k: { tier: 'GRAND', coeff: 1000 },
};

const describeCode = (code: string): SlotSymbol | null => {
  if (code === '0') return { kind: 'empty' };
  if (code === 'l') return { kind: 'trigger' };
  if (code === 'm') return { kind: 'special' };
  if (/^[1-9]$/.test(code)) return { kind: 'base', rank: Number(code) };
  const coin = COIN_COEFFS[code];
  if (coin !== undefined) return { kind: 'coin', coeff: coin };
  const jackpot = JACKPOTS[code];
  return jackpot === undefined ? null : { kind: 'jackpot', ...jackpot };
};

/** One frozen object per code: the reels draw them every frame without allocating. */
const SYMBOLS: ReadonlyMap<string, SlotSymbol> = new Map(
  [...'0123456789abcdefghijklm'].flatMap((code) => {
    const symbol = describeCode(code);
    return symbol === null ? [] : [[code, Object.freeze(symbol)] as const];
  }),
);

/** `null` for a code outside the alphabet: the caller decides how loud to fail. */
export const symbolOf = (code: string): SlotSymbol | null => SYMBOLS.get(code) ?? null;

/** What a coin or a jackpot medallion is worth by the board alone; `null` for other symbols. */
export const symbolCoeff = (symbol: SlotSymbol): number | null =>
  symbol.kind === 'coin' || symbol.kind === 'jackpot' ? symbol.coeff : null;

/** Fillers for a spinning strip: the plain symbols, the ones a reel shows most. */
export const FILLER_SYMBOLS: readonly SlotSymbol[] = [...'123456789ab'].flatMap((code) => {
  const symbol = SYMBOLS.get(code);
  return symbol === undefined ? [] : [symbol];
});
