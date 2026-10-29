import { FruitLoveFeverBridge } from '@omega/webbridge-js';
import { describe, expect, it } from 'vitest';
import { FruitLoveFeverController, type FruitLoveFeverMotions } from '../src/modes/fruit-love-fever/FruitLoveFeverController';
import { recorded, recordedWith, twoSpinBonus } from './fruitLoveFeverFixtures';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const setup = (overrides: Partial<FruitLoveFeverMotions> = {}) => {
  const transport = recordingTransport();
  const bridge = new FruitLoveFeverBridge(transport);
  const motions = manualMotions();
  const locks: number[][] = [];
  const placed: number[] = [];
  let celebrations = 0;
  const controller: FruitLoveFeverController = new FruitLoveFeverController(bridge, {
    spin: (plan, locked) => {
      locks.push([...locked]);
      return motions.play(`spin:${plan.bonus?.played ?? 'base'}`);
    },
    place: (plan) => void placed.push(plan.bonus?.played ?? -1),
    showLines: (plan) => motions.play(`lines:${plan.lines.length}`),
    bonusIntro: (bonus) => motions.play(`intro:${bonus.total}`),
    bonusOutro: (totalWin) => motions.play(`outro:${totalWin}`),
    celebrate: () => void (celebrations += 1),
    ...overrides,
  });
  return { transport, bridge, motions, controller, locks, placed, celebrations: () => celebrations };
};

type Setup = ReturnType<typeof setup>;

const send = (bridge: FruitLoveFeverBridge, type: 'ApplySpinResult' | 'ApplyBonusStepResult' | 'ApplyGameState', reply: unknown): void =>
  bridge.receive({ type, payload: JSON.stringify(reply) });

/** Finishes motions one at a time, recording each with the events the host had heard before it finished. */
const playOneByOne = async ({ motions, transport }: Setup): Promise<string[]> => {
  const played: string[] = [];
  await settle();
  while (motions.pending.length > 0) {
    const [motion] = motions.pending.splice(0);
    played.push(`${motion?.name} [${eventTypes(transport).join(',')}]`);
    motion?.finish();
    await settle();
  }
  return played;
};

