/**
 * Exact type equality for compile-time assertions. Distributive conditionals
 * (plain `A extends B`) accept a wider or narrower union silently; wrapping
 * both sides in a non-distributed check makes a mismatch a compile error.
 */
export type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

export type Expect<T extends true> = T;
