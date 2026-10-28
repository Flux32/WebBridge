import { SlotBridge } from '@omega/webbridge-js';
import type { SlotSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { SlotController, type SlotMotions } from '../src/modes/slot/SlotController';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const PLAIN = '123456789123';
const COLLECT = 'c123' + '45l6' + '789b';
const COLLECTION = {
  action: 'STRIKE_COINS_COLLECTION',
  triggerIndex: 6,
  coins: [{ index: 0, coeff: '3' }, { index: 11, coeff: '2' }],
};

const spin = (boards: string[], actions: SlotSpinResult['actions']): string =>
  JSON.stringify({
    betAmount: '1', coeff: '5', currency: 'USD', isFinished: true, isWin: true, winAmount: '5.00',
    rounds: boards.length, boards, actions,
  } satisfies SlotSpinResult);

const setup = (overrides: Partial<SlotMotions> = {}) => {
  const transport = recordingTransport();
  const bridge = new SlotBridge(transport);
  const motions = manualMotions();
  let celebrations = 0;
  const controller = new SlotController(bridge, {
    spin: () => motions.play('spin'),
    collect: () => motions.play('collect'),
    celebrate: () => void (celebrations += 1),
    ...overrides,
  });
  return { transport, bridge, motions, controller, celebrations: () => celebrations };
};

describe('SlotController', () => {
  it('reports the round only once the reels have stopped', async () => {
    const { transport, bridge, motions } = setup();

    bridge.receive({ type: 'ApplySpinResult', payload: spin([PLAIN], [[]]) });
    await settle();
    expect(motions.pending.map((motion) => motion.name)).toEqual(['spin']);
    expect(eventTypes(transport)).toEqual([]);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady']);
  });

  it('plays every board and its collection before the one SpinReady', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: spin([PLAIN, COLLECT], [[], [COLLECTION]]) });
    const played: string[] = [];

    await settle();
    while (motions.pending.length > 0) {
      expect(eventTypes(transport)).toEqual([]);
      const [motion] = motions.pending.splice(0);
      played.push(`${motion?.name}:${controller.boardNumber}`);
      motion?.finish();
      await settle();
    }

    expect(played).toEqual(['spin:1', 'spin:2', 'collect:2']);
    expect(eventTypes(transport)).toEqual(['SpinReady']);
  });

  it('counts the collected coins into the round multiplier and celebrates a win', async () => {
    const { bridge, motions, controller, celebrations } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: spin([COLLECT], [[COLLECTION]]) });
    await motions.finishAll();

    expect(controller.multiplier).toBe(5);
    expect(controller.phase).toBe('idle');
    expect(celebrations()).toBe(1);
  });

  it('plays a second round only after the first one is reported', async () => {
    const { transport, bridge, motions } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: spin([PLAIN], [[]]) });
    bridge.receive({ type: 'ApplySpinResult', payload: spin([PLAIN], [[]]) });
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
    const { transport, bridge } = setup({ spin: () => Promise.resolve(false) });
    bridge.receive({ type: 'ApplySpinResult', payload: spin([PLAIN], [[]]) });
    await settle();
    expect(eventTypes(transport)).toEqual([]);
  });

  it('shows a broken round instead of playing it, and keeps the bar locked', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: spin(['12z'], [[]]) });
    await motions.finishAll();

    expect(controller.phase).toBe('broken');
    expect(controller.lastResult).toContain('board');
    expect(eventTypes(transport)).toEqual([]);
  });
});
