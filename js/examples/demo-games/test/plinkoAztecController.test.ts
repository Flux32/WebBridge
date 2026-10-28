import { PlinkoAztecBridge } from '@omega/webbridge-js';
import { describe, expect, it, vi } from 'vitest';
import { PlinkoAztecController } from '../src/modes/plinko-aztec/PlinkoAztecController';
import { eventTypes, manualMotions, recordingTransport, settle } from './recording';

const COEFFICIENTS = [1000, 130, 26, 9, 4, 2, 0.2, 0, 0.2, 2, 4, 9, 26, 130, 1000];
const CONFIG = {
  betConfig: { currency: 'USD', decimalPlaces: '2' },
  positions: COEFFICIENTS.map((coefficient) => ({ coefficient, probability: 1 / 15 })),
  ballsAmountOptions: [10, 20, 50],
};
const BONUS = { gameNumber: 1, level: 1, progress: 0, ballPerDrop: 3, ballsAmount: 2, freeSpinProgress: 0, winAmount: '0.00' };
const BALLS = [
  { position: '4', coeff: '4', bonusBumpAmount: 0 },
  { position: '0.2', coeff: '0.2', bonusBumpAmount: 1 },
];
const SPIN_BALLS = [{ position: 'spin', coeff: '0', bonusBumpAmount: 0 }, ...BALLS];

type Command = Parameters<PlinkoAztecBridge['receive']>[0];

const stateOf = (extra: object = {}) => JSON.stringify({ winAmount: '4.20', ballsResult: BALLS, bonusGameState: { progress: {} }, ...extra });
const drop = (extra: object = {}): Command => ({ type: 'ApplyDropResult', payload: stateOf(extra) });
const step = (extra: object = {}): Command => ({ type: 'ApplyBonusStepResult', payload: stateOf(extra) });
const BONUS_DROP = drop({
  ballsResult: SPIN_BALLS,
  freeSpinResult: { position: 'bonus', coeff: '0', winAmount: '0.00' },
  bonusGameState: { progress: {}, result: BONUS },
});

const setup = (dropMotion?: () => Promise<boolean>) => {
  const transport = recordingTransport();
  const bridge = new PlinkoAztecBridge(transport);
  const motions = manualMotions();
  const dropped: (readonly number[])[] = [];
  const wheels: string[] = [];
  const controller = new PlinkoAztecController(bridge, {
    drop: dropMotion ?? ((slots) => (dropped.push(slots), motions.play('drop'))),
    spinWheel: (spin) => (wheels.push(spin.sectors[spin.target] ?? ''), motions.play('wheel')),
    celebrate: () => undefined,
  });
  bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify(CONFIG) });
  return { transport, bridge, motions, controller, dropped, wheels };
};

const pendingNames = (motions: ReturnType<typeof manualMotions>): string[] => motions.pending.map((motion) => motion.name);

describe('PlinkoAztecController', () => {
  it('reports DropFinished once, only after every ball has landed', async () => {
    const { transport, bridge, motions, controller, dropped } = setup();

    bridge.receive(drop());
    await settle();
    expect(eventTypes(transport)).toEqual([]);
    expect(controller.ballsInPlay).toBe(2);
    expect(controller.lastDrop).toBeNull();

    await motions.finishAll();
    expect(dropped).toEqual([[4, 8]]);
    expect(eventTypes(transport)).toEqual(['DropFinished']);
    expect(controller.lastDrop?.winAmount).toBe('4.20');
  });

  it('spins the wheel after the balls and reports only once it has stopped', async () => {
    const { transport, bridge, motions, wheels } = setup();
    bridge.receive(drop({ ballsResult: SPIN_BALLS, freeSpinResult: { position: '2', coeff: '2', winAmount: '8.40' } }));

    await settle();
    expect(pendingNames(motions)).toEqual(['drop']);
    motions.pending.splice(0).forEach((motion) => motion.finish());
    await settle();
    expect(pendingNames(motions)).toEqual(['wheel']);
    expect(eventTypes(transport)).toEqual([]);

    await motions.finishAll();
    expect(wheels).toEqual(['x2']);
    expect(eventTypes(transport)).toEqual(['DropFinished']);
  });

  it('holds DropFinished through the bonus game and sends it once the last step has landed', async () => {
    const { transport, bridge, motions, controller } = setup();

    bridge.receive(BONUS_DROP);
    await motions.finishAll();
    expect(controller.phase).toBe('bonus');
    expect(eventTypes(transport)).toEqual([]);

    controller.onTap();
    expect(eventTypes(transport)).toEqual(['RequestStep']);
    bridge.receive(step({ bonusGameState: { progress: {}, result: { ...BONUS, ballsAmount: 1, winAmount: '1.20' } } }));
    await motions.finishAll();
    expect(controller.phase).toBe('bonus');
    expect(controller.bonus?.winAmount).toBe('1.20');

    controller.onTap();
    bridge.receive(step());
    await motions.finishAll();
    expect(controller.phase).toBe('idle');
    expect(eventTypes(transport)).toEqual(['RequestStep', 'RequestStep', 'DropFinished']);
  });

  it('asks for one bonus step per tap until it has landed', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive(BONUS_DROP);
    await motions.finishAll();

    controller.onTap();
    controller.onTap();
    expect(eventTypes(transport)).toEqual(['RequestStep']);
  });

  it('asks the host for a drop on a tap outside the bonus game', () => {
    const { transport, controller } = setup();
    controller.onTap();
    expect(eventTypes(transport)).toEqual(['RequestPlay']);
  });

  it('resumes a bonus game restored after a reload without a DropFinished for it', async () => {
    const { transport, bridge, motions, controller } = setup();
    bridge.receive({ type: 'ApplyGameState', payload: stateOf({ bonusGameState: { progress: {}, result: BONUS } }) });
    expect(controller.phase).toBe('bonus');

    controller.onTap();
    bridge.receive(step());
    await motions.finishAll();
    expect(eventTypes(transport)).toEqual(['RequestStep']);
  });

  it('sends nothing more once a motion was cut short', async () => {
    const { transport, bridge } = setup(() => Promise.resolve(false));
    bridge.receive(drop());
    bridge.receive(drop());
    await settle();
    expect(eventTypes(transport)).toEqual([]);
  });

  it('follows the bet bar selection the host pushes', () => {
    const { bridge, controller } = setup();
    bridge.receive({ type: 'SetBallsAmount', payload: 20 });
    bridge.receive({ type: 'SetBetPerBall', payload: '2' });
    expect(controller.selection).toEqual({ ballsAmount: 20, betPerBall: '2' });
    expect(controller.currency).toBe('USD');
  });

  it('shows a ball in an unknown slot as an error and drops nothing', async () => {
    const { transport, bridge, motions, controller, dropped } = setup();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    bridge.receive(drop({ ballsResult: [{ position: '77', coeff: '77', bonusBumpAmount: 0 }] }));
    await motions.finishAll();

    expect(dropped).toEqual([]);
    expect(controller.error).toContain('"77"');
    expect(eventTypes(transport)).toEqual([]);
    logged.mockRestore();
  });
});
