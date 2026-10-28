/**
 * Where the peg board sits in its area. Row `r` has `r + 3` pegs; the ball path (`ballPath`) counts pegs to
 * the right of the top one, so the ball at row `r` sits over the peg `rights[r] + 1` and a board of `rows`
 * rows has `rows + 1` slots, each between two pegs of the last row.
 */
import type { Rect } from '../../kit/paint';

export interface BoardLayout {
  readonly rows: number;
  readonly pitch: number;
  readonly rowGap: number;
  readonly centerX: number;
  readonly topY: number;
  readonly slotY: number;
  readonly slotHeight: number;
  readonly pegRadius: number;
  readonly ballRadius: number;
}

const ROW_GAP_SHARE = 0.9;
const MAX_PITCH = 46;
/** The ball enters this many row gaps above the top peg. */
const ENTRY_GAP = 1.2;
/** The slot chips sit a little closer to the last peg row than a full row gap. */
const SLOT_LIFT = 0.35;

export const boardLayoutOf = (area: Rect, rows: number): BoardLayout => {
  const pitch = Math.min(MAX_PITCH, area.width / (rows + 2), area.height / (rows * ROW_GAP_SHARE + 1.8));
  const rowGap = pitch * ROW_GAP_SHARE;
  const slotHeight = pitch * 0.82;
  const height = (rows + ENTRY_GAP - SLOT_LIFT) * rowGap + slotHeight;
  const topY = area.y + (area.height - height) / 2 + rowGap * ENTRY_GAP;
  return {
    rows,
    pitch,
    rowGap,
    centerX: area.x + area.width / 2,
    topY,
    slotY: topY + (rows - SLOT_LIFT) * rowGap,
    slotHeight,
    pegRadius: Math.max(2, pitch * 0.09),
    ballRadius: Math.max(4, pitch * 0.24),
  };
};

export const pegX = (layout: BoardLayout, row: number, column: number): number =>
  layout.centerX + (column - (row + 2) / 2) * layout.pitch;

export const pegY = (layout: BoardLayout, row: number): number => layout.topY + row * layout.rowGap;

export const slotX = (layout: BoardLayout, slot: number): number => layout.centerX + (slot - layout.rows / 2) * layout.pitch;

/**
 * The ball's stops on its way down: point `0` above the board, point `r + 1` resting on the peg it hits in
 * row `r`, point `rows + 1` in its slot.
 */
export const stopX = (layout: BoardLayout, path: readonly number[], point: number): number => {
  if (point === 0) return layout.centerX;
  const row = point - 1;
  return layout.centerX + ((path[row] ?? 0) - row / 2) * layout.pitch;
};

export const stopY = (layout: BoardLayout, point: number): number => {
  if (point === 0) return layout.topY - layout.rowGap * ENTRY_GAP;
  if (point > layout.rows) return layout.slotY - layout.ballRadius * 0.4;
  return pegY(layout, point - 1) - layout.pegRadius - layout.ballRadius;
};
