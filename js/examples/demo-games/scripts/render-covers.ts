/**
 * Renders the covers of the demo games as SVG, 3:4 like every game card of the configurator: the games'
 * night backdrop and accent, a motif of the mode and its name. `covers/<mode>.svg`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_FAMILY, PALETTE } from '../src/kit/palette.ts';
import { DEMO_MODE_IDS, type DemoModeId } from '../src/modes/modeIds.ts';
import { MOTIFS } from './coverMotifs.ts';

const WIDTH = 600;
const HEIGHT = 800;

interface CoverStyle {
  readonly title: string;
  readonly accent: string;
}

const COVER_STYLES: Record<DemoModeId, CoverStyle> = {
  plinko: { title: 'Plinko', accent: PALETTE.sky },
  'plinko-aztec': { title: 'Plinko Aztec', accent: PALETTE.lime },
  crush: { title: 'Crush', accent: PALETTE.coral },
  twist: { title: 'Twist', accent: PALETTE.mint },
  slot: { title: 'Slot', accent: PALETTE.amber },
  wheel: { title: 'Wheel', accent: PALETTE.violet },
  jumper: { title: 'Jumper', accent: PALETTE.pink },
};

const backdrop = (accent: string): string => `
  <defs>
    <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PALETTE.dusk}"/>
      <stop offset="1" stop-color="${PALETTE.night}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.4" r="0.6">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <rect x="13" y="13" width="2" height="2" fill="#ffffff" fill-opacity="0.05"/>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#night)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>`;

const caption = ({ title, accent }: CoverStyle): string => `
  <g font-family='${FONT_FAMILY}' text-anchor="middle">
    <text x="${WIDTH / 2}" y="${HEIGHT - 150}" font-size="22" font-weight="800" letter-spacing="6"
      fill="${accent}">DEMO</text>
    <text x="${WIDTH / 2}" y="${HEIGHT - 88}" font-size="64" font-weight="800" fill="${PALETTE.ink}">${title}</text>
  </g>`;

const renderCover = (mode: DemoModeId): string => {
  const style = COVER_STYLES[mode];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${backdrop(
    style.accent,
  )}
  <g transform="translate(${WIDTH / 2} 330)">${MOTIFS[mode](style.accent)}</g>${caption(style)}
</svg>
`;
};

const outDir = 'covers';
mkdirSync(outDir, { recursive: true });
for (const mode of DEMO_MODE_IDS) {
  writeFileSync(join(outDir, `${mode}.svg`), renderCover(mode));
  console.log(`[demo-games] cover ${mode}`);
}
