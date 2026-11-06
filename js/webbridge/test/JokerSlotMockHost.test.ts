import type { JokerSlotSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { JokerSlotMockHost } from '../src/joker-slot/JokerSlotMockHost';
import { lastPayload, recordingGame } from './recordingGame';

const createHost = () => {
  const host = new JokerSlotMockHost({ bet: 0.1 });
  const game = recordingGame();
  host.attach(game);
  return { host, game };
};

const countOf = (game: ReturnType<typeof recordingGame>, type: string): number =>
  game.received.filter((command) => command.type === type).length;

const lastSpin = (game: ReturnType<typeof recordingGame>): JokerSlotSpinResult => lastPayload(game, 'ApplySpinResult') as JokerSlotSpinResult;

/** Presses a key on a fresh target the host listens to. */
const press = (host: JokerSlotMockHost, code: string): void => {
  const target = new EventTarget();
  host.bindKeys(target);
  target.dispatchEvent(Object.assign(new Event('keydown'), { code }));
};

describe('JokerSlotMockHost', () => {
  it('answers a play with the whole round in one reply on a 3 x 4 board', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });

    const spin = lastSpin(game);
    expect(spin.isFinished).toBe(true);
    expect(spin.boards[0]).toHaveLength(12);
  });

  it('refuses the next play until the game reports the round played', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'RequestPlay' });
    host.buyBonus('x200');
    expect(countOf(game, 'ApplySpinResult')).toBe(1);
    expect(game.received.at(-1)?.type).toBe('DisabledPlayPressed');

    host.emit({ type: 'SpinReady' });
    host.emit({ type: 'RequestPlay' });
    expect(countOf(game, 'ApplySpinResult')).toBe(2);
  });

  it('sells a bonus at its full price and plays its run in the same reply', () => {
    const { host, game } = createHost();

    host.buyBonus('x75');

    const spin = lastSpin(game);
    expect(spin.betAmount).toBe('7.50');
    expect(spin.rounds).toBe(spin.boards.length);
    expect(spin.rounds).toBeGreaterThan(1);
  });

  it('answers the state with an idle round and the config with the buy multipliers', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestGameState' });
    host.emit({ type: 'RequestGameConfig' });

    expect(lastPayload(game, 'ApplyGameState')).toEqual({ status: 'none' });
    expect(lastPayload(game, 'ApplyGameConfig')).toMatchObject({ bonusBuyMultiplier: { x75: 75, x200: 200 } });
  });

  it('forces features and buys from the keyboard', () => {
    const { host, game } = createHost();

    press(host, 'KeyS');
    expect(lastSpin(game).actions[0]!.map((action) => action.action)).toContain('SUPER_STRIKE_COINS_ADDED');
    host.emit({ type: 'SpinReady' });

    press(host, 'KeyZ');
    expect(lastSpin(game).betAmount).toBe('20.00');
    host.emit({ type: 'SpinReady' });

    press(host, 'KeyF');
    expect(game.received.at(-1)).toEqual({ type: 'SetFastGame', payload: true });
  });
});
