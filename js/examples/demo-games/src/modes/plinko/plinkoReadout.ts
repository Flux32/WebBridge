/** What the plinko readout says: the landed multiplier, never before the ball has landed. */
import type { PlinkoDrop } from './plinkoRound';
import type { Readout } from './drawReadout';

export type PlinkoPhase = 'idle' | 'dropping';

export interface PlinkoViewModel {
  readonly phase: PlinkoPhase;
  /** The last drop that has landed. */
  readonly lastDrop: PlinkoDrop | null;
  /** A drop the host sent that could not be read. */
  readonly error: string | null;
}

const LABEL = 'MULTIPLIER';

const captionOf = ({ phase, lastDrop, error }: PlinkoViewModel): string => {
  if (phase === 'dropping') return 'Dropping…';
  if (error !== null) return `Broken drop: ${error}`;
  if (lastDrop === null) return 'Tap to drop';
  return `Won ${lastDrop.winAmount} ${lastDrop.currency} · ${lastDrop.risk} risk · tap to drop`;
};

export const plinkoReadout = (view: PlinkoViewModel): Readout => ({
  label: LABEL,
  value: `x${(view.lastDrop?.coefficient ?? 0).toFixed(2)}`,
  caption: captionOf(view),
});
