import type { EngineEvent } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { TwistBridge } from '../src/twist/TwistBridge';
import { recordingTransport } from './recordingTransport';

const SPIN = {
  outcome: 'water',
  status: 'lose',
  sessionIsFinished: false,
  coeff: '1.55',
  progress: { fire: 0, earth: 0, water: 2 },
  bonus: { hasBonus: false },
};

const SERIES = { totalRounds: 2, spins: [JSON.stringify(SPIN), JSON.stringify({ ...SPIN, outcome: 'fire' })] };

const collect = <T>(signal: { add(handler: (value: T) => void): unknown }): T[] => {
  const received: T[] = [];
  signal.add((value) => received.push(value));
  return received;
};

describe('TwistBridge', () => {
  it('hands the parsed spin to the board and keeps it as the latest state', () => {
    const bridge = new TwistBridge(recordingTransport());
    const spins = collect(bridge.spinResultReceived);

    bridge.receive({ type: 'ApplySpinResult', payload: JSON.stringify(SPIN) });

    expect(spins).toEqual([SPIN]);
    expect(bridge.lastGameState).toEqual(SPIN);
  });

  it('hands the raw server config and the session state to the board', () => {
    const bridge = new TwistBridge(recordingTransport());
    const configs = collect(bridge.gameConfigReceived);
    const states = collect(bridge.gameStateReceived);

    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify({ betConfig: {} }) });
    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify(SPIN) });

    expect(configs).toEqual([{ betConfig: {} }]);
    expect(states).toEqual([SPIN]);
  });

  it('splits the restart into its reason and amount', () => {
    const bridge = new TwistBridge(recordingTransport());
    const restarts = collect(bridge.restartRequested);

    bridge.receive({ type: 'RestartRound', payload: 'cashout|$1.50' });

    expect(restarts).toEqual([{ reason: 'cashout', amount: '$1.50' }]);
  });

  it('hands a bought series over with every spin parsed', () => {
    const bridge = new TwistBridge(recordingTransport());
    const series = collect(bridge.bonusStartRequested);

    bridge.receive({ type: 'StartBonus', payload: SERIES });

    expect(series).toEqual([{ totalRounds: 2, spins: [SPIN, { ...SPIN, outcome: 'fire' }] }]);
  });

  it('ignores a bonus that is not a twist series', () => {
    const bridge = new TwistBridge(recordingTransport());
    const series = collect(bridge.bonusStartRequested);

    bridge.receive({ type: 'StartBonus', payload: { games: [], totalCoefficient: 1 } as never });

    expect(series).toEqual([]);
  });

  it('lets the series start once the host intro has finished', () => {
    const bridge = new TwistBridge(recordingTransport());
    let finished = 0;
    bridge.freeGamesIntroFinished.add(() => (finished += 1));

    bridge.receive({ type: 'FreeGamesIntroFinished' });

    expect(finished).toBe(1);
  });

  it('reports the spin, the series and its progress to the host', () => {
    const transport = recordingTransport();
    const bridge = new TwistBridge(transport);

    bridge.notifySpinReady();
    bridge.notifyBonusActive();
    bridge.saveBonusProgress({ completedIterations: 1, totalIterations: 2 });
    bridge.notifyBonusEnded();

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'SpinReady' },
      { type: 'BonusActive' },
      { type: 'BonusProgressSave', raw: JSON.stringify({ completedIterations: 1, totalIterations: 2 }) },
      { type: 'BonusEnded' },
    ]);
  });
});
