/** The status line under the wheel, by phase. */
import { WHEEL_MULTIPLIERS } from './wheelCells';
import type { WheelViewModel } from './WheelView';

export const captionOf = ({ phase, winner, round }: WheelViewModel): string => {
  const roundLabel = round?.roundId === null || round === null ? '' : ` · round ${round.roundId}`;
  switch (phase) {
    case 'waiting':
      return 'Waiting for the next round…';
    case 'betting':
      return `Place your bets${roundLabel}`;
    case 'spinning':
      return 'No more bets';
    case 'landed':
      return 'Settling the round…';
    case 'result':
      return winner === null ? 'Round over' : `${winner} wins · pays x${WHEEL_MULTIPLIERS[winner]}`;
    case 'stopped':
      return 'Rounds are paused';
  }
};
