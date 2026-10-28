import { TwistBridge } from '@omega/webbridge-js';
import { describe, expect, it } from 'vitest';
import { TwistController, type TwistMotions } from '../src/modes/twist/TwistController';
import { EMPTY_PROGRESS } from '../src/modes/twist/twistTable';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const progress = (fire: number, earth: number, water: number) => ({ fire, earth, water });
const spin = (outcome: string, board = progress(1, 0, 0), sessionIsFinished = false): string =>
  JSON.stringify({ outcome, progress: board, sessionIsFinished, coeff: '3.9', bonus: { hasBonus: false } });
const freeSpin = (outcome: string, board: ReturnType<typeof progress>): string =>
  JSON.stringify({ outcome, progress: board, autoWinCoeff: '0' });

const setup = (overrides: Partial<TwistMotions> = {}) => {
  const transport = recordingTransport();
  const bridge = new TwistBridge(transport);
  const motions = manualMotions();
  const controller = new TwistController(bridge, {
    spin: () => motions.play('spin'),
    fill: () => motions.play('fill'),
    wipe: () => motions.play('wipe'),
    pause: () => motions.play('pause'),
    celebrate: () => undefined,
    ...overrides,
  });
  return { transport, bridge, motions, controller };
};

const names = (motions: ReturnType<typeof manualMotions>) => motions.pending.map((motion) => motion.name);

/** Finishes motions one at a time, recording each with the events sent before it finished. */
const playStepByStep = async (motions: ReturnType<typeof manualMotions>, sent: () => string[]) => {
  const log: string[] = [];
  await settle();
  while (motions.pending.length > 0) {
    const [motion] = motions.pending.splice(0);
    log.push(`${motion?.name} after [${sent().join(',')}]`);
    motion?.finish();
    await settle();
  }
  return log;
};

