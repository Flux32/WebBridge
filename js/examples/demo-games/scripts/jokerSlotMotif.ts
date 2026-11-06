/** The joker-slot cover motif: the 3 × 4 reels the game draws, a Super Joker Coin in the middle collecting the coins. */
import { PALETTE } from '../src/kit/palette.ts';

const CELL = 96;
const PITCH = 108;

const cell = (x: number, y: number, fill: string, stroke: string): string =>
  `<rect x="${x - CELL / 2}" y="${y - CELL / 2}" width="${CELL}" height="${CELL}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;

const coin = (x: number, y: number, label: string): string =>
  `<circle cx="${x}" cy="${y}" r="34" fill="${PALETTE.amber}"/>` +
  `<text x="${x}" y="${y + 9}" text-anchor="middle" font-size="26" font-weight="900" fill="${PALETTE.night}" font-family="system-ui">${label}</text>`;

const joker = (x: number, y: number, accent: string): string =>
  `<circle cx="${x}" cy="${y}" r="62" fill="${accent}" fill-opacity="0.3"/>` +
  `<circle cx="${x}" cy="${y}" r="40" fill="${PALETTE.amber}"/>` +
  `<circle cx="${x}" cy="${y}" r="36" fill="${accent}"/>` +
  `<polygon points="${x - 18},${y - 6} ${x - 20},${y - 24} ${x - 6},${y - 14} ${x},${y - 30} ${x + 6},${y - 14} ${x + 20},${y - 24} ${x + 18},${y - 6}" fill="${PALETTE.amber}"/>` +
  `<text x="${x}" y="${y + 18}" text-anchor="middle" font-size="15" font-weight="900" fill="${PALETTE.ink}" font-family="system-ui">SUPER</text>`;

const trail = (fromX: number, fromY: number, toX: number, toY: number, accent: string): string =>
  `<path d="M ${fromX} ${fromY} Q ${(fromX + toX) / 2} ${Math.min(fromY, toY) - 60} ${toX} ${toY}" fill="none" stroke="${accent}" stroke-width="5" stroke-dasharray="4 12" stroke-linecap="round"/>`;

export const jokerSlotMotif = (accent: string): string => {
  const cells: string[] = [];
  for (let reel = 0; reel < 3; reel += 1) {
    for (let row = 0; row < 4; row += 1) {
      const isJoker = reel === 1 && row === 1;
      cells.push(cell((reel - 1) * PITCH, (row - 1.5) * PITCH, isJoker ? `${accent}30` : PALETTE.panel, isJoker ? accent : 'none'));
    }
  }
  const coins = [coin(-PITCH, -1.5 * PITCH, '×5'), coin(PITCH, 0.5 * PITCH, '×10'), coin(-PITCH, 1.5 * PITCH, '×2')];
  const trails = [trail(-PITCH, -1.5 * PITCH, 0, -0.5 * PITCH, accent), trail(PITCH, 0.5 * PITCH, 0, -0.5 * PITCH, accent)];
  return [...cells, ...trails, ...coins, joker(0, -0.5 * PITCH, accent)].join('');
};
