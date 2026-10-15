import type { EngineCommand } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { PlinkoMockHost, type PlinkoMockHostOptions } from '../src/plinko/PlinkoMockHost';
import { lastPayload, recordingGame } from './recordingGame';

const COEFFICIENTS = { LOW: [5, 1.2, 0.5, 1.2, 5], MEDIUM: [10, 1, 0.3, 1, 10], HIGH: [30, 0.5, 0.2, 0.5, 30] };

const createHost = (options: Partial<PlinkoMockHostOptions> = {}) => {
  const host = new PlinkoMockHost({ coefficients: COEFFICIENTS, betAmount: 2, random: () => 0, ...options });
  const game = recordingGame();
  host.attach(game);
  return { host, game };
};

describe('PlinkoMockHost session', () => {
  it('pushes the config and the idle state once the game is ready', () => {
    const { host, game } = createHost();

    host.ready();

    expect(game.received.map((command) => command.type)).toEqual(['ApplyGameConfig', 'ApplyGameState']);
    expect(lastPayload(game, 'ApplyGameConfig')).toMatchObject({ currency: 'USD', coefficients: COEFFICIENTS });
    expect(lastPayload(game, 'ApplyGameState')).toMatchObject({ status: 'none', isFinished: true });
  });

  it('answers the config and state requests', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestGameConfig' });
    host.emit({ type: 'RequestGameState' });

    expect(game.received.map((command) => command.type)).toEqual(['ApplyGameConfig', 'ApplyGameState']);
  });
});

describe('PlinkoMockHost drops', () => {
  it('lands the ball in a slot of the chosen risk and pays its coefficient', () => {
    const { host, game } = createHost({ risk: 'HIGH' });

    host.drop('top');

    expect(lastPayload(game, 'ApplyDropResult')).toMatchObject({
      status: 'win',
      isFinished: true,
      isWin: true,
      risk: 'HIGH',
      resultPosition: 0,
      coeff: 30,
      winAmount: '60.00',
      betAmount: '2.00',
      currency: 'USD',
    });
  });

  it('lands the ball in the lowest slot on the bottom scenario', () => {
    const { host, game } = createHost();

    host.drop('bottom');

    expect(lastPayload(game, 'ApplyDropResult')).toMatchObject({ resultPosition: 2, coeff: 0.5, winAmount: '1.00' });
  });

  it('draws a random slot by the board rows, edge slots being the rarest', () => {
    const { host, game } = createHost({ random: () => 0.9 });

    host.drop();

    expect(lastPayload(game, 'ApplyDropResult')).toMatchObject({ resultPosition: 0 });
  });

  it('holds the next drop until the ball has landed', () => {
    const { host, game } = createHost();

    host.drop();
    host.drop();
    host.emit({ type: 'DropFinished' });
    host.drop();

    expect(game.received.filter((command) => command.type === 'ApplyDropResult')).toHaveLength(2);
  });

  it('refuses a play from the scene while the ball is falling and drops when idle', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'RequestPlay' });

    expect(game.received.map((command) => command.type)).toEqual<EngineCommand['type'][]>([
      'ApplyDropResult',
      'DisabledPlayPressed',
    ]);
  });

  it('cycles the risk the next drop plays', () => {
    const { host, game } = createHost();

    host.cycleRisk();
    host.drop('top');

    expect(host.risk).toBe('MEDIUM');
    expect(lastPayload(game, 'ApplyDropResult')).toMatchObject({ risk: 'MEDIUM', coeff: 10 });
  });
});
