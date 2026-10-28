/**
 * One motif per mode for the covers, drawn around the origin within about ±220 × ±200: the same shapes
 * the game itself draws, so the card and the game read as one thing.
 */
import { PALETTE } from '../src/kit/palette.ts';
import type { DemoModeId } from '../src/modes/modeIds.ts';

type Motif = (accent: string) => string;

const tile = (x: number, y: number, size: number, fill: string, stroke = 'none'): string =>
  `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="${size * 0.16}" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;

const disc = (x: number, y: number, radius: number, fill: string): string =>
  `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`;

const orb = (x: number, y: number, radius: number): string => `
  <defs><radialGradient id="orb" cx="0.35" cy="0.35" r="0.7">
    <stop offset="0" stop-color="${PALETTE.amber}"/><stop offset="1" stop-color="${PALETTE.coral}"/>
  </radialGradient></defs>${disc(x, y, radius, 'url(#orb)')}`;

const crush: Motif = (accent) =>
  [
    tile(-150, 70, 120, `${PALETTE.mint}2e`, PALETTE.mint),
    tile(0, 70, 120, PALETTE.panel, accent),
    tile(150, 70, 120, PALETTE.panel),
    `<rect x="-58" y="-170" width="116" height="78" rx="14" fill="${PALETTE.dusk}" stroke="${accent}" stroke-width="4"/>`,
    orb(0, -18, 34),
  ].join('');

const pegTriangle = (rows: number, spacing: number, top: number): string => {
  const pegs: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let index = 0; index <= row + 2; index += 1) {
      pegs.push(disc((index - (row + 2) / 2) * spacing, top + row * spacing * 0.9, 5, `${PALETTE.ink}66`));
    }
  }
  return pegs.join('');
};

const slotChips = (colors: readonly string[], y: number, width: number): string =>
  colors
    .map((color, index) => {
      const x = (index - (colors.length - 1) / 2) * width;
      return `<rect x="${x - width / 2 + 4}" y="${y}" width="${width - 8}" height="30" rx="9" fill="${color}"/>`;
    })
    .join('');

const plinko: Motif = (accent) =>
  pegTriangle(7, 46, -170) +
  slotChips([PALETTE.amber, accent, `${accent}88`, PALETTE.panel, `${accent}88`, accent, PALETTE.amber], 160, 54) +
  orb(23, -60, 18);

const plinkoAztec: Motif = (accent) =>
  pegTriangle(7, 46, -170) +
  slotChips([PALETTE.amber, accent, `${accent}88`, PALETTE.panel, `${accent}88`, accent, PALETTE.amber], 160, 54) +
  [orb(-46, -100, 15), orb(23, -30, 15), orb(70, 60, 15)].join('') +
  `<circle cx="160" cy="-150" r="40" fill="none" stroke="${accent}" stroke-width="10" stroke-dasharray="18 10"/>`;

const twist: Motif = (accent) => {
  const gems = [PALETTE.mint, PALETTE.amber, PALETTE.coral];
  return [-120, 0, 120]
    .map(
      (x) =>
        `<rect x="${x - 50}" y="-160" width="100" height="250" rx="22" fill="${PALETTE.panel}"/>` +
        disc(x, -95, 30, `${gems[0]}55`) +
        disc(x, -20, 36, gems[0] ?? accent) +
        disc(x, 55, 30, `${gems[0]}55`),
    )
    .join('') + `<rect x="-190" y="125" width="380" height="16" rx="8" fill="${accent}55"/><rect x="-190" y="125" width="230" height="16" rx="8" fill="${accent}"/>`;
};

const slotCoinSymbol = (x: number, y: number, kind: number, color: string): string => {
  if (kind === 0) return disc(x, y, 28, color);
  if (kind === 1) return `<polygon points="${x},${y - 32} ${x + 30},${y + 24} ${x - 30},${y + 24}" fill="${color}"/>`;
  return `<polygon points="${x},${y - 32} ${x + 28},${y} ${x},${y + 32} ${x - 28},${y}" fill="${color}"/>`;
};

const slotCoin: Motif = (accent) => {
  const cells: string[] = [];
  for (let column = 0; column < 3; column += 1) {
    for (let row = 0; row < 3; row += 1) {
      const isWin = row === 1;
      const x = (column - 1) * 120;
      const y = (row - 1) * 110 - 20;
      cells.push(tile(x, y, 100, isWin ? `${accent}30` : PALETTE.panel, isWin ? accent : 'none'));
      cells.push(slotCoinSymbol(x, y, isWin ? 2 : (column + row) % 3, isWin ? accent : `${PALETTE.ink}88`));
    }
  }
  return cells.join('');
};

const wheel: Motif = (accent) => {
  const colors = [PALETTE.mint, PALETTE.sky, PALETTE.coral, PALETTE.dusk];
  const cells = 36;
  const radius = 170;
  const segments: string[] = [];
  for (let index = 0; index < cells; index += 1) {
    const from = (index / cells) * Math.PI * 2;
    const to = ((index + 1) / cells) * Math.PI * 2;
    const point = (angle: number, r: number) => `${(Math.sin(angle) * r).toFixed(1)},${(-Math.cos(angle) * r).toFixed(1)}`;
    segments.push(
      `<polygon points="${point(from, radius)} ${point(to, radius)} ${point(to, radius * 0.7)} ${point(from, radius * 0.7)}" fill="${colors[index % 4]}" stroke="${PALETTE.night}" stroke-width="3"/>`,
    );
  }
  return (
    segments.join('') +
    disc(0, 0, 100, PALETTE.panel) +
    `<text x="0" y="16" text-anchor="middle" font-size="46" font-weight="800" fill="${accent}" font-family="system-ui">x50</text>` +
    `<polygon points="-18,-200 18,-200 0,-168" fill="${accent}"/>`
  );
};

const jumper: Motif = (accent) => {
  const steps = [0, 1, 2, 3].map((index) => {
    const x = -150 + index * 100;
    const y = 120 - index * 80;
    return `<rect x="${x - 45}" y="${y}" width="90" height="22" rx="11" fill="${index === 3 ? accent : PALETTE.panel}"/>`;
  });
  const trail = `<path d="M -150 100 Q -100 -10 -50 40 Q 40 -150 150 -140" fill="none" stroke="${accent}" stroke-width="5" stroke-dasharray="4 12" stroke-linecap="round"/>`;
  return steps.join('') + trail + orb(150, -175, 30) + `<polygon points="-62,30 -38,30 -50,8" fill="${PALETTE.amber}"/>`;
};

export const MOTIFS: Record<DemoModeId, Motif> = {
  plinko,
  'plinko-aztec': plinkoAztec,
  crush,
  twist,
  'slot-coin': slotCoin,
  wheel,
  jumper,
};
