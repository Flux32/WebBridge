import type { EngineEvent } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { PlinkoBridge } from '../src/plinko/PlinkoBridge';
import { recordingTransport } from './recordingTransport';

const DROP_RESULT = { status: 'win', coeff: 1.5, resultPosition: 7, risk: 'low', winAmount: '1.50' };

describe('PlinkoBridge', () => {
  it('hands the parsed drop result to the board and keeps it as the latest state', () => {
    const bridge = new PlinkoBridge(recordingTransport());
    const received: unknown[] = [];
    bridge.dropResultReceived.add((result) => received.push(result));

    bridge.receive({ type: 'ApplyDropResult', payload: JSON.stringify(DROP_RESULT) });

    expect(received).toEqual([DROP_RESULT]);
    expect(bridge.lastDropResult).toEqual(DROP_RESULT);
    expect(bridge.lastGameState).toEqual(DROP_RESULT);
  });

  it('hands the parsed game config to the board and keeps it', () => {
    const bridge = new PlinkoBridge(recordingTransport());
    const config = { currency: 'USD', coefficients: { low: [5, 1, 0.5] } };
    const received: unknown[] = [];
    bridge.gameConfigReceived.add((value) => received.push(value));

    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify(config) });

    expect(received).toEqual([config]);
    expect(bridge.lastGameConfig).toEqual(config);
  });

  it('hands the parsed game state to the board and keeps it', () => {
    const bridge = new PlinkoBridge(recordingTransport());
    const state = { status: 'none' };
    const received: unknown[] = [];
    bridge.gameStateReceived.add((value) => received.push(value));

    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify(state) });

    expect(received).toEqual([state]);
    expect(bridge.lastGameState).toEqual(state);
  });

  it('tells the host the ball has landed', () => {
    const transport = recordingTransport();
    const bridge = new PlinkoBridge(transport);

    bridge.notifyDropFinished();

    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'DropFinished' }]);
  });

  it('asks the host for the game config and state', () => {
    const transport = recordingTransport();
    const bridge = new PlinkoBridge(transport);

    bridge.requestGameConfig();
    bridge.requestGameState();

    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'RequestGameConfig' }, { type: 'RequestGameState' }]);
  });
});
