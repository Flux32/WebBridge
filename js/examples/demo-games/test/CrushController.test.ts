import { CrushBridge } from '@omega/webbridge-js';
import { describe, expect, it } from 'vitest';
import { CrushController } from '../src/modes/crush/CrushController';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const SURVIVED = { isWinMain: true, coinsTriggered: false, coinsCollected: [] };
const LOST = { isWinMain: false, coinsTriggered: false, coinsCollected: [] };

const setup = () => {
  const transport = recordingTransport();
  const bridge = new CrushBridge(transport);
  const motions = manualMotions();
  const controller = new CrushController(bridge, {
    hop: () => motions.play('hop'),
    crush: () => motions.play('crush'),
    rewind: () => motions.play('rewind'),
    bonus: () => motions.play('bonus'),
    celebrate: () => undefined,
  });
  bridge.receive({ type: 'UpdateCoeffs', payload: [1.1, 1.5, 2.2] });
  return { transport, bridge, motions, controller };
};

describe('CrushController', () => {
  it('reports a survived step only once the hop has landed', async () => {
    const { transport, bridge, motions, controller } = setup();

    bridge.receive({ type: 'ApplyStepResult', payload: SURVIVED });
    await settle();
    expect(eventTypes(transport)).not.toContain('SpinReady');

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady']);
    expect(controller.round.step).toBe(0);
  });

  it('plays the crush and resets the scene itself before reporting a lost step', async () => {
    const { transport, bridge, motions, controller } = setup();

    bridge.receive({ type: 'ApplyStepResult', payload: LOST });
    await settle();
    expect(motions.pending.map((motion) => motion.name)).toEqual(['crush']);
    expect(eventTypes(transport)).toEqual([]);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady']);
    expect(controller.round.step).toBe(-1);
  });

  it('answers the restart after the top step with a reset and a second SpinReady', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify({ lineNumber: 1, isFinished: false }) });

    bridge.receive({ type: 'ApplyStepResult', payload: SURVIVED });
    await motions.finishAll();
    bridge.receive({ type: 'RestartRound', payload: 'win|$2.20' });
    await settle();
    expect(eventTypes(transport)).toEqual(['SpinReady']);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady', 'SpinReady']);
    expect(controller.round.step).toBe(-1);
  });

  it('resets on a cash out and only then unlocks the bar', async () => {
    const { transport, bridge, motions } = setup();

    bridge.receive({ type: 'RestartRound', payload: 'cashout|$1.50' });
    await settle();
    expect(eventTypes(transport)).toEqual([]);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady']);
  });

  it('reads a ladder the server sent as decimal strings', () => {
    const { bridge, controller } = setup();
    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify({ coefficients: ['1.03', '1.08'] }) });
    expect(controller.round.steps).toEqual([1.03, 1.08]);
  });

  it('restores a live round on the step the server reports', () => {
    const { bridge, controller } = setup();
    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify({ lineNumber: 2, isFinished: false }) });
    expect(controller.round.step).toBe(2);
  });

  it('plays a bonus series and reports its whole lifecycle', async () => {
    const { transport, bridge, motions } = setup();
    const bonus = {
      modeId: 'X', difficulty: 'EASY', positions: [], betAmount: 1, currency: 'USD', bonusTotalCoefficient: 2,
      bonusTotalWin: '2', completedIterations: 0, accumulatedCoefficient: 0, accumulatedWin: 0, currentStep: 0,
    };

    bridge.receive({ type: 'StartBonus', payload: bonus });
    await motions.finishAll();

    expect(eventTypes(transport)).toEqual(['BonusActive', 'BonusEnded', 'BonusProgressClear', 'BonusCleared']);
  });
});