describe('TwistController', () => {
  it('reports a spin only once the totems landed and the cells filled', async () => {
    const { transport, bridge, motions, controller } = setup();

    bridge.receive({ type: 'ApplySpinResult', payload: spin('fire') });
    await settle();
    expect(names(motions)).toEqual(['spin']);
    expect(controller.progress).toEqual(EMPTY_PROGRESS);

    const log = await playStepByStep(motions, () => eventTypes(transport));
    expect(log).toEqual(['spin after []', 'fill after []']);
    expect(eventTypes(transport)).toEqual(['SpinReady']);
    expect(controller.progress).toEqual(progress(1, 0, 0));
    expect(controller.phase).toBe('playing');
  });

  it('wipes the board on death before reporting the spin', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify({ progress: progress(2, 1, 0) }) });
    await motions.finishAll();

    bridge.receive({ type: 'ApplySpinResult', payload: spin('death', progress(2, 1, 0), true) });
    const log = await playStepByStep(motions, () => eventTypes(transport));

    expect(log).toEqual(['spin after []', 'wipe after []']);
    expect(eventTypes(transport)).toEqual(['SpinReady']);
    expect(controller.progress).toEqual(EMPTY_PROGRESS);
    expect(controller.phase).toBe('idle');
  });

  it('takes the part cash out off the board without a SpinReady', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify({ progress: progress(3, 2, 0) }) });
    await motions.finishAll();

    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify({ isFinished: true, progress: progress(2, 1, 0) }) });
    await motions.finishAll();

    expect(controller.progress).toEqual(progress(2, 1, 0));
    expect(eventTypes(transport)).toEqual([]);
  });

  it('clears the board on a full cash out and only then unlocks the bar', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: spin('fire') });
    await motions.finishAll();

    bridge.receive({ type: 'RestartRound', payload: 'cashout|$3.90' });
    await settle();
    expect(names(motions)).toEqual(['fill']);
    expect(eventTypes(transport)).toEqual(['SpinReady']);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady', 'SpinReady']);
    expect(controller.progress).toEqual(EMPTY_PROGRESS);
    expect(controller.lastResult).toBe('Cashed out $3.90');
  });

  it('restores a live session at boot and stays idle without one', async () => {
    const live = setup();
    live.bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify({ progress: { fire: '1', earth: 0, water: '2' } }) });
    await live.motions.finishAll();
    expect(live.controller.progress).toEqual(progress(1, 0, 2));
    expect(live.controller.phase).toBe('playing');

    const idle = setup();
    idle.bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify({ status: 'none' }) });
    await idle.motions.finishAll();
    expect(idle.controller.phase).toBe('idle');
    expect(eventTypes(idle.transport)).toEqual([]);
  });

  it('holds a bought series until the intro finished, then plays and reports it spin by spin', async () => {
    const { transport, bridge, motions } = setup();
    const spins = [freeSpin('fire', progress(1, 0, 0)), freeSpin('air', progress(1, 0, 0))];

    bridge.receive({ type: 'StartBonus', payload: { totalRounds: 2, spins } });
    await settle();
    expect(eventTypes(transport)).toEqual(['BonusActive', 'BonusProgressSave']);
    expect(names(motions)).toEqual([]);

    bridge.receive({ type: 'FreeGamesIntroFinished' });
    const log = await playStepByStep(motions, () => eventTypes(transport));

    expect(log).toEqual([
      'spin after [BonusActive,BonusProgressSave]',
      'fill after [BonusActive,BonusProgressSave]',
      'pause after [BonusActive,BonusProgressSave,BonusProgressSave]',
      'spin after [BonusActive,BonusProgressSave,BonusProgressSave]',
      'fill after [BonusActive,BonusProgressSave,BonusProgressSave]',
    ]);
    expect(eventTypes(transport)).toEqual(['BonusActive', 'BonusProgressSave', 'BonusProgressSave', 'BonusProgressSave', 'BonusEnded']);
    const saves = transport.sent.filter((event) => event.type === 'BonusProgressSave');
    expect(saves.map((event) => ('raw' in event ? JSON.parse(event.raw) : null))).toEqual([
      { completedIterations: 0, totalIterations: 2 },
      { completedIterations: 1, totalIterations: 2 },
      { completedIterations: 2, totalIterations: 2 },
    ]);
  });

  it('answers the restart after a series with a reset and a SpinReady', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'StartBonus', payload: { totalRounds: 1, spins: [freeSpin('earth', progress(0, 1, 0))] } });
    bridge.receive({ type: 'FreeGamesIntroFinished' });
    await motions.finishAll();
    expect(controller.phase).toBe('bonusEnded');

    bridge.receive({ type: 'RestartRound', payload: 'bonus|$7.70' });
    await motions.finishAll();

    expect(eventTypes(transport).slice(-2)).toEqual(['BonusEnded', 'SpinReady']);
    expect(controller.phase).toBe('idle');
    expect(controller.progress).toEqual(EMPTY_PROGRESS);
  });

  it('remembers an intro that finished while the series still waited in the queue', async () => {
    const { transport, bridge, motions } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: spin('fire') });
    bridge.receive({ type: 'StartBonus', payload: { totalRounds: 1, spins: [freeSpin('fire', progress(2, 0, 0))] } });
    bridge.receive({ type: 'FreeGamesIntroFinished' });

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady', 'BonusActive', 'BonusProgressSave', 'BonusProgressSave', 'BonusEnded']);
  });

  it('sends nothing once a motion was cut short', async () => {
    const { transport, bridge } = setup({ spin: () => Promise.resolve(false) });
    bridge.receive({ type: 'ApplySpinResult', payload: spin('fire') });
    bridge.receive({ type: 'RestartRound', payload: 'cashout|$1' });
    await settle();
    expect(eventTypes(transport)).toEqual([]);
  });

  it('shows a broken spin instead of playing it', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplySpinResult', payload: spin('lava') });
    await motions.finishAll();

    expect(controller.phase).toBe('broken');
    expect(eventTypes(transport)).toEqual([]);
  });
});
