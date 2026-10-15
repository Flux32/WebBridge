import type { EngineCommand } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { PlinkoAztecMockHost, type PlinkoAztecMockHostOptions } from '../src/plinko-aztec/PlinkoAztecMockHost';
import { lastPayload, recordingGame } from './recordingGame';

/** Ячейка 3 — колесо (`spin`), верх — 50, низ — 0.5. `random: () => 0` кладёт случайный шарик в 50. */
const OPTIONS: Partial<PlinkoAztecMockHostOptions> = {
  slotCoefficients: [50, 4, 0.5, 0, 0.5, 4, 50],
  ballsAmountOptions: [2, 3],
  betPerBallOptions: ['1', '2'],
  bumperChance: 0,
  bonusLevelThreshold: 5,
  bonusSteps: 2,
  bonusBallsPerStep: 2,
  fortuneWheelCoefficient: 2,
  random: () => 0,
};

const createHost = (options: Partial<PlinkoAztecMockHostOptions> = {}) => {
  const host = new PlinkoAztecMockHost({ ...OPTIONS, ...options });
  const game = recordingGame();
  host.attach(game);
  return { host, game };
};

const commandTypes = (received: readonly EngineCommand[]): EngineCommand['type'][] =>
  received.map((command) => command.type);

describe('PlinkoAztecMockHost bet bar', () => {
  it('pushes the selection, the config and the idle state once the game is ready', () => {
    const { host, game } = createHost();

    host.ready();

    expect(game.received.slice(0, 2)).toEqual<EngineCommand[]>([
      { type: 'SetBallsAmount', payload: 2 },
      { type: 'SetBetPerBall', payload: '1' },
    ]);
    expect(commandTypes(game.received.slice(2))).toEqual(['ApplyGameConfig', 'ApplyGameState']);
    expect(lastPayload(game, 'ApplyGameConfig')).toMatchObject({
      ballsAmountOptions: [2, 3],
      betConfig: { currency: 'USD', defaultBetAmount: '1.00' },
      bonusGameProgress: {},
    });
    expect(lastPayload(game, 'ApplyGameState')).toMatchObject({ status: 'none', isFinished: true });
  });

  it('answers the selection requests with the current choice', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestBallsAmount' });
    host.emit({ type: 'RequestBetPerBall' });

    expect(game.received).toEqual<EngineCommand[]>([
      { type: 'SetBallsAmount', payload: 2 },
      { type: 'SetBetPerBall', payload: '1' },
    ]);
  });

  it('steps through the options and stays put at their edge', () => {
    const { host, game } = createHost();

    host.changeBallsAmount(1);
    host.changeBallsAmount(1);
    host.changeBetPerBall(1);
    host.changeBetPerBall(-1);

    expect(game.received).toEqual<EngineCommand[]>([
      { type: 'SetBallsAmount', payload: 3 },
      { type: 'SetBetPerBall', payload: '2' },
      { type: 'SetBetPerBall', payload: '1' },
    ]);
  });
});

describe('PlinkoAztecMockHost drops', () => {
  it('lands every ball in the top slot and pays their sum', () => {
    const { host, game } = createHost();

    host.drop('top');

    const result = lastPayload(game, 'ApplyDropResult');
    expect(result).toMatchObject({
      status: 'win',
      isFinished: true,
      isWin: true,
      coeff: 100,
      winAmount: '100.00',
      betAmount: '2.00',
      ballsAmount: 2,
      betPerBall: '1',
      ballsResult: [
        { position: '50', coeff: '50', bonusBumpAmount: 0 },
        { position: '50', coeff: '50', bonusBumpAmount: 0 },
      ],
    });
    expect(result).not.toHaveProperty('freeSpinResult');
  });

  it('lands every ball in the lowest paying slot on the bottom scenario', () => {
    const { host, game } = createHost();

    host.drop('bottom');

    expect(lastPayload(game, 'ApplyDropResult')).toMatchObject({
      coeff: 1,
      ballsResult: [{ position: '0.5' }, { position: '0.5' }],
    });
  });

  it('spins the fortune wheel and multiplies the win by its sector', () => {
    const { host, game } = createHost();

    host.drop('fortune-wheel');

    expect(lastPayload(game, 'ApplyDropResult')).toMatchObject({
      status: 'win',
      coeff: 50,
      winAmount: '100.00',
      ballsResult: [{ position: 'spin', coeff: '0' }, { position: '50' }],
      freeSpinResult: { position: '2', coeff: '2', winAmount: '100.00' },
    });
  });

  it('holds the next drop until the balls have landed', () => {
    const { host, game } = createHost();

    host.drop();
    host.drop();
    host.emit({ type: 'DropFinished' });
    host.drop();

    expect(game.received.filter((command) => command.type === 'ApplyDropResult')).toHaveLength(2);
  });

  it('refuses a play from the scene while the balls are falling', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'RequestPlay' });

    expect(commandTypes(game.received)).toEqual(['ApplyDropResult', 'DisabledPlayPressed']);
  });
});

