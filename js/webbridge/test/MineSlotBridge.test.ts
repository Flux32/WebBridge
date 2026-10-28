import type { EngineEvent, MineSlotSpinResult } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { MineSlotBridge } from '../src/mine-slot/MineSlotBridge';
import { recordingTransport } from './recordingTransport';

const SPIN: MineSlotSpinResult = {
  status: 'lose',
  betAmount: '100.00',
  currency: 'USD',
  coeff: 0,
  isFinished: true,
  isWin: false,
  winAmount: '0.00',
  rounds: 1,
  boards: ['xb1xxxxxxxxx1x2'],
  field: 'dssrcoddsrgcdssrgoddsrrcddsrgo',
  pickaxes: [{ round: 0, index: 2, brokenBlocks: [{ index: 0, damage: 1 }] }],
  tnt: [],
  chests: [],
};

describe('MineSlotBridge', () => {
  it('hands the parsed spin reply to the scene and keeps it', () => {
    const bridge = new MineSlotBridge(recordingTransport());
    const received: MineSlotSpinResult[] = [];
    bridge.spinResultReceived.add((spin) => received.push(spin));

    bridge.receive({ type: 'ApplySpinResult', payload: JSON.stringify(SPIN) });

    expect(received).toEqual([SPIN]);
    expect(bridge.lastSpinResult).toEqual(SPIN);
  });

  it('hands the config and the session state over parsed', () => {
    const bridge = new MineSlotBridge(recordingTransport());
    const configs: unknown[] = [];
    const states: unknown[] = [];
    bridge.gameConfigReceived.add((config) => configs.push(config));
    bridge.gameStateReceived.add((state) => states.push(state));

    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify({ currency: 'USD' }) });
    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify({ status: 'none' }) });

    expect(configs).toEqual([{ currency: 'USD' }]);
    expect(states).toEqual([{ status: 'none' }]);
  });

  it('ignores a command of another mode', () => {
    const bridge = new MineSlotBridge(recordingTransport());
    const received: unknown[] = [];
    bridge.spinResultReceived.add((spin) => received.push(spin));

    bridge.receive({ type: 'ApplyStepResult', payload: { isWinMain: true, coinsTriggered: false, coinsCollected: [] } });

    expect(received).toEqual([]);
  });

  it('asks for the config and state and reports the played round', () => {
    const transport = recordingTransport();
    const bridge = new MineSlotBridge(transport);

    bridge.requestGameConfig();
    bridge.requestGameState();
    bridge.notifySpinReady();

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'RequestGameConfig' },
      { type: 'RequestGameState' },
      { type: 'SpinReady' },
    ]);
  });
});
