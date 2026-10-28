import { WheelBridge } from '@omega/webbridge-js';
import { describe, expect, it, vi } from 'vitest';
import { WheelController, type WheelSpinPlan } from '../src/modes/wheel/WheelController';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const setup = (options: { now?: number } = {}) => {
  const transport = recordingTransport();
  const bridge = new WheelBridge(transport);
  const motions = manualMotions();
  const plans: WheelSpinPlan[] = [];
  const reveals: string[] = [];
  const clock = { now: options.now ?? 0 };
  const controller = new WheelController(
    bridge,
    {
      spin: (plan) => {
        plans.push(plan);
        return motions.play('spin');
      },
      reveal: (color) => {
        reveals.push(color);
        return motions.play('reveal');
      },
    },
    () => clock.now,
  );
  const round = (fields: Record<string, unknown>): void =>
    bridge.receive({ type: 'ApplyRound', payload: JSON.stringify({ roundId: 'r1', ...fields }) });
  return { transport, bridge, motions, plans, reveals, clock, controller, round };
};

const pendingNames = (motions: ReturnType<typeof manualMotions>): string[] => motions.pending.map((motion) => motion.name);

describe('WheelController', () => {
  it('counts down the betting phase without motions or events', async () => {
    const { transport, motions, controller, round } = setup({ now: 1000 });
    round({ status: 'WAIT_GAME', msToNextPhase: 5000 });
    await settle();
    expect(controller.phase).toBe('betting');
    expect(controller.round?.deadlineAt).toBe(6000);
    expect(motions.pending).toEqual([]);
    expect(eventTypes(transport)).toEqual([]);
  });

  it('spins to the cell over what is left of the spin phase', async () => {
    const { motions, plans, controller, round } = setup({ now: 0 });
    round({ status: 'IN_GAME', msToNextPhase: 4000, cellIndex: 17, inCellOffset: 0.42 });
    await settle();
    expect(pendingNames(motions)).toEqual(['spin']);
    expect(plans[0]).toMatchObject({ cellIndex: 17, inCellOffset: 0.42, durationMs: 4000 });
    expect(plans[0]?.turns).toBeGreaterThan(0);
    expect(controller.phase).toBe('spinning');
  });

  it('reports the round shown only once the wheel landed and the result arrived', async () => {
    const { transport, motions, reveals, controller, round } = setup();
    round({ status: 'IN_GAME', msToNextPhase: 4000, cellIndex: 3, inCellOffset: 0.5 });
    await settle();
    round({ status: 'FINISH_GAME', winnerColor: 'BLACK', cellIndex: null });
    await settle();
    expect(eventTypes(transport)).toEqual([]);

    motions.pending.splice(0).forEach((motion) => motion.finish());
    await settle();
    expect(pendingNames(motions)).toEqual(['reveal']);
    expect(reveals).toEqual(['BLACK']);
    expect(eventTypes(transport)).toEqual([]);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['RoundShown']);
    expect(controller.phase).toBe('result');
  });

  it('waits for the result when the wheel lands first', async () => {
    const { transport, motions, controller, round } = setup();
    round({ status: 'IN_GAME', msToNextPhase: 4000, cellIndex: 3, inCellOffset: 0.5 });
    await motions.finishAll();
    expect(controller.phase).toBe('landed');
    expect(eventTypes(transport)).toEqual([]);

    round({ status: 'FINISH_GAME', winnerColor: 'BLACK' });
    await settle();
    expect(eventTypes(transport)).toEqual([]);
    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['RoundShown']);
  });

  it('reports each round once however often its snapshots repeat', async () => {
    const { transport, motions, plans, round } = setup();
    round({ status: 'IN_GAME', msToNextPhase: 4000, cellIndex: 3 });
    round({ status: 'IN_GAME', msToNextPhase: 3000, cellIndex: 3 });
    round({ status: 'FINISH_GAME', winnerColor: 'BLACK' });
    round({ status: 'FINISH_GAME', winnerColor: 'BLACK' });
    await motions.finishAll();
    round({ status: 'FINISH_GAME', winnerColor: 'BLACK' });
    await motions.finishAll();
    expect(plans).toHaveLength(1);
    expect(eventTypes(transport)).toEqual(['RoundShown']);

    round({ roundId: 'r2', status: 'WAIT_GAME', msToNextPhase: 5000 });
    round({ roundId: 'r2', status: 'IN_GAME', msToNextPhase: 4000, cellIndex: 0 });
    round({ roundId: 'r2', status: 'FINISH_GAME', winnerColor: 'GREEN' });
    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['RoundShown', 'RoundShown']);
  });

  it('snaps to the result of a page opened mid-result', async () => {
    const { transport, motions, plans, round } = setup();
    round({ status: 'FINISH_GAME', winnerColor: 'BLUE', cellIndex: 8, inCellOffset: 0.3 });
    await settle();
    expect(pendingNames(motions)).toEqual(['spin']);
    expect(plans[0]).toMatchObject({ cellIndex: 8, turns: 0 });

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['RoundShown']);
  });

  it('spins briefly when the page opens with the spin almost over', async () => {
    const { plans, round } = setup();
    round({ status: 'IN_GAME', msToNextPhase: 50, cellIndex: 8 });
    await settle();
    expect(plans[0]?.durationMs).toBeGreaterThanOrEqual(500);
  });

  it('reads a round whose numbers came as strings', async () => {
    const { plans, round } = setup();
    round({ status: 'IN_GAME', msToNextPhase: '4000', cellIndex: '17', inCellOffset: '0.25' });
    await settle();
    expect(plans[0]).toMatchObject({ cellIndex: 17, inCellOffset: 0.25, durationMs: 4000 });
  });

  it('logs and skips a snapshot it cannot read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { motions, controller, round } = setup();
    round({ status: 'IN_GAME', cellIndex: 'x' });
    await settle();
    expect(motions.pending).toEqual([]);
    expect(controller.round).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('cellIndex'));
    error.mockRestore();
  });

  it('sends nothing more once a motion was cut short', async () => {
    const transport = recordingTransport();
    const bridge = new WheelBridge(transport);
    const reveal = vi.fn(async () => true);
    const controller = new WheelController(bridge, { spin: async () => false, reveal }, () => 0);
    bridge.receive({ type: 'ApplyRound', payload: JSON.stringify({ status: 'IN_GAME', cellIndex: 3 }) });
    bridge.receive({ type: 'ApplyRound', payload: JSON.stringify({ status: 'FINISH_GAME', winnerColor: 'BLACK' }) });
    await settle();
    expect(reveal).not.toHaveBeenCalled();
    expect(eventTypes(transport)).toEqual([]);
    controller.destroy();
  });

  it('keeps the wheel above the bar the host reports', () => {
    const { bridge, controller } = setup();
    const metrics = { widthViewport: 1, betBarTopViewport: 0.42, historyTopViewport: 0.3, betBarScale: 0.5 };
    bridge.receive({ type: 'SetWheelBetBarMetrics', payload: JSON.stringify(metrics) });
    expect(controller.barTopShare).toBe(0.42);
  });

  it('never reports SpinReady', async () => {
    const { transport, motions, round } = setup();
    round({ status: 'IN_GAME', cellIndex: 1 });
    round({ status: 'FINISH_GAME', winnerColor: 'BLUE' });
    await motions.finishAll();
    expect(eventTypes(transport)).not.toContain('SpinReady');
  });
});
