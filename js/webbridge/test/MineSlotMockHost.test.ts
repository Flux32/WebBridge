import { describe, expect, it } from 'vitest';
import { MineSlotMockHost } from '../src/mine-slot/MineSlotMockHost';
import { lastPayload, recordingGame } from './recordingGame';

const createHost = () => {
  const host = new MineSlotMockHost();
  const game = recordingGame();
  host.attach(game);
  return { host, game };
};

const spinsOf = (game: ReturnType<typeof recordingGame>) =>
  game.received.filter((command) => command.type === 'ApplySpinResult');

describe('MineSlotMockHost', () => {
  it('answers a play with a reply in the backend alphabet', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });

    const spin = lastPayload(game, 'ApplySpinResult') as { boards: string[]; field: string; rounds: number };
    expect(spin.rounds).toBe(1);
    expect(spin.boards[0]).toMatch(/^[x1235deb]{15}$/);
    expect(spin.field).toMatch(/^[dsrgco]{30}$/);
  });

  it('refuses the next play until the game reports the round played', () => {
    const { host, game } = createHost();

    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'RequestPlay' });
    expect(spinsOf(game)).toHaveLength(1);
    expect(game.received.at(-1)?.type).toBe('DisabledPlayPressed');

    host.emit({ type: 'SpinReady' });
    host.emit({ type: 'RequestPlay' });
    expect(spinsOf(game)).toHaveLength(2);
  });

  it('sells a bonus game as the base spin plus four free spins in one reply', () => {
    const { host, game } = createHost();

    host.buyBonus();

    const spin = lastPayload(game, 'ApplySpinResult') as { boards: string[]; rounds: number };
    expect(spin.rounds).toBe(5);
    expect(spin.boards).toHaveLength(5);
    expect([...(spin.boards[0] ?? '')].filter((symbol) => symbol === 'b').length).toBeGreaterThanOrEqual(3);
  });
});