describe('FruitLoveFeverController', () => {
  it('reports a plain spin only after the reels stopped and its lines were shown', async () => {
    const context = setup();
    send(context.bridge, 'ApplySpinResult', recorded('play-win'));

    expect(await playOneByOne(context)).toEqual(['spin:base []', 'lines:2 []']);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
    expect(context.controller.lastResult).toBe('Won 1.25 USD');
    expect(context.celebrations()).toBe(1);
  });

  it('reports a lost spin once the reels stopped, with no lines to show', async () => {
    const context = setup();
    send(context.bridge, 'ApplySpinResult', recorded('play-lose'));

    expect(await playOneByOne(context)).toEqual(['spin:base []']);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
    expect(context.controller.lastResult).toBe('No win');
  });

  it('plays a bonus free spin by free spin, asking for each, and sends one SpinReady after the total', async () => {
    const context = setup();
    const bonus = twoSpinBonus();
    send(context.bridge, 'ApplySpinResult', bonus.play);
    await playOneByOne(context);
    expect(eventTypes(context.transport)).toEqual(['RequestStep']);

    send(context.bridge, 'ApplyBonusStepResult', bonus.first);
    const first = await playOneByOne(context);
    send(context.bridge, 'ApplyBonusStepResult', bonus.last);
    const last = await playOneByOne(context);

    expect(first).toEqual(['spin:1 [RequestStep]', 'lines:4 [RequestStep]']);
    expect(last).toEqual(['spin:2 [RequestStep,RequestStep]', 'lines:7 [RequestStep,RequestStep]', 'outro:14.8 [RequestStep,RequestStep]']);
    expect(eventTypes(context.transport)).toEqual(['RequestStep', 'RequestStep', 'SpinReady']);
  });

  it('plays the bonus intro before asking for the first free spin', async () => {
    const context = setup();
    send(context.bridge, 'ApplySpinResult', twoSpinBonus().play);

    expect(await playOneByOne(context)).toEqual(['spin:0 []', 'intro:2 []']);
  });

  it('locks the wilds of a free spin in their cells for the rest of the bonus', async () => {
    const context = setup();
    const bonus = twoSpinBonus();
    send(context.bridge, 'ApplySpinResult', bonus.play);
    await context.motions.finishAll();
    send(context.bridge, 'ApplyBonusStepResult', bonus.first);
    await context.motions.finishAll();
    send(context.bridge, 'ApplyBonusStepResult', bonus.last);
    await context.motions.finishAll();

    // Reel 3 row 1 (cell 7) landed a wild in the first free spin; the second spun around it.
    expect(context.locks).toEqual([[], [], [7]]);
    expect([...context.controller.stickyCells].sort((a, b) => a - b)).toEqual([4, 6, 7]);
  });

  it('resumes an unfinished bonus from the game state: board in place, its wilds locked, next free spin asked', async () => {
    const context = setup();
    send(context.bridge, 'ApplyGameState', recorded('state-mid-bonus'));
    await settle();

    expect(context.placed).toEqual([3]);
    expect([...context.controller.stickyCells]).toEqual([3, 6]);
    expect(context.controller.bonus).toEqual({ played: 3, total: 10 });
    expect(eventTypes(context.transport)).toEqual(['RequestStep']);
  });

  it('locks nothing when the resumed bonus has not played a free spin yet', async () => {
    const context = setup();
    send(context.bridge, 'ApplyGameState', recorded('play-buy-x75'));
    await settle();

    expect(context.controller.stickyCells.size).toBe(0);
    expect(eventTypes(context.transport)).toEqual(['RequestStep']);
  });

  it('asks for the free spin again when the game state arrives while it waits for one', async () => {
    const context = setup();
    send(context.bridge, 'ApplyGameState', recorded('state-mid-bonus'));
    await settle();

    send(context.bridge, 'ApplyGameState', recorded('state-mid-bonus'));

    expect(eventTypes(context.transport)).toEqual(['RequestStep', 'RequestStep']);
    expect(context.placed).toEqual([3]);
  });

  it('plays a game state ahead of the last free spin as the step reply it missed, then asks for the next', async () => {
    const context = setup();
    const bonus = twoSpinBonus();
    send(context.bridge, 'ApplySpinResult', bonus.play);
    await context.motions.finishAll();

    // The reply to the first RequestStep was lost; the reconnect state is that free spin.
    send(context.bridge, 'ApplyGameState', bonus.first);
    const played = await playOneByOne(context);

    expect(played).toEqual(['spin:1 [RequestStep]', 'lines:4 [RequestStep]']);
    expect(context.controller.bonus).toEqual({ played: 1, total: 2 });
    expect(eventTypes(context.transport)).toEqual(['RequestStep', 'RequestStep']);
  });

  it('ends the round with a missed step that finishes the bonus', async () => {
    const context = setup();
    const bonus = twoSpinBonus();
    send(context.bridge, 'ApplySpinResult', bonus.play);
    await context.motions.finishAll();
    send(context.bridge, 'ApplyBonusStepResult', bonus.first);
    await context.motions.finishAll();

    send(context.bridge, 'ApplyGameState', bonus.last);
    await context.motions.finishAll();

    expect(eventTypes(context.transport)).toEqual(['RequestStep', 'RequestStep', 'SpinReady']);
    expect(context.controller.phase).toBe('idle');
  });

  it('closes the bonus with one SpinReady when the round ended on the server while the step reply was lost', async () => {
    const context = setup();
    send(context.bridge, 'ApplySpinResult', twoSpinBonus().play);
    await context.motions.finishAll();

    send(context.bridge, 'ApplyGameState', { status: 'none' });
    await context.motions.finishAll();
    send(context.bridge, 'ApplyGameState', { status: 'none' });
    await settle();

    expect(eventTypes(context.transport)).toEqual(['RequestStep', 'SpinReady']);
    expect(context.controller.phase).toBe('idle');
    expect(context.motions.pending).toEqual([]);
  });

  it('has nothing to resume from a session without a round', async () => {
    const context = setup();
    send(context.bridge, 'ApplyGameState', { status: 'none' });
    await settle();

    expect(context.placed).toEqual([]);
    expect(eventTypes(context.transport)).toEqual([]);
  });

  it('does not resume a round the scene is already playing', async () => {
    const context = setup();
    send(context.bridge, 'ApplySpinResult', twoSpinBonus().play);
    send(context.bridge, 'ApplyGameState', recorded('play-scatter'));
    await settle();

    expect(context.placed).toEqual([]);
  });

  it('does not play a free spin nobody asked for', async () => {
    const context = setup();
    send(context.bridge, 'ApplyBonusStepResult', recorded('step-1'));
    await settle();

    expect(context.motions.pending).toEqual([]);
  });

  it('shows a broken reply instead of playing it, and keeps the bar locked', async () => {
    const context = setup();
    send(context.bridge, 'ApplySpinResult', recordedWith('play-win', { slot: { reelsCells: {}, winLines: [] } }));
    await context.motions.finishAll();

    expect(context.controller.phase).toBe('broken');
    expect(context.controller.lastResult).toContain('reelsCells.1');
    expect(eventTypes(context.transport)).toEqual([]);
  });

  it('breaks the round when a free spin loses a sticky wild', async () => {
    const context = setup();
    const bonus = twoSpinBonus();
    send(context.bridge, 'ApplySpinResult', bonus.play);
    await context.motions.finishAll();
    send(context.bridge, 'ApplyBonusStepResult', bonus.first);
    await context.motions.finishAll();
    send(context.bridge, 'ApplyBonusStepResult', recordedWith('play-lose', { isFinished: true, bonusGame: { currentGameNumber: 2, totalFreeSpinsAmount: 2, coeff: '0', winAmount: '0' } }));
    await context.motions.finishAll();

    expect(context.controller.phase).toBe('broken');
    expect(eventTypes(context.transport)).toEqual(['RequestStep', 'RequestStep']);
  });

  it('sends nothing once a motion was cut short', async () => {
    const context = setup({ showLines: () => Promise.resolve(false) });
    send(context.bridge, 'ApplySpinResult', recorded('play-win'));
    await context.motions.finishAll();

    expect(eventTypes(context.transport)).toEqual([]);
  });

  it('stops waiting for a free spin once destroyed', async () => {
    const context = setup();
    send(context.bridge, 'ApplyGameState', recorded('state-mid-bonus'));
    await settle();

    context.controller.destroy();
    send(context.bridge, 'ApplyBonusStepResult', recorded('step-1'));
    await context.motions.finishAll();

    expect(eventTypes(context.transport)).toEqual(['RequestStep']);
  });

  it('follows the host fast-game switch', () => {
    const context = setup();

    context.bridge.receive({ type: 'SetFastGame', payload: true });

    expect(context.controller.isFastGame).toBe(true);
  });
});
