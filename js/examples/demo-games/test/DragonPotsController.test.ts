import { DragonPotsBridge, DragonPotsMockHost, type DragonPotsMockOutcome } from '@omega/webbridge-js';
import { describe, expect, it } from 'vitest';
import { DragonPotsController, type DragonPotsMotions } from '../src/modes/dragon-pots/DragonPotsController';
import { recorded, recordedWith } from './dragonPotsFixtures';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const setup = (overrides: Partial<DragonPotsMotions> = {}) => {
  const transport = recordingTransport();
  const bridge = new DragonPotsBridge(transport);
  const motions = manualMotions();
  const wins: number[] = [];
  let celebrations = 0;
  const controller: DragonPotsController = new DragonPotsController(bridge, {
    spin: () => motions.play('spin'),
    showWays: (ways) => motions.play(`ways:${ways.length}`),
    dropCoins: (coins) => motions.play(`coins:${coins.length}`),
    burstPots: (pots) => motions.play(`burst:${pots.join('+')}`),
    openJackpot: () => motions.play('jackpot'),
    revealTile: (index) => motions.play(`tile:${index}`),
    winJackpot: (jackpot) => motions.play(`jackpot-won:${jackpot.coeff}`),
    openHoldAndWin: (plan) => motions.play(`hold-and-win:${plan.boardSize}`),
    respin: () => motions.play('respin'),
    landCoin: () => {
      wins.push(controller.win);
      return motions.play('coin');
    },
    closeHoldAndWin: (winAmount) => motions.play(`hold-and-win-pays:${winAmount}`),
    showTotal: (totalWin) => motions.play(`total:${totalWin}`),
    celebrate: () => void (celebrations += 1),
    ...overrides,
  });
  return { transport, bridge, motions, controller, wins, celebrations: () => celebrations };
};

type Setup = ReturnType<typeof setup>;

const play = (bridge: DragonPotsBridge, reply: unknown): void => bridge.receive({ type: 'ApplySpinResult', payload: JSON.stringify(reply) });

/** Finishes motions one at a time, recording each with the events the host had heard before it finished. */
const playOneByOne = async ({ motions, transport }: Setup): Promise<string[]> => {
  const played: string[] = [];
  await settle();
  while (motions.pending.length > 0) {
    const [motion] = motions.pending.splice(0);
    played.push(`${motion?.name}${transport.sent.length > 0 ? ` [${eventTypes(transport).join(',')}]` : ''}`);
    motion?.finish();
    await settle();
  }
  return played;
};

/** The motion names without the repeated respins and coins: the order of the phases. */
const phasesOf = (played: readonly string[]): string[] => played.filter((name, index) => name !== played[index - 1]);

