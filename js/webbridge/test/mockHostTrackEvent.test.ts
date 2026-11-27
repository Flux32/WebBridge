import type { EngineEvent } from '@omega/webbridge-protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BridgeLogger } from '../src/core/BridgeLogger';
import { DragonPotsMockHost } from '../src/dragon-pots/DragonPotsMockHost';
import { FruitLoveFeverMockHost } from '../src/fruit-love-fever/FruitLoveFeverMockHost';
import { JokerSlotMockHost } from '../src/joker-slot/JokerSlotMockHost';
import { JumperMockHost } from '../src/jumper/JumperMockHost';
import { MineSlotMockHost } from '../src/mine-slot/MineSlotMockHost';
import { MockHost } from '../src/mock/MockHost';
import { PlinkoAztecMockHost } from '../src/plinko-aztec/PlinkoAztecMockHost';
import { PlinkoMockHost } from '../src/plinko/PlinkoMockHost';
import { SlotCoinMockHost } from '../src/slot-coin/SlotCoinMockHost';
import { recordingGame } from './recordingGame';

const hosts: ReadonlyArray<[string, () => { emit(event: EngineEvent): void; attach(game: ReturnType<typeof recordingGame>): void }]> = [
  ['MockHost', () => new MockHost()],
  ['PlinkoMockHost', () => new PlinkoMockHost()],
  ['PlinkoAztecMockHost', () => new PlinkoAztecMockHost()],
  ['JumperMockHost', () => new JumperMockHost()],
  ['MineSlotMockHost', () => new MineSlotMockHost()],
  ['FruitLoveFeverMockHost', () => new FruitLoveFeverMockHost()],
  ['DragonPotsMockHost', () => new DragonPotsMockHost()],
  ['JokerSlotMockHost', () => new JokerSlotMockHost()],
  ['SlotCoinMockHost', () => new SlotCoinMockHost()],
];

describe.each(hosts)('%s TrackEvent', (_name, createHost) => {
  beforeEach(() => {
    BridgeLogger.isEnabled = true;
  });

  afterEach(() => {
    BridgeLogger.isEnabled = false;
    vi.restoreAllMocks();
  });

  it('writes the event to the bridge log and sends nothing back to the game', () => {
    const host = createHost();
    const game = recordingGame();
    host.attach(game);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    host.emit({ type: 'TrackEvent', name: 'level_start', params: { level: '1' } });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toContain('level_start');
    expect(log.mock.calls[0]?.[0]).toContain('"level":"1"');
    expect(game.received).toEqual([]);
  });
});
