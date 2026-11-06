import type { EngineEvent, JokerSlotGameState, JokerSlotSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { JokerSlotBridge } from '../src/joker-slot/JokerSlotBridge';
import { RECORDED_STATE, recorded } from './jokerSlotFixtures';
import { recordingTransport } from './recordingTransport';

describe('JokerSlotBridge', () => {
  it('hands the whole round — every bonus board included — to the scene in one reply', () => {
    const bridge = new JokerSlotBridge(recordingTransport());
    const received: JokerSlotSpinResult[] = [];
    bridge.spinResultReceived.add((spin) => received.push(spin));
    const bonus = recorded('play-buy-x200-2');

    bridge.receive({ type: 'ApplySpinResult', payload: JSON.stringify(bonus) });

    expect(received).toEqual([bonus]);
    expect(bridge.lastSpinResult?.boards).toHaveLength(14);
    expect(bridge.lastSpinResult?.actions[0]?.[0]?.action).toBe('BONUS_BUY');
  });

  it('hands the config and the idle game state over parsed', () => {
    const bridge = new JokerSlotBridge(recordingTransport());
    const configs: unknown[] = [];
    const states: JokerSlotGameState[] = [];
    bridge.gameConfigReceived.add((config) => configs.push(config));
    bridge.gameStateReceived.add((state) => states.push(state));

    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify({ bonusBuyMultiplier: { x75: 75 } }) });
    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify(RECORDED_STATE) });

    expect(configs).toEqual([{ bonusBuyMultiplier: { x75: 75 } }]);
    expect(states).toEqual([{ status: 'none' }]);
  });

  it('ignores a command of another mode, a step reply included', () => {
    const bridge = new JokerSlotBridge(recordingTransport());
    const received: unknown[] = [];
    bridge.spinResultReceived.add((spin) => received.push(spin));

    bridge.receive({ type: 'ApplyBonusStepResult', payload: '{}' });
    bridge.receive({ type: 'ApplyDropResult', payload: '{}' });

    expect(received).toEqual([]);
  });

  it('asks for the config and the state, and reports the played round', () => {
    const transport = recordingTransport();
    const bridge = new JokerSlotBridge(transport);

    bridge.requestGameConfig();
    bridge.requestGameState();
    bridge.notifySpinReady();

    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'RequestGameConfig' }, { type: 'RequestGameState' }, { type: 'SpinReady' }]);
  });
});
