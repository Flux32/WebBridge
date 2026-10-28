import type { EngineEvent } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { WheelBridge } from '../src/wheel/WheelBridge';
import { recordingTransport } from './recordingTransport';

const ROUND = {
  status: 'IN_GAME',
  roundId: '42',
  msToNextPhase: 4000,
  winnerColor: null,
  cellIndex: 7,
  inCellOffset: 0.25,
};

describe('WheelBridge', () => {
  it('hands every parsed round snapshot to the wheel', () => {
    const bridge = new WheelBridge(recordingTransport());
    const rounds: unknown[] = [];
    bridge.roundReceived.add((round) => rounds.push(round));

    bridge.receive({ type: 'ApplyRound', payload: JSON.stringify(ROUND) });

    expect(rounds).toEqual([ROUND]);
    expect(bridge.lastRound).toEqual(ROUND);
  });

  it('hands the bet bar metrics over parsed', () => {
    const bridge = new WheelBridge(recordingTransport());
    const metrics = { widthViewport: 1, betBarTopViewport: 0.2, historyTopViewport: 0.25, betBarScale: 1 };
    const received: unknown[] = [];
    bridge.betBarMetricsReceived.add((value) => received.push(value));

    bridge.receive({ type: 'SetWheelBetBarMetrics', payload: JSON.stringify(metrics) });

    expect(received).toEqual([metrics]);
  });

  it('ignores the road ladder and config the host also sends the wheel', () => {
    const bridge = new WheelBridge(recordingTransport());

    expect(() => {
      bridge.receive({ type: 'UpdateCoeffs', payload: [1.1, 1.2] });
      bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify({ coefficients: [1.1] }) });
    }).not.toThrow();
  });

  it('tells the host the outcome has been shown', () => {
    const transport = recordingTransport();
    const bridge = new WheelBridge(transport);

    bridge.notifyRoundShown();

    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'RoundShown' }]);
  });
});
