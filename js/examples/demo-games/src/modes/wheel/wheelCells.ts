/**
 * The wheel's 54 cells and where they stand. The host never sends the layout — only the winning
 * `cellIndex` and the stop point inside it (`inCellOffset`, a share of the cell) — so the engine owns it.
 * The production client's order starts GREEN, BLUE, RED, BLACK (RoadFrontent `src/modes/wheel/PROTOCOL.md`);
 * the rest is ours: one GREEN, 10 BLUE, 17 RED, 26 BLACK, the split a ×2/×3/×5/×50 wheel of 54 needs.
 */
export const WHEEL_COLORS = ['BLACK', 'RED', 'BLUE', 'GREEN'] as const;

export type WheelColor = (typeof WHEEL_COLORS)[number];

export const WHEEL_MULTIPLIERS: Readonly<Record<WheelColor, number>> = { BLACK: 2, RED: 3, BLUE: 5, GREEN: 50 };

const CODE_COLORS: Readonly<Record<string, WheelColor>> = { K: 'BLACK', R: 'RED', B: 'BLUE', G: 'GREEN' };

const LAYOUT_CODES = 'GBRKRKRKBKRKRKBKRKRKBKRKRKBKRKBKRKRKBKRKRKBKRKRKBKRKBK';

export const WHEEL_CELLS: readonly WheelColor[] = [...LAYOUT_CODES].map((code) => {
  const color = CODE_COLORS[code];
  if (color === undefined) throw new Error(`[demo wheel] unknown cell code ${code}`);
  return color;
});

export const CELL_COUNT = WHEEL_CELLS.length;

const TURN = Math.PI * 2;
export const CELL_ANGLE = TURN / CELL_COUNT;

/** Where the pointer stops inside a cell when the host names none: its middle. */
export const CENTER_OFFSET = 0.5;

export const isWheelColor = (value: unknown): value is WheelColor => WHEEL_COLORS.some((color) => color === value);

const normalize = (angle: number): number => ((angle % TURN) + TURN) % TURN;

/**
 * The wheel's rotation that puts `cellIndex + inCellOffset` under the pointer at the top. Cell `i` spans
 * `[rotation + i·CELL_ANGLE, rotation + (i + 1)·CELL_ANGLE)` clockwise from the top.
 */
export const landingRotation = (cellIndex: number, inCellOffset: number): number =>
  normalize(-(cellIndex + inCellOffset) * CELL_ANGLE);

/** The cell under the pointer at `rotation`. */
export const cellAtPointer = (rotation: number): number =>
  Math.floor(normalize(-rotation) / CELL_ANGLE + 1e-9) % CELL_COUNT;

/** Spins clockwise from `from` by at least `turns` full turns and stops at `landing` (mod one turn). */
export const spinTarget = (from: number, landing: number, turns: number): number => {
  const start = from + turns * TURN;
  return start + normalize(landing - start);
};

/** A cell of the colour, for a result that names the colour but not the cell (a page opened mid-result). */
export const firstCellOf = (color: WheelColor): number => WHEEL_CELLS.indexOf(color);
