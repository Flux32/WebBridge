import type { FruitLoveFeverSpinResult, FruitLoveFeverStepResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { FruitLoveFeverMockHost } from '../src/fruit-love-fever/FruitLoveFeverMockHost';
import { lastPayload, recordingGame } from './recordingGame';

const createHost = () => {
  const host = new FruitLoveFeverMockHost();
  const game = recordingGame();
  host.attach(game);
  return { host, game };
};

const countOf = (game: ReturnType<typeof recordingGame>, type: string): number =>
  game.received.filter((command) => command.type === type).length;

/** Asks for free spins until the bonus is over, as the game does. */
const playBonus = (host: FruitLoveFeverMockHost, game: ReturnType<typeof recordingGame>): FruitLoveFeverStepResult[] => {
  const steps: FruitLoveFeverStepResult[] = [];
  while (host.isBonusActive) {
    host.emit({ type: 'RequestStep' });
    steps.push(lastPayload(game, 'ApplyBonusStepResult') as FruitLoveFeverStepResult);
  }
  return steps;
};

describe('FruitLoveFeverMockHost', () => {
  it('answers a play with a 5 x 3 board of symbol codes', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });

    const spin = lastPayload(game, 'ApplySpinResult') as FruitLoveFeverSpinResult;
    expect(Object.keys(spin.slot.reelsCells)).toEqual(['1', '2', '3', '4', '5']);
    for (const cells of Object.values(spin.slot.reelsCells)) {
      expect(cells.map((cell) => cell.index)).toEqual([0, 1, 2]);
      cells.forEach((cell) => expect(cell.outcomeNumber).toBeGreaterThanOrEqual(0));
    }
  });

  it('refuses the next play until the game reports the round played', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'RequestPlay' });
    expect(countOf(game, 'ApplySpinResult')).toBe(1);
    expect(game.received.at(-1)?.type).toBe('DisabledPlayPressed');

    host.emit({ type: 'SpinReady' });
    host.emit({ type: 'RequestPlay' });
    expect(countOf(game, 'ApplySpinResult')).toBe(2);
  });

  it('sells a bonus at its full price and plays it free spin by free spin', () => {
    const { host, game } = createHost();

    host.buyBonus('x75');
    const spin = lastPayload(game, 'ApplySpinResult') as FruitLoveFeverSpinResult;
    const steps = playBonus(host, game);

    expect(spin).toMatchObject({ betAmount: '75.00', bonusBuy: 'x75', isFinished: false, winAmount: '0.00' });
    expect(spin.bonusGame?.currentGameNumber).toBeNull();
    expect(steps.length).toBe(spin.bonusGame?.totalFreeSpinsAmount);
    expect(steps.map((step) => step.bonusGame.currentGameNumber)).toEqual(steps.map((_, index) => index + 1));
    expect(steps.map((step) => step.isFinished)).toEqual(steps.map((_, index) => index === steps.length - 1));
  });

  it('answers the game state with the unfinished round, and with no round once it is over', () => {
    const { host, game } = createHost();
    host.buyBonus('x200');
    host.emit({ type: 'RequestStep' });

    host.emit({ type: 'RequestGameState' });
    expect(lastPayload(game, 'ApplyGameState')).toEqual(lastPayload(game, 'ApplyBonusStepResult'));

    playBonus(host, game);
    host.emit({ type: 'RequestGameState' });
    expect(lastPayload(game, 'ApplyGameState')).toEqual({ status: 'none' });
  });

  it('has no free spin to give outside a bonus', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestStep' });

    expect(countOf(game, 'ApplyBonusStepResult')).toBe(0);
  });
});
