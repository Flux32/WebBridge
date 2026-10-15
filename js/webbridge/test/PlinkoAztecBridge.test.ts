import type { EngineEvent } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import {
  PlinkoAztecBridge,
  type BallsAmountChange,
  type BetPerBallChange,
} from '../src/plinko-aztec/PlinkoAztecBridge';
import { recordingTransport } from './recordingTransport';

const createBridge = (): PlinkoAztecBridge => new PlinkoAztecBridge(recordingTransport());

const recordBallsAmountChanges = (bridge: PlinkoAztecBridge): BallsAmountChange[] => {
  const changes: BallsAmountChange[] = [];
  bridge.ballsAmountChanged.add((change) => changes.push(change));
  return changes;
};

const recordBetPerBallChanges = (bridge: PlinkoAztecBridge): BetPerBallChange[] => {
  const changes: BetPerBallChange[] = [];
  bridge.betPerBallChanged.add((change) => changes.push(change));
  return changes;
};

describe('PlinkoAztecBridge balls amount', () => {
  it('reports the first selection as a sync, not a player step', () => {
    const bridge = createBridge();
    const changes = recordBallsAmountChanges(bridge);

    bridge.receive({ type: 'SetBallsAmount', payload: 20 });

    expect(changes).toEqual<BallsAmountChange[]>([{ amount: 20, previousAmount: 0, direction: 'none' }]);
    expect(bridge.currentBallsAmount).toBe(20);
  });

  it('tells an increase from a decrease', () => {
    const bridge = createBridge();
    bridge.receive({ type: 'SetBallsAmount', payload: 20 });
    const changes = recordBallsAmountChanges(bridge);

    bridge.receive({ type: 'SetBallsAmount', payload: 50 });
    bridge.receive({ type: 'SetBallsAmount', payload: 10 });

    expect(changes).toEqual<BallsAmountChange[]>([
      { amount: 50, previousAmount: 20, direction: 'increased' },
      { amount: 10, previousAmount: 50, direction: 'decreased' },
    ]);
  });

  it('stays silent when the same amount arrives again', () => {
    const bridge = createBridge();
    bridge.receive({ type: 'SetBallsAmount', payload: 20 });
    const changes = recordBallsAmountChanges(bridge);

    bridge.receive({ type: 'SetBallsAmount', payload: 20 });

    expect(changes).toEqual([]);
  });

  it.each([0, -5, 2.5])('ignores %s balls', (amount) => {
    const bridge = createBridge();
    const changes = recordBallsAmountChanges(bridge);

    bridge.receive({ type: 'SetBallsAmount', payload: amount });

    expect(changes).toEqual([]);
    expect(bridge.currentBallsAmount).toBe(0);
  });
});

describe('PlinkoAztecBridge bet per ball', () => {
  it('reports the first bet as a sync and keeps the backend string', () => {
    const bridge = createBridge();
    const changes = recordBetPerBallChanges(bridge);

    bridge.receive({ type: 'SetBetPerBall', payload: '0.2' });

    expect(changes).toEqual<BetPerBallChange[]>([{ betPerBall: '0.2', previousBetPerBall: null, direction: 'none' }]);
    expect(bridge.currentBetPerBall).toBe('0.2');
  });

  it('compares bets by amount, not by text', () => {
    const bridge = createBridge();
    bridge.receive({ type: 'SetBetPerBall', payload: '0.2' });
    const changes = recordBetPerBallChanges(bridge);

    bridge.receive({ type: 'SetBetPerBall', payload: '10' });
    bridge.receive({ type: 'SetBetPerBall', payload: '9.99' });

    expect(changes).toEqual<BetPerBallChange[]>([
      { betPerBall: '10', previousBetPerBall: '0.2', direction: 'increased' },
      { betPerBall: '9.99', previousBetPerBall: '10', direction: 'decreased' },
    ]);
  });

  it('stays silent when the same amount arrives written differently', () => {
    const bridge = createBridge();
    bridge.receive({ type: 'SetBetPerBall', payload: '2' });
    const changes = recordBetPerBallChanges(bridge);

    bridge.receive({ type: 'SetBetPerBall', payload: '2.0' });

    expect(changes).toEqual([]);
    expect(bridge.currentBetPerBall).toBe('2');
  });

  it.each(['', 'abc', '0', '0.00', '-1', '1e3', '1,5'])('ignores the bet "%s"', (betPerBall) => {
    const bridge = createBridge();
    const changes = recordBetPerBallChanges(bridge);

    bridge.receive({ type: 'SetBetPerBall', payload: betPerBall });

    expect(changes).toEqual([]);
    expect(bridge.currentBetPerBall).toBeNull();
  });
});

describe('PlinkoAztecBridge rounds', () => {
  const DROP_RESULT = { status: 'win', coeff: 2, ballsAmount: 2, betPerBall: '0.2', ballsResult: [] };
  const STEP_RESULT = { status: 'in-game', bonusGameState: { result: { level: 1 } } };

  it('hands the parsed drop result to the board and keeps it as the latest state', () => {
    const bridge = createBridge();
    const received: unknown[] = [];
    bridge.dropResultReceived.add((result) => received.push(result));

    bridge.receive({ type: 'ApplyDropResult', payload: JSON.stringify(DROP_RESULT) });

    expect(received).toEqual([DROP_RESULT]);
    expect(bridge.lastDropResult).toEqual(DROP_RESULT);
    expect(bridge.lastGameState).toEqual(DROP_RESULT);
  });

  it('hands the parsed bonus step result to the board and keeps it as the latest state', () => {
    const bridge = createBridge();
    const received: unknown[] = [];
    bridge.stepResultReceived.add((result) => received.push(result));

    bridge.receive({ type: 'ApplyBonusStepResult', payload: JSON.stringify(STEP_RESULT) });

    expect(received).toEqual([STEP_RESULT]);
    expect(bridge.lastStepResult).toEqual(STEP_RESULT);
    expect(bridge.lastGameState).toEqual(STEP_RESULT);
  });

  it('hands the parsed game config to the board and keeps it', () => {
    const bridge = createBridge();
    const config = { ballsAmountOptions: [10, 20, 50], positions: [] };
    const received: unknown[] = [];
    bridge.gameConfigReceived.add((value) => received.push(value));

    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify(config) });

    expect(received).toEqual([config]);
    expect(bridge.lastGameConfig).toEqual(config);
  });
});

describe('PlinkoAztecBridge requests', () => {
  it('sends the step, selection and landing events the host answers', () => {
    const transport = recordingTransport();
    const bridge = new PlinkoAztecBridge(transport);

    bridge.requestStep();
    bridge.requestBallsAmount();
    bridge.requestBetPerBall();
    bridge.notifyDropFinished();

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'RequestStep' },
      { type: 'RequestBallsAmount' },
      { type: 'RequestBetPerBall' },
      { type: 'DropFinished' },
    ]);
  });
});