describe('DragonPotsController', () => {
  it('reports a lost spin once the reels stopped', async () => {
    const context = setup();
    play(context.bridge, recorded('play-lose'));

    expect(await playOneByOne(context)).toEqual(['spin']);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
    expect(context.controller.lastResult).toBe('No win');
  });

  it('pays the ways and flies a coin that triggers nothing, then reports the round', async () => {
    const context = setup();
    play(context.bridge, recorded('play-win'));

    expect(await playOneByOne(context)).toEqual(['spin', 'ways:1', 'coins:1']);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
    expect(context.controller.lastResult).toBe('Won 0.05 USD');
    expect(context.celebrations()).toBe(1);
  });

  it('plays a Mighty: the pot bursts, Hold & Win plays try by try, one SpinReady after the total', async () => {
    const context = setup();
    play(context.bridge, recorded('play-mighty'));

    const played = await playOneByOne(context);

    expect(phasesOf(played)).toEqual([
      'spin',
      'ways:1',
      'coins:2',
      'burst:Blue',
      'hold-and-win:3x5',
      'respin',
      'coin',
      'respin',
      'coin',
      'respin',
      'coin',
      'respin',
      'hold-and-win-pays:5',
      'total:5.08',
    ]);
    // Spin 1 lands 4 coins on its third try, spin 2 one coin on its first, spin 3 one on its third, spin 4 three empty tries.
    expect(played.filter((name) => name === 'respin')).toHaveLength(3 + 1 + 3 + 3);
    expect(played.filter((name) => name === 'coin')).toHaveLength(6);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
  });

  it('runs the win up coin by coin from the base win to the round total', async () => {
    const context = setup();
    play(context.bridge, recorded('play-mighty'));
    await context.motions.finishAll();

    // Base 0.08 plus each coin's running Hold & Win total; the round shows the server's top-level win.
    expect(context.wins.map((win) => Number(win.toFixed(3)))).toEqual([0.53, 1.18, 1.905, 2.68, 3.855, 5.08]);
    expect(context.controller.win).toBe(5.08);
  });

  it('plays the jackpot pick tile by tile and pays the won tier', async () => {
    const context = setup();
    play(context.bridge, recorded('play-jackpot'));

    expect(await playOneByOne(context)).toEqual([
      'spin',
      'coins:2',
      'burst:Red',
      'jackpot',
      'tile:0',
      'tile:1',
      'tile:2',
      'tile:3',
      'tile:4',
      'tile:5',
      'jackpot-won:20',
      'total:2',
    ]);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
  });

  it('plays the jackpot pick before the Hold & Win in an Ultimate', async () => {
    const context = setup();
    play(context.bridge, recorded('play-ultimate'));

    const phases = phasesOf(await playOneByOne(context));

    expect(phases.slice(0, 4)).toEqual(['spin', 'coins:3', 'burst:Red+Blue+Green', 'jackpot']);
    expect(phases.indexOf('jackpot-won:20')).toBeLessThan(phases.indexOf('hold-and-win:5x5'));
    expect(phases.at(-1)).toBe('total:7.02');
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
  });

  it('plays a bought bonus as a Hold & Win with the bought pot, one SpinReady and the server total', async () => {
    const context = setup();
    play(context.bridge, recorded('play-buy-mighty'));

    const phases = phasesOf(await playOneByOne(context));

    expect(phases.slice(0, 4)).toEqual(['spin', 'coins:1', 'burst:Blue', 'hold-and-win:3x5']);
    expect(phases.slice(-2)).toEqual(['hold-and-win-pays:2.91', 'total:2.9']);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
    expect(context.controller.lastResult).toBe('Won 2.90 USD');
  });

  it('plays two replies one after the other, each with its own SpinReady', async () => {
    const context = setup();
    play(context.bridge, recorded('play-win'));
    play(context.bridge, recorded('play-lose'));

    expect(await playOneByOne(context)).toEqual(['spin', 'ways:1', 'coins:1', 'spin [SpinReady]']);
    expect(eventTypes(context.transport)).toEqual(['SpinReady', 'SpinReady']);
  });

  it('fills the pots coin by coin and empties the ones that burst', async () => {
    const context = setup();
    play(context.bridge, recorded('play-lose-coins'));
    play(context.bridge, recorded('play-mighty'));
    await context.motions.finishAll();

    expect(context.controller.pots).toEqual({ Red: 1, Green: 1, Blue: 0 });
  });

  it('has nothing to resume from the always empty game state', async () => {
    const context = setup();
    context.bridge.receive({ type: 'ApplyGameState', payload: '{}' });
    await settle();

    expect(context.motions.pending).toEqual([]);
    expect(eventTypes(context.transport)).toEqual([]);
  });

  it('shows a broken reply instead of playing it, and keeps the bar locked', async () => {
    const context = setup();
    play(context.bridge, recordedWith('play-mighty', { coins: [] }));
    await context.motions.finishAll();

    expect(context.controller.phase).toBe('broken');
    expect(context.controller.lastResult).toContain('coin cells');
    expect(eventTypes(context.transport)).toEqual([]);
  });

  it('sends nothing once a motion was cut short', async () => {
    const context = setup({ landCoin: () => Promise.resolve(false) });
    play(context.bridge, recorded('play-mighty'));
    await context.motions.finishAll();

    expect(eventTypes(context.transport)).toEqual([]);
  });

  it('plays every outcome and every buy the mock host deals, each round with one SpinReady', async () => {
    const motions = manualMotions();
    const host = new DragonPotsMockHost({ bet: 0.1 });
    /** 'reply' per ApplySpinResult the scene got, 'ready' per SpinReady it sent. */
    const exchange: string[] = [];
    const bridge = new DragonPotsBridge({
      send: (event) => {
        if (event.type === 'SpinReady') exchange.push('ready');
        host.emit(event);
      },
    });
    host.attach({ receive: (command) => bridge.receive(command), destroy: () => undefined });
    bridge.spinResultReceived.add(() => exchange.push('reply'));
    const controller = new DragonPotsController(bridge, {
      spin: () => motions.play('spin'),
      showWays: () => motions.play('ways'),
      dropCoins: () => motions.play('coins'),
      burstPots: () => motions.play('burst'),
      openJackpot: () => motions.play('jackpot'),
      revealTile: () => motions.play('tile'),
      winJackpot: () => motions.play('jackpot-won'),
      openHoldAndWin: () => motions.play('hold-and-win'),
      respin: () => motions.play('respin'),
      landCoin: () => motions.play('coin'),
      closeHoldAndWin: () => motions.play('hold-and-win-pays'),
      showTotal: () => motions.play('total'),
      celebrate: () => undefined,
    });
    const outcomes: DragonPotsMockOutcome[] = ['Mighty', 'Mega', 'Super', 'Jackpot', 'Ultra', 'Supreme', 'Ultimate', 'Lose'];

    for (const outcome of outcomes) {
      host.spin(outcome);
      await motions.finishAll();
      expect(controller.phase).toBe('idle');
    }
    for (const buy of ['Mighty', 'Mega', 'Super'] as const) {
      host.buyBonus(buy);
      await motions.finishAll();
      expect(controller.phase).toBe('idle');
    }
    host.spin();
    await motions.finishAll();

    expect(exchange).toEqual(Array.from({ length: 12 }, () => ['reply', 'ready']).flat());
  });

  it('follows the host fast-game switch', () => {
    const context = setup();

    context.bridge.receive({ type: 'SetFastGame', payload: true });

    expect(context.controller.isFastGame).toBe(true);
  });
});
