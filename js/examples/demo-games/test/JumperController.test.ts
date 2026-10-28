import { JumperBridge } from '@omega/webbridge-js';
import { describe, expect, it, vi } from 'vitest';
import { JumperController } from '../src/modes/jumper/JumperController';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const ROUND = {
  status: 'in-game',
  difficulty: 'EASY',
  coeff: '0',
  winAmount: '0',
  slots: [{ step: 6, state: 'HIDDEN' }],
  lineNumber: -1,
  landingStep: -1,
  visitedSteps: [],
};

const setup = () => {
  const transport = recordingTransport();
  const bridge = new JumperBridge(transport);
  const motions = manualMotions();
  const jumps: number[][] = [];
  const placed: number[] = [];
  const controller = new JumperController(bridge, {
    place: (step) => void placed.push(step),
    jump: (waypoints) => {
      jumps.push([...waypoints]);
      return motions.play('jump');
    },
    fall: () => motions.play('fall'),
    rewind: () => motions.play('rewind'),
    pause: () => motions.play('pause'),
    celebrate: () => undefined,
  });
  const move = (move: string, fields: Record<string, unknown> = {}): void =>
    bridge.receive({ type: 'ApplyJumperMove', payload: { ...ROUND, ...fields, move } as never });
  return { transport, bridge, motions, jumps, placed, controller, move };
};

const names = (motions: ReturnType<typeof manualMotions>): string[] => motions.pending.map((motion) => motion.name);

describe('JumperController', () => {
  it('opens the round on play without reporting anything', async () => {
    const { transport, motions, placed, controller, move } = setup();
    move('play');
    await motions.finishAll();
    expect(eventTypes(transport)).toEqual([]);
    expect(placed).toEqual([-1]);
    expect(controller.scene.phase).toBe('open');
  });

  it('reports a jump only once the player has landed', async () => {
    const { transport, motions, jumps, controller, move } = setup();
    move('step', { lineNumber: 0, landingStep: 0, coeff: '1.1' });
    await settle();
    expect(names(motions)).toEqual(['jump']);
    expect(jumps).toEqual([[0]]);
    expect(eventTypes(transport)).toEqual([]);
    expect(controller.scene.coefficient).toBeNull();

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady']);
    expect(controller.scene.coefficient).toBe(1.1);
  });

  it('plays the accelerator chain in one jump', async () => {
    const { motions, jumps, move } = setup();
    const visitedSteps = [{ step: 6, accelerator: 'TRAMPOLINE' }, { step: 8, accelerator: 'JETPACK' }];
    move('step', { lineNumber: 6, landingStep: 12, visitedSteps, coeff: '2.4' });
    await motions.finishAll();
    expect(jumps).toEqual([[6, 8, 12]]);
  });

  it('falls on a lost jump before reporting it, then resets on the restart', async () => {
    const { transport, motions, controller, move, bridge } = setup();
    move('step', { status: 'lose', lineNumber: 3, landingStep: 3, collisionPosition: 3 });
    await settle();
    motions.pending.splice(0).forEach((motion) => motion.finish());
    await settle();
    expect(names(motions)).toEqual(['fall']);
    expect(eventTypes(transport)).toEqual([]);

    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady']);
    expect(controller.scene.phase).toBe('fell');

    bridge.receive({ type: 'RestartRound', payload: 'lose|' });
    await settle();
    expect(names(motions)).toEqual(['rewind']);
    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady', 'SpinReady']);
    expect(controller.scene.phase).toBe('idle');
  });

  it('waits for the restart after a cash out', async () => {
    const { transport, motions, controller, move, bridge } = setup();
    move('payout', { status: 'win', lineNumber: 4, landingStep: 4, coeff: '1.6', collisionPosition: 5 });
    await motions.finishAll();
    expect(eventTypes(transport)).toEqual([]);
    expect(controller.scene.phase).toBe('cashed');

    bridge.receive({ type: 'RestartRound', payload: 'cashout|1.60 USD' });
    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['SpinReady']);
    expect(controller.scene.note).toBe('cashout 1.60 USD');
  });

  it('reads a jump whose numbers came as strings', async () => {
    const { transport, motions, jumps, move } = setup();
    move('step', { lineNumber: '2', landingStep: '4', visitedSteps: [{ step: '2', accelerator: 'TRAMPOLINE' }], coeff: 1.3 });
    await motions.finishAll();
    expect(jumps).toEqual([[2, 4]]);
    expect(eventTypes(transport)).toEqual(['SpinReady']);
  });

  it('logs and skips a move it cannot read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { motions, move } = setup();
    move('step', { landingStep: 'four' });
    await settle();
    expect(motions.pending).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('landingStep'));
    error.mockRestore();
  });

  it('reads ladders whose coefficients came as strings', () => {
    const { bridge, controller } = setup();
    const config = { ladders: [{ difficulty: 'EASY', coefficients: ['1.03', '1.1'], accelerators: [], bonusBuyMultiplier: 100 }] };
    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify(config) });
    bridge.receive({ type: 'SetJumperDifficulty', payload: 'EASY' });
    expect(controller.scene.ladder).toEqual([1.03, 1.1]);
  });

  it('plays every free game and saves the progress after each', async () => {
    const { transport, motions, jumps, bridge } = setup();
    const game = { finalStep: 2, coefficient: '1.2', route: [{ step: 0, action: 'STEP' }, { step: 1, action: 'STEP' }] };
    const bonus = { difficulty: 'EASY', betAmount: '1', currency: 'USD', games: [game, game], totalCoefficient: '2.4', totalWin: '2.4' };
    bridge.receive({ type: 'StartBonus', payload: bonus as never });
    await settle();
    expect(eventTypes(transport)).toEqual(['BonusActive']);

    await motions.finishAll();
    expect(jumps).toEqual([[0, 1, 2], [0, 1, 2]]);
    expect(eventTypes(transport)).toEqual(['BonusActive', 'BonusProgressSave', 'BonusProgressSave', 'BonusEnded']);
  });

  it('sends nothing more once a motion was cut short', async () => {
    const transport = recordingTransport();
    const bridge = new JumperBridge(transport);
    const fall = vi.fn(async () => true);
    const motions = { place: () => undefined, jump: async () => false, fall, rewind: async () => true, pause: async () => true, celebrate: () => undefined };
    const controller = new JumperController(bridge, motions);
    bridge.receive({ type: 'ApplyJumperMove', payload: { ...ROUND, status: 'lose', lineNumber: 0, landingStep: 0, collisionPosition: 0, move: 'step' } as never });
    bridge.receive({ type: 'RestartRound', payload: 'lose|' });
    await settle();
    expect(fall).not.toHaveBeenCalled();
    expect(eventTypes(transport)).toEqual([]);
    controller.destroy();
  });
});
