/** What the plinko-aztec readout says: the win of a drop only once every ball, the wheel and the bonus are in. */
import type { Readout } from '../plinko/drawReadout';
import type { AztecBonus, AztecDrop } from './aztecRound';

export type AztecPhase = 'idle' | 'dropping' | 'wheel' | 'bonus' | 'bonus-step';

/** The bet bar's choice the host pushes: `0` balls and no bet until it has. */
export interface AztecSelection {
  readonly ballsAmount: number;
  readonly betPerBall: string | null;
}

export interface AztecViewModel {
  readonly phase: AztecPhase;
  readonly selection: AztecSelection;
  readonly currency: string;
  /** The last drop that has played out. */
  readonly lastDrop: AztecDrop | null;
  /** The running bonus game, as of its last played-out step. */
  readonly bonus: AztecBonus | null;
  readonly ballsInPlay: number;
  readonly error: string | null;
}

const NO_VALUE = '—';

/** The bet per ball with its currency, or null until the bet bar has reported its choice. */
const betOf = ({ selection, currency }: AztecViewModel): string | null => {
  if (selection.ballsAmount === 0 || selection.betPerBall === null) return null;
  return `${selection.betPerBall} ${currency}`.trim();
};

const bonusReadout = (view: AztecViewModel, bonus: AztecBonus): Readout => ({
  label: `BONUS GAME · LEVEL ${bonus.level}`,
  value: `${bonus.winAmount} ${view.currency}`.trim(),
  caption:
    view.phase === 'bonus-step'
      ? 'Dropping…'
      : `${bonus.dropsLeft} drops left · tap to drop ${bonus.ballsPerDrop} balls`,
});

const idleReadout = (view: AztecViewModel): Readout => {
  const bet = betOf(view);
  const balls = view.selection.ballsAmount;
  if (view.lastDrop === null) {
    return {
      label: 'BALLS × BET PER BALL',
      value: bet === null ? NO_VALUE : `${balls} × ${bet}`,
      caption: bet === null ? 'Waiting for the bet bar' : 'Tap to drop',
    };
  }
  return {
    label: 'TOTAL WIN',
    value: `${view.lastDrop.winAmount} ${view.currency}`.trim(),
    caption: bet === null ? 'Tap to drop' : `${balls} balls × ${bet} · tap to drop`,
  };
};

const readoutOf = (view: AztecViewModel): Readout => {
  if (view.bonus !== null && (view.phase === 'bonus' || view.phase === 'bonus-step')) return bonusReadout(view, view.bonus);
  if (view.phase === 'dropping') return { label: 'BALLS IN PLAY', value: String(view.ballsInPlay), caption: 'Dropping…' };
  if (view.phase === 'wheel') return { label: 'FORTUNE WHEEL', value: 'SPIN', caption: 'The wheel decides…' };
  return idleReadout(view);
};

export const aztecReadout = (view: AztecViewModel): Readout => {
  const readout = readoutOf(view);
  return view.error === null ? readout : { ...readout, caption: `Broken round: ${view.error}` };
};
