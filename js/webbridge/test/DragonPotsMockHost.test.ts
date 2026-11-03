import type { DragonPotsSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { DragonPotsMockHost } from '../src/dragon-pots/DragonPotsMockHost';
import { lastPayload, recordingGame } from './recordingGame';

const createHost = () => {
  const host = new DragonPotsMockHost({ bet: 0.1 });
  const game = recordingGame();
  host.attach(game);
  return { host, game };
};

const countOf = (game: ReturnType<typeof recordingGame>, type: string): number =>
  game.received.filter((command) => command.type === type).length;

const lastSpin = (game: ReturnType<typeof recordingGame>): DragonPotsSpinResult => lastPayload(game, 'ApplySpinResult') as DragonPotsSpinResult;

/** Presses a key on a fresh target the host listens to. */
const press = (host: DragonPotsMockHost, code: string): void => {
  const target = new EventTarget();
  host.bindKeys(target);
  target.dispatchEvent(Object.assign(new Event('keydown'), { code }));
};

describe('DragonPotsMockHost', () => {
  it('answers a play with the whole round in one reply on a 3 x 5 matrix', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });

    const spin = lastSpin(game);
    expect(spin.isFinished).toBe(true);
    expect(spin.roundResult.mainGameResult.matrix.map((row) => row.length)).toEqual([5, 5, 5]);
  });

  it('refuses the next play until the game reports the round played', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'RequestPlay' });
    host.buyBonus('Super');
    expect(countOf(game, 'ApplySpinResult')).toBe(1);
    expect(game.received.at(-1)?.type).toBe('DisabledPlayPressed');

    host.emit({ type: 'SpinReady' });
    host.emit({ type: 'RequestPlay' });
    expect(countOf(game, 'ApplySpinResult')).toBe(2);
  });

  it('sells a Hold & Win at its full price', () => {
    const { host, game } = createHost();

    host.buyBonus('Mega');

    const spin = lastSpin(game);
    expect(spin.betAmount).toBe('5.50');
    expect(spin.roundResult.holdAndWinResult?.boardSize).toBe('4x5');
    expect(spin.roundResult.bonusTypeName).toBe('');
  });

  it('forces what the pots trigger by the digit keys: the bonus type index plus one', () => {
    const { host, game } = createHost();

    press(host, 'Digit6');
    const supreme = lastSpin(game);
    host.emit({ type: 'SpinReady' });
    press(host, 'Digit4');

    expect([supreme.roundResult.bonusTypeName, supreme.roundResult.bonusTypeIndex]).toEqual(['Supreme', 5]);
    expect(lastSpin(game).roundResult.bonusTypeName).toBe('Jackpot');
  });

  it('buys by the B / N / M keys', () => {
    const { host, game } = createHost();

    press(host, 'KeyM');

    expect(lastSpin(game).roundResult.holdAndWinResult?.boardSize).toBe('5x5');
  });

  it('answers the game state with {} — a round never outlives its reply', () => {
    const { host, game } = createHost();
    host.emit({ type: 'RequestPlay' });

    host.emit({ type: 'RequestGameState' });

    expect(lastPayload(game, 'ApplyGameState')).toEqual({});
  });

  it('serves the stage config: limits and currency, no bonus prices', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestGameConfig' });

    expect(lastPayload(game, 'ApplyGameConfig')).toMatchObject({ betConfig: { minBetAmount: '0.10' }, currency: { code: 'USD' } });
  });

  it('switches the fast game as the bet bar does and reports it when asked', () => {
    const { host, game } = createHost();

    host.toggleFastGame();
    host.emit({ type: 'RequestFastGame' });

    expect(game.received.filter((command) => command.type === 'SetFastGame')).toEqual([
      { type: 'SetFastGame', payload: true },
      { type: 'SetFastGame', payload: true },
    ]);
  });
});
