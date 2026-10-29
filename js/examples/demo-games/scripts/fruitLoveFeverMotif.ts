/** The fruit-love-fever cover motif: a reel row with a locked wild heart between fruits, a win line through it. */
import { PALETTE } from '../src/kit/palette.ts';

const cell = (x: number, y: number, stroke: string): string =>
  `<rect x="${x - 52}" y="${y - 52}" width="104" height="104" rx="16" fill="${PALETTE.panel}" stroke="${stroke}" stroke-width="5"/>`;

/** The heart the game draws for the wild, `size` wide around (x, y). */
const heart = (x: number, y: number, size: number, fill: string): string => {
  const h = size / 2;
  return (
    `<path d="M ${x} ${y + h * 0.8} C ${x - h * 1.3} ${y - h * 0.05} ${x - h * 0.55} ${y - h * 1.05} ${x} ${y - h * 0.4} ` +
    `C ${x + h * 0.55} ${y - h * 1.05} ${x + h * 1.3} ${y - h * 0.05} ${x} ${y + h * 0.8} Z" fill="${fill}"/>`
  );
};

const pineapple = (x: number, y: number): string =>
  [-1, 0, 1].map((leaf) => `<ellipse cx="${x + leaf * 9}" cy="${y - 26}" rx="6" ry="16" fill="${PALETTE.mint}" transform="rotate(${leaf * 24} ${x} ${y - 26})"/>`).join('') +
  `<ellipse cx="${x}" cy="${y + 8}" rx="22" ry="28" fill="${PALETTE.copper}"/>`;

const strawberry = (x: number, y: number): string =>
  heart(x, y + 6, 66, PALETTE.coral) + `<ellipse cx="${x}" cy="${y - 20}" rx="16" ry="7" fill="${PALETTE.mint}"/>`;

const rank =
  (label: string, color: string) =>
  (x: number, y: number): string =>
    `<text x="${x}" y="${y + 20}" text-anchor="middle" font-size="58" font-weight="900" fill="${color}" font-family="system-ui">${label}</text>`;

const wild =
  (accent: string) =>
  (x: number, y: number): string =>
    heart(x, y, 86, accent) +
    `<text x="${x}" y="${y + 2}" text-anchor="middle" font-size="20" font-weight="900" fill="${PALETTE.ink}" font-family="system-ui">WILD</text>` +
    `<rect x="${x + 12}" y="${y + 20}" width="34" height="22" rx="11" fill="${PALETTE.amber}"/>` +
    `<text x="${x + 29}" y="${y + 37}" text-anchor="middle" font-size="16" font-weight="900" fill="${PALETTE.night}" font-family="system-ui">x2</text>`;

type Draw = (x: number, y: number) => string;

export const fruitLoveFeverMotif = (accent: string): string => {
  const grid: readonly (readonly [Draw, string])[][] = [
    [[rank('A', PALETTE.violet), 'none'], [strawberry, 'none'], [rank('K', PALETTE.sky), 'none']],
    [[pineapple, PALETTE.amber], [wild(accent), accent], [pineapple, PALETTE.amber]],
    [[strawberry, 'none'], [rank('Q', PALETTE.mint), 'none'], [pineapple, 'none']],
  ];
  const at = (row: number, column: number): [number, number] => [(column - 1) * 120, (row - 1) * 125];
  const cells = grid.flatMap((row, r) => row.map(([, stroke], c) => cell(...at(r, c), stroke)));
  const symbols = grid.flatMap((row, r) => row.map(([draw], c) => draw(...at(r, c))));
  // Under the symbols, over the cells: the win line reads without hiding what it pays for.
  const line = `<polyline points="-120,0 0,0 120,0" fill="none" stroke="${PALETTE.amber}" stroke-width="7" stroke-opacity="0.7"/>`;
  return [...cells, line, ...symbols].join('');
};
