import { JokerSlotBridge, JokerSlotMockHost, type JokerSlotMockOutcome } from '@omega/webbridge-js';
import { describe, expect, it } from 'vitest';
import { JokerSlotController, type JokerSlotMotions } from '../src/modes/joker-slot/JokerSlotController';
import { recorded } from './jokerSlotFixtures';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const setup = (overrides: Partial<JokerSlotMotions> = {}) => {
  const transport = recordingTransport();
  const bridge = new JokerSlotBridge(transport);
  const motions = manualMotions();
  let celebrations = 0;
  const controller = new JokerSlotController(bridge, {
    spin: () => motions.play('spin'),
    showLine: () => motions.play('line'),
    place: (symbols) => motions.play(`place:${symbols.length}`),
    swapBoard: () => motions.play('bonus-board'),
    collect: (collection) => motions.play(`collect:${collection.triggerIndex}`),
    boost: (_, multiplier) => motions.play(`boost:${multiplier}`),
    celebrate: () => void (celebrations += 1),
    ...overrides,
  });
  return { transport, bridge, motions, controller, celebrations: () => celebrations };
};

type Setup = ReturnType<typeof setup>;

const play = (bridge: JokerSlotBridge, reply: unknown): void => bridge.receive({ type: 'ApplySpinResult', payload: JSON.stringify(reply) });

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

describe('JokerSlotController', () => {
  it('reports a lost spin once the reels stopped', async () => {
    const context = setup();
    play(context.bridge, recorded('play-lose'));

    expect(await playOneByOne(context)).toEqual(['spin']);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
    expect(context.celebrations()).toBe(0);
  });

  it('lights the paylines and counts them into the win', async () => {
    const context = setup();
    play(context.bridge, recorded('play-win-lines'));

    expect(await playOneByOne(context)).toEqual(['spin', 'line', 'line']);
    expect(context.controller.total).toBe(2);
    expect(context.controller.lastResult).toBe('Won 2.00 USD');
    expect(context.celebrations()).toBe(1);
  });

  it('lets the Super Joker add its coins and then collect them', async () => {
    const context = setup();
    play(context.bridge, recorded('play-super-strike'));

    expect(await playOneByOne(context)).toEqual(['spin', 'place:2', 'collect:6']);
    expect(context.controller.total).toBe(3);
  });

  it('plays every board of a bought bonus before the one SpinReady', async () => {
    const context = setup();
    play(context.bridge, recorded('play-buy-x200-2'));

    const played = await playOneByOne(context);

    expect(played.slice(0, 5)).toEqual(['spin', 'place:2', 'place:3', 'bonus-board', 'collect:6']);
    expect(played.filter((name) => name === 'spin')).toHaveLength(14);
    expect(played.slice(0, -1).every((name) => !name.includes('SpinReady'))).toBe(true);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
    expect(context.controller.total).toBe(202);
    expect(context.controller.lastResult).toBe('Won 202.00 USD');
    expect(context.controller.spinsLeft).toBeNull();
  });

  it('shows the spins left on each bonus board', async () => {
    const left: (number | null)[] = [];
    const spun = manualMotions();
    const context: Setup = setup({
      spin: () => {
        left.push(context.controller.spinsLeft);
        return spun.play('spin');
      },
    });
    play(context.bridge, recorded('play-bonus'));
    while (spun.pending.length + context.motions.pending.length > 0 || left.length === 0) {
      await spun.finishAll();
      await context.motions.finishAll();
    }

    expect(left).toEqual([null, 3, 3, 3, 3, 2, 3, 2, 1, 3, 3, 2, 1]);
  });

  it('plays a second round only after the first one is reported', async () => {
    const { transport, bridge, motions } = setup();
    play(bridge, recorded('play-lose'));
    play(bridge, recorded('play-lose'));
    await settle();
    expect(motions.pending).toHaveLength(1);

    motions.pending.splice(0).forEach((motion) => motion.finish());
    await settle();
    expect(eventTypes(transport)).toEqual(['SpinReady']);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady', 'SpinReady']);
  });

  it('sends nothing once a motion was cut short', async () => {
    const { transport, bridge } = setup({ spin: () => Promise.resolve(false) });
    play(bridge, recorded('play-coins'));
    await settle();
    expect(eventTypes(transport)).toEqual([]);
  });

  it('shows a broken round instead of playing it, and keeps the bar locked', async () => {
    const { transport, bridge, motions, controller } = setup();
    play(bridge, { ...recorded('play-lose'), boards: ['12z'] });
    await motions.finishAll();

    expect(controller.phase).toBe('broken');
    expect(controller.lastResult).toContain('board');
    expect(eventTypes(transport)).toEqual([]);
  });

  it.each<JokerSlotMockOutcome | 'x75' | 'x200'>(['lines', 'collect', 'superJoker', 'bonus', 'x75', 'x200'])(
    'plays the mock host’s %s round through to one SpinReady',
    async (choice) => {
      const { transport, bridge, motions } = setup();
      const host = new JokerSlotMockHost();
      host.attach({ receive: (command) => bridge.receive(command), destroy: () => {} });

      if (choice === 'x75' || choice === 'x200') host.buyBonus(choice);
      else host.spin(choice);
      await motions.finishAll();

      expect(eventTypes(transport)).toEqual(['SpinReady']);
    },
  );
});
