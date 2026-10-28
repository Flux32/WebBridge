import { MineSlotBridge } from '@omega/webbridge-js';
import type { MineSlotSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { MineSlotController, type MineSlotMotions } from '../src/modes/mine-slot/MineSlotController';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

/** A wooden pickaxe on top of reel 0, a dynamite in the middle of reel 1. */
const BOARD = '1xx' + 'xdx' + 'xxx' + 'xxx' + 'xxx';
const PLAIN = 'xxx'.repeat(5);
/** Column 0: stone on top (durability 2), dirt under it; the rest gold. */
const FIELD = 'sddddd' + 'g'.repeat(24);

const dig = (round: number, ...blocks: { index: number; damage: number; coeff?: number }[]) => ({ round, index: 0, brokenBlocks: blocks });

const reply = (overrides: Partial<MineSlotSpinResult> = {}): string =>
  JSON.stringify({
    status: 'win', betAmount: '1.00', currency: 'USD', coeff: 0.1, isFinished: true, isWin: true, winAmount: '0.10',
    rounds: 1, boards: [BOARD], field: FIELD, pickaxes: [dig(0, { index: 0, damage: 1 })], tnt: [], chests: [],
    ...overrides,
  } satisfies MineSlotSpinResult);

/** Base spin plus two free spins: the free spins finish the stone the base spin cracked, then dig on. */
const BONUS = reply({
  rounds: 3,
  boards: [BOARD, BOARD, BOARD],
  pickaxes: [dig(0, { index: 0, damage: 1 }), dig(1, { index: 0, damage: 1, coeff: 0.1 }, { index: 1, damage: 1 }), dig(2)],
  tnt: [{ round: 1, index: 4, brokenBlocks: [{ index: 6, damage: 2 }] }],
});

const setup = (overrides: Partial<MineSlotMotions> = {}) => {
  const transport = recordingTransport();
  const bridge = new MineSlotBridge(transport);
  const motions = manualMotions();
  let celebrations = 0;
  const controller: MineSlotController = new MineSlotController(bridge, {
    spin: () => motions.play(`spin:${controller.roundNumber}`),
    strike: (strike, hits) => motions.play(`${strike.kind}:${controller.roundNumber}:${hits.map((hit) => hit.cell).join(',')}`),
    shatter: (broken) => motions.play(`shatter:${broken.map((hit) => hit.cell).join(',')}`),
    retire: () => motions.play('retire'),
    openChest: (chest) => motions.play(`chest:${chest.column}`),
    celebrate: () => void (celebrations += 1),
    ...overrides,
  });
  return { transport, bridge, motions, controller, celebrations: () => celebrations };
};

/** Finishes motions one at a time and records their order, checking the host hears nothing meanwhile. */
const playOneByOne = async ({ motions, transport }: ReturnType<typeof setup>): Promise<string[]> => {
  const played: string[] = [];
  await settle();
  while (motions.pending.length > 0) {
    expect(eventTypes(transport)).toEqual([]);
    const [motion] = motions.pending.splice(0);
    played.push(motion?.name ?? '');
    motion?.finish();
    await settle();
  }
  return played;
};

describe('MineSlotController', () => {
  it('reports the spin only once the reels have stopped and the pickaxe has struck', async () => {
    const { transport, bridge, motions } = setup();

    bridge.receive({ type: 'ApplySpinResult', payload: reply() });
    await settle();
    expect(motions.pending.map((motion) => motion.name)).toEqual(['spin:1']);
    expect(eventTypes(transport)).toEqual([]);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady']);
  });

  it('plays every free spin in order on the same field before the one SpinReady', async () => {
    const context = setup();
    context.bridge.receive({ type: 'ApplySpinResult', payload: BONUS });

    const played = await playOneByOne(context);

    expect(played).toEqual([
      'spin:1', 'pickaxe:1:0', 'retire',
      'spin:2', 'pickaxe:2:0', 'shatter:0', 'pickaxe:2:1', 'shatter:1', 'retire', 'dynamite:2:6', 'retire',
      'spin:3', 'pickaxe:3:', 'retire',
    ]);
    expect(eventTypes(context.transport)).toEqual(['SpinReady']);
  });

  it('keeps the damage of the base spin on the field the free spins dig', async () => {
    const { bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: BONUS });
    await motions.finishAll();

    expect(controller.field?.isBroken(0)).toBe(true);
    expect(controller.field?.isBroken(1)).toBe(true);
    expect(controller.field?.wearOf(6)).toBeCloseTo(0.4);
  });

  it('opens the chest of a broken-through column with its multiplier', async () => {
    const { bridge, motions, controller } = setup();
    const column = Array.from({ length: 6 }, (_, index) => ({ index, damage: 2 }));
    bridge.receive({
      type: 'ApplySpinResult',
      payload: reply({ pickaxes: [dig(0, ...column)], chests: [{ col: 0, coeff: 4, payout: '0.40' }], coeff: 0.4 }),
    });
    await settle();
    const played: string[] = [];
    while (motions.pending.length > 0) {
      played.push(...motions.pending.map((motion) => motion.name));
      motions.pending.splice(0).forEach((motion) => motion.finish());
      await settle();
    }

    expect(played.slice(-2)).toEqual(['retire', 'chest:0']);
    expect(controller.openedChests.get(0)).toBe(4);
  });

  it('counts broken blocks into the running coefficient and ends on the server one, celebrating a win', async () => {
    const { bridge, motions, controller, celebrations } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: reply({ pickaxes: [dig(0, { index: 0, damage: 2, coeff: 0.1 })], coeff: 0.1 }) });
    await settle();
    motions.pending.splice(0).forEach((motion) => motion.finish());
    await settle();
    motions.pending.splice(0).forEach((motion) => motion.finish());
    await settle();
    expect(controller.coefficient).toBeCloseTo(0.1);

    await motions.finishAll();
    expect(controller.phase).toBe('idle');
    expect(controller.lastResult).toBe('Won 0.10 USD');
    expect(celebrations()).toBe(1);
  });

  it('plays a second reply only after the first one is reported', async () => {
    const { transport, bridge, motions } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: reply({ boards: [PLAIN], pickaxes: [] }) });
    bridge.receive({ type: 'ApplySpinResult', payload: reply({ boards: [PLAIN], pickaxes: [] }) });
    await settle();
    expect(motions.pending).toHaveLength(1);

    motions.pending.splice(0).forEach((motion) => motion.finish());
    await settle();
    expect(eventTypes(transport)).toEqual(['SpinReady']);
    expect(motions.pending).toHaveLength(1);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady', 'SpinReady']);
  });

  it('sends nothing once a motion was cut short', async () => {
    const { transport, bridge, motions } = setup({ strike: () => Promise.resolve(false) });
    bridge.receive({ type: 'ApplySpinResult', payload: reply() });
    await motions.finishAll();
    expect(eventTypes(transport)).toEqual([]);
  });

  it('shows a broken reply instead of playing it, and keeps the bar locked', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: reply({ field: 'short' }) });
    await motions.finishAll();

    expect(controller.phase).toBe('broken');
    expect(controller.lastResult).toContain('field');
    expect(eventTypes(transport)).toEqual([]);
  });
});
