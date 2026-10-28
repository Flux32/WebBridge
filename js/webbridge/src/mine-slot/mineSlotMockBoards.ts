/**
 * Boards and fields the mock host deals, in the backend's alphabet: empty cells most of the time, pickaxes
 * rarer the stronger they are, and a field that gets harder the deeper it goes.
 */
const REEL_CELLS = 15;
const SCATTER = 'b';
const BONUS_SCATTERS = 3;

/** Symbol weights of one reel cell. */
const SYMBOL_WEIGHTS: readonly (readonly [string, number])[] = [
  ['x', 52],
  ['1', 16],
  ['2', 10],
  ['3', 6],
  ['5', 3],
  ['d', 5],
  ['e', 3],
  ['b', 5],
];

/** Blocks by level, top to bottom: dirt on top, obsidian at the bottom now and then. */
const LEVEL_BLOCKS: readonly string[] = ['d', 'ds', 's', 'sr', 'rgc', 'gco'];

const weighted = (random: () => number): string => {
  const total = SYMBOL_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [symbol, weight] of SYMBOL_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return symbol;
  }
  return 'x';
};

const pick = (choices: string, random: () => number): string => choices[Math.floor(random() * choices.length)]!;

export const dealBoard = (random: () => number): string =>
  Array.from({ length: REEL_CELLS }, () => weighted(random)).join('');

export const dealField = (random: () => number): string =>
  Array.from({ length: 5 }, () => LEVEL_BLOCKS.map((choices) => pick(choices, random)).join('')).join('');

export const startsBonus = (board: string): boolean =>
  [...board].filter((symbol) => symbol === SCATTER).length >= BONUS_SCATTERS;

/** A base board that starts the bonus game: scatters on the top row of the first three reels. */
export const dealBonusBoard = (random: () => number): string =>
  [...dealBoard(random)].map((symbol, cell) => (cell === 0 || cell === 3 || cell === 6 ? SCATTER : symbol)).join('');
