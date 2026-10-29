import type { EngineEvent, FruitLoveFeverSpinResult, FruitLoveFeverStepResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { FruitLoveFeverBridge } from '../src/fruit-love-fever/FruitLoveFeverBridge';
import { FIRST_STEP, SCATTER_SPIN } from './fruitLoveFeverFixtures';
import { recordingTransport } from './recordingTransport';

describe('FruitLoveFeverBridge', () => {
  it('hands the parsed play reply to the scene and keeps it', () => {
    const bridge = new FruitLoveFeverBridge(recordingTransport());
    const received: FruitLoveFeverSpinResult[] = [];
    bridge.spinResultReceived.add((spin) => received.push(spin));

    bridge.receive({ type: 'ApplySpinResult', payload: JSON.stringify(SCATTER_SPIN) });

    expect(received).toEqual([SCATTER_SPIN]);
    expect(bridge.lastSpinResult).toEqual(SCATTER_SPIN);
  });

  it('hands a free spin over as a step result, not as a spin', () => {
    const bridge = new FruitLoveFeverBridge(recordingTransport());
    const steps: FruitLoveFeverStepResult[] = [];
    const spins: unknown[] = [];
    bridge.stepResultReceived.add((step) => steps.push(step));
    bridge.spinResultReceived.add((spin) => spins.push(spin));

    bridge.receive({ type: 'ApplyBonusStepResult', payload: JSON.stringify(FIRST_STEP) });

    expect(steps).toEqual([FIRST_STEP]);
    expect(bridge.lastStepResult?.bonusGame.currentGameNumber).toBe(1);
    expect(spins).toEqual([]);
  });

  it('hands the config and the session state over parsed', () => {
    const bridge = new FruitLoveFeverBridge(recordingTransport());
    const configs: unknown[] = [];
    const states: unknown[] = [];
    bridge.gameConfigReceived.add((config) => configs.push(config));
    bridge.gameStateReceived.add((state) => states.push(state));

    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify({ currency: { code: 'USD' } }) });
    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify({ status: 'none' }) });

    expect(configs).toEqual([{ currency: { code: 'USD' } }]);
    expect(states).toEqual([{ status: 'none' }]);
    expect(bridge.lastGameState).toEqual({ status: 'none' });
  });

  it('ignores a command of another mode', () => {
    const bridge = new FruitLoveFeverBridge(recordingTransport());
    const received: unknown[] = [];
    bridge.spinResultReceived.add((spin) => received.push(spin));
    bridge.stepResultReceived.add((step) => received.push(step));

    bridge.receive({ type: 'ApplyDropResult', payload: '{}' });

    expect(received).toEqual([]);
  });

  it('asks for the config, the state and a free spin, and reports the played round', () => {
    const transport = recordingTransport();
    const bridge = new FruitLoveFeverBridge(transport);

    bridge.requestGameConfig();
    bridge.requestGameState();
    bridge.requestStep();
    bridge.notifySpinReady();

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'RequestGameConfig' },
      { type: 'RequestGameState' },
      { type: 'RequestStep' },
      { type: 'SpinReady' },
    ]);
  });
});
