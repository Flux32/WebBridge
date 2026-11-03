/** The dragon-pots cover motif: the three pots the game draws, coins arcing into them, the red one bursting. */
import { PALETTE } from '../src/kit/palette.ts';

const POTS = [
  { x: -150, tone: PALETTE.vermilion, fill: 1 },
  { x: 0, tone: PALETTE.mint, fill: 0.6 },
  { x: 150, tone: PALETTE.sky, fill: 0.4 },
] as const;

const pot = (x: number, tone: string, fill: number): string => {
  const height = 150;
  const top = 30;
  return (
    `<rect x="${x - 62}" y="${top}" width="124" height="${height}" rx="26" fill="${PALETTE.panel}"/>` +
    `<rect x="${x - 62}" y="${top + height * (1 - fill)}" width="124" height="${height * fill}" rx="26" fill="${tone}" fill-opacity="0.55"/>` +
    `<rect x="${x - 62}" y="${top}" width="124" height="${height}" rx="26" fill="none" stroke="${tone}" stroke-width="5"/>`
  );
};

const coin = (x: number, y: number, radius: number, tone: string, isGold: boolean): string =>
  `<circle cx="${x}" cy="${y}" r="${radius * 1.2}" fill="${isGold ? PALETTE.amber : PALETTE.ink}" fill-opacity="${isGold ? 1 : 0.85}"/>` +
  `<circle cx="${x}" cy="${y}" r="${radius}" fill="${tone}"/>` +
  `<circle cx="${x}" cy="${y}" r="${radius * 0.36}" fill="${PALETTE.night}" fill-opacity="0.45"/>`;

const trail = (fromX: number, toX: number, tone: string): string =>
  `<path d="M ${fromX} -190 Q ${(fromX + toX) / 2} -230 ${toX} -20" fill="none" stroke="${tone}" stroke-width="5" stroke-dasharray="4 12" stroke-linecap="round"/>`;

export const dragonPotsMotif = (accent: string): string => {
  const glow = `<circle cx="-150" cy="100" r="120" fill="${accent}" fill-opacity="0.22"/>`;
  const pots = POTS.map(({ x, tone, fill }) => pot(x, tone, fill)).join('');
  const trails = [trail(60, -150, accent), trail(-90, 0, PALETTE.mint), trail(20, 150, PALETTE.sky)].join('');
  const coins = [coin(-150, -40, 24, accent, true), coin(0, -70, 20, PALETTE.mint, false), coin(150, -110, 20, PALETTE.sky, false)].join('');
  const label = `<text x="-150" y="125" text-anchor="middle" font-size="28" font-weight="900" fill="${PALETTE.ink}" font-family="system-ui">GRAND</text>`;
  return [glow, trails, pots, coins, label].join('');
};
