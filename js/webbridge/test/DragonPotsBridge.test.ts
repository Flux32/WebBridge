import type { DragonPotsGameState, DragonPotsSpinResult, EngineEvent } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { DragonPotsBridge } from '../src/dragon-pots/DragonPotsBridge';
import { RECORDED_STATE, recorded } from './dragonPotsFixtures';
import { recordingTransport } from './recordingTransport';

describe('DragonPotsBridge', () => {
  it('hands the whole round — jackpot pick and Hold & Win included — to the scene in one reply', () => {
    const bridge = new DragonPotsBridge(recordingTransport());
    const received: DragonPotsSpinResult[] = [];
    bridge.spinResultReceived.add((spin) => received.push(spin));
    const ultimate = recorded('play-ultimate');

    bridge.receive({ type: 'ApplySpinResult', payload: JSON.stringify(ultimate) });

    expect(received).toEqual([ultimate]);
    expect(bridge.lastSpinResult?.roundResult.jackpotResult?.scenario).toEqual([5, 1, 4, 1, 4, 3, 3, 1]);
    expect(bridge.lastSpinResult?.roundResult.holdAndWinResult?.boardSize).toBe('5x5');
  });

  it('hands the config and the always empty game state over parsed', () => {
    const bridge = new DragonPotsBridge(recordingTransport());
    const configs: unknown[] = [];
    const states: DragonPotsGameState[] = [];
    bridge.gameConfigReceived.add((config) => configs.push(config));
    bridge.gameStateReceived.add((state) => states.push(state));

    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify({ currency: { code: 'USD' } }) });
    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify(RECORDED_STATE) });

    expect(configs).toEqual([{ currency: { code: 'USD' } }]);
    expect(states).toEqual([{}]);
    expect(bridge.lastGameState).toEqual({});
  });

  it('ignores a command of another mode, a step reply included', () => {
    const bridge = new DragonPotsBridge(recordingTransport());
    const received: unknown[] = [];
    bridge.spinResultReceived.add((spin) => received.push(spin));

    bridge.receive({ type: 'ApplyBonusStepResult', payload: '{}' });
    bridge.receive({ type: 'ApplyDropResult', payload: '{}' });

    expect(received).toEqual([]);
  });

  it('asks for the config and the state, and reports the played round', () => {
    const transport = recordingTransport();
    const bridge = new DragonPotsBridge(transport);

    bridge.requestGameConfig();
    bridge.requestGameState();
    bridge.notifySpinReady();

    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'RequestGameConfig' }, { type: 'RequestGameState' }, { type: 'SpinReady' }]);
  });
});
