import { PlinkoBridge } from '@omega/webbridge-js';
import { describe, expect, it, vi } from 'vitest';
import { PlinkoController } from '../src/modes/plinko/PlinkoController';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const CONFIG = {
  currency: 'USD',
  coefficients: {
    LOW: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    MEDIUM: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    HIGH: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
};

const dropOf = (resultPosition: unknown, coeff: unknown = 4) => ({
  type: 'ApplyDropResult' as const,
  payload: JSON.stringify({ status: 'win', coeff, resultPosition, risk: 'HIGH', winAmount: '4.00', currency: 'USD' }),
});

const setup = (drop?: (slots: readonly number[]) => Promise<boolean>) => {
  const transport = recordingTransport();
  const bridge = new PlinkoBridge(transport);
  const motions = manualMotions();
  const dropped: (readonly number[])[] = [];
  const outcomes: string[] = [];
  const controller = new PlinkoController(bridge, {
    drop:
      drop ??
      ((slots) => {
        dropped.push(slots);
        return motions.play('drop');
      }),
    land: (slot, outcome) => void outcomes.push(`${slot}:${outcome}`),
  });
  bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify(CONFIG) });
  return { transport, bridge, motions, controller, dropped, outcomes };
};

describe('PlinkoController', () => {
  it('reports DropFinished only once the ball has landed', async () => {
    const { transport, bridge, motions } = setup();

    bridge.receive(dropOf(7));
    await settle();
    expect(eventTypes(transport)).toEqual([]);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['DropFinished']);
  });

  it('drops the ball into the result position', async () => {
    const { bridge, motions, dropped } = setup();
    bridge.receive(dropOf(7));
    await motions.finishAll();
    expect(dropped).toEqual([[7]]);
  });

  it('shows the multiplier and the win only after the landing', async () => {
    const { bridge, motions, controller, outcomes } = setup();

    bridge.receive(dropOf(7));
    await settle();
    expect(controller.phase).toBe('dropping');
    expect(controller.lastDrop).toBeNull();

    await motions.finishAll();
    expect(controller.phase).toBe('idle');
    expect(controller.lastDrop?.coefficient).toBe(4);
    expect(outcomes).toEqual(['7:win']);
  });

  it('plays two drops one after another, each reported once', async () => {
    const { transport, bridge, motions } = setup();

    bridge.receive(dropOf(7));
    bridge.receive(dropOf(4, 0.2));
    await settle();
    expect(motions.pending).toHaveLength(1);

    motions.pending.splice(0).forEach((motion) => motion.finish());
    await settle();
    expect(eventTypes(transport)).toEqual(['DropFinished']);
    expect(motions.pending).toHaveLength(1);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['DropFinished', 'DropFinished']);
  });

  it('sends nothing more once a motion was cut short', async () => {
    const { transport, bridge } = setup(() => Promise.resolve(false));
    bridge.receive(dropOf(7));
    bridge.receive(dropOf(4));
    await settle();
    expect(eventTypes(transport)).toEqual([]);
  });

  it('plays a drop whose numbers arrived as strings', async () => {
    const { transport, bridge, motions, dropped } = setup();
    bridge.receive(dropOf('3', '0.3'));
    await motions.finishAll();
    expect(dropped).toEqual([[3]]);
    expect(eventTypes(transport)).toEqual(['DropFinished']);
  });

  it('shows a broken drop as an error and drops no ball', async () => {
    const { transport, bridge, motions, controller, dropped } = setup();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    bridge.receive(dropOf(42));
    await motions.finishAll();

    expect(dropped).toEqual([]);
    expect(controller.error).toContain('resultPosition 42');
    expect(eventTypes(transport)).toEqual([]);
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