describe('PlinkoAztecMockHost bonus game', () => {
  it('starts the bonus game when the wheel stops on its sector', () => {
    const { host, game } = createHost();

    host.drop('bonus-game');

    expect(host.isBonusActive).toBe(true);
    expect(lastPayload(game, 'ApplyDropResult')).toMatchObject({
      status: 'in-game',
      isFinished: false,
      freeSpinResult: { position: 'bonus', coeff: '0', winAmount: '0.00' },
      bonusGameState: {
        result: { gameNumber: 1, level: 1, progress: 0, ballPerDrop: 2, ballsAmount: 2, winAmount: '0.00' },
      },
    });
  });

  it('refuses a play while the bonus game runs', () => {
    const { host, game } = createHost();
    host.drop('bonus-game');
    host.emit({ type: 'DropFinished' });

    host.emit({ type: 'RequestPlay' });

    expect(game.received.at(-1)).toEqual<EngineCommand>({ type: 'DisabledPlayPressed' });
  });

  it('plays a step per tap and hands the round back after the last one', () => {
    const { host, game } = createHost();
    host.drop('bonus-game');

    host.emit({ type: 'RequestStep' });
    const firstStep = lastPayload(game, 'ApplyBonusStepResult');
    host.emit({ type: 'RequestStep' });
    const lastStep = lastPayload(game, 'ApplyBonusStepResult');

    expect(firstStep).toMatchObject({
      status: 'in-game',
      coeff: 100,
      winAmount: '100.00',
      ballsResult: [{ position: '50' }, { position: '50' }],
      bonusGameState: { result: { ballsAmount: 1, winAmount: '100.00' } },
    });
    expect(lastStep).toMatchObject({ status: 'win', isFinished: true });
    expect(lastStep).not.toHaveProperty('bonusGameState.result');
    expect(host.isBonusActive).toBe(false);
  });

  it('ignores a step outside the bonus game', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestStep' });

    expect(game.received).toEqual([]);
  });

  it('raises the bonus level once the bumper hits reach the threshold', () => {
    const { host, game } = createHost({ bumperChance: 1 });
    host.drop('bonus-game');

    host.emit({ type: 'RequestStep' });

    expect(lastPayload(game, 'ApplyBonusStepResult')).toMatchObject({
      bonusGameState: { result: { level: 2, progress: 1, ballPerDrop: 3 } },
    });
  });
});

describe('PlinkoAztecMockHost bumper progress', () => {
  it('counts bumper hits per currency, balls and bet combination', () => {
    const { host, game } = createHost({ bumperChance: 1 });

    host.drop('top');
    host.emit({ type: 'DropFinished' });
    host.changeBetPerBall(1);
    host.drop('top');
    host.emit({ type: 'RequestGameConfig' });

    expect(lastPayload(game, 'ApplyDropResult')).toMatchObject({
      ballsResult: [{ bonusBumpAmount: 3 }, { bonusBumpAmount: 3 }],
      bonusGameState: { progress: { 'USD-2-1': 6, 'USD-2-2': 6 } },
    });
    expect(lastPayload(game, 'ApplyGameConfig')).toMatchObject({
      bonusGameProgress: { 'USD-2-1': 6, 'USD-2-2': 6 },
    });
  });

  it('starts a fresh player on reset: no progress, no bonus game', () => {
    const { host, game } = createHost({ bumperChance: 1 });
    host.drop('bonus-game');

    host.reset();

    expect(host.isBonusActive).toBe(false);
    expect(commandTypes(game.received.slice(-2))).toEqual(['ApplyGameConfig', 'ApplyGameState']);
    expect(lastPayload(game, 'ApplyGameConfig')).toMatchObject({ bonusGameProgress: {} });
    expect(lastPayload(game, 'ApplyGameState')).toMatchObject({ status: 'none' });
  });
});
