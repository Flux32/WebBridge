/**
 * The one look every demo game shares: a night backdrop, white rounded type and a handful of
 * accents. A mode picks its accent here; colours are never written inline in a scene.
 */
export const PALETTE = {
  night: '#0b0d1a',
  dusk: '#171b38',
  panel: '#20264d',
  panelLine: 'rgba(255, 255, 255, 0.09)',
  ink: '#f3f4fb',
  inkSoft: 'rgba(243, 244, 251, 0.64)',
  inkFaint: 'rgba(243, 244, 251, 0.32)',
  mint: '#3ee6a8',
  amber: '#ffc24d',
  coral: '#ff5d7a',
  sky: '#5fa8ff',
  violet: '#a880ff',
  lime: '#b8ef6a',
  pink: '#ff8ad8',
  copper: '#ff9a52',
  rose: '#ff4f8b',
} as const;

export type PaletteColor = (typeof PALETTE)[keyof typeof PALETTE];

export const FONT_FAMILY = '"SF Pro Rounded", ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif';
export const MONO_FAMILY = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const font = (weight: number, sizePx: number, family: string = FONT_FAMILY): string =>
  `${weight} ${Math.round(sizePx)}px ${family}`;

/** Corner radius of every card, cell and pill, in CSS pixels at the reference scale. */
export const RADIUS = 14;
