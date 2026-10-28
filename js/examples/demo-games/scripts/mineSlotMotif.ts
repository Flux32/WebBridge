/** The mine-slot cover motif: reels with pickaxes over a field of blocks, one column dug through to its chest. */
import { PALETTE } from '../src/kit/palette.ts';

const pickaxe = (x: number, y: number, size: number, tone: string): string =>
  `<g transform="translate(${x} ${y}) rotate(45)" fill="none" stroke-linecap="round">` +
  `<line x1="0" y1="${-size * 0.24}" x2="0" y2="${size * 0.34}" stroke="${PALETTE.copper}99" stroke-width="${size * 0.08}"/>` +
  `<path d="M ${-size * 0.32} ${-size * 0.1} Q 0 ${-size * 0.4} ${size * 0.32} ${-size * 0.1}" stroke="${tone}" stroke-width="${size * 0.11}"/></g>`;

const reelCell = (x: number, stroke: string): string =>
  `<rect x="${x - 48}" y="-198" width="96" height="96" rx="15" fill="${PALETTE.panel}" stroke="${stroke}" stroke-width="4"/>`;

const block = (column: number, level: number, tone: string): string => {
  const x = (column - 2) * 78;
  const y = -40 + level * 50;
  return `<rect x="${x - 36}" y="${y}" width="72" height="42" rx="8" fill="${tone}4d" stroke="${tone}bf" stroke-width="3"/>`;
};

export const mineSlotMotif = (accent: string): string => {
  const tones = [accent, PALETTE.ink, PALETTE.amber];
  const blocks = [0, 1, 3, 4].flatMap((column) => tones.map((tone, level) => block(column, level, tone)));
  const chest = `<rect x="-36" y="118" width="72" height="50" rx="10" fill="${PALETTE.amber}3d" stroke="${PALETTE.amber}" stroke-width="4"/>`;
  const label = `<text x="0" y="153" text-anchor="middle" font-size="30" font-weight="900" fill="${PALETTE.amber}" font-family="system-ui">×10</text>`;
  return [
    reelCell(-110, 'none'),
    reelCell(0, accent),
    reelCell(110, 'none'),
    pickaxe(-110, -150, 80, PALETTE.ink),
    pickaxe(110, -150, 80, PALETTE.amber),
    ...blocks,
    pickaxe(0, 40, 88, accent),
    chest,
    label,
  ].join('');
};
