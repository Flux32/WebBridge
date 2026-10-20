import type {
  JUMPER_START_STEP,
  EngineEvent,
  JumperGameConfigPayload,
  JumperMovePayload,
  JumperRoundState,
  JumperStartBonusPayload,
  TwistStartBonusPayload,
} from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import type { RestartRequest } from '../src/crush/CrushBridge';
import { JumperBridge } from '../src/jumper/JumperBridge';
import { recordingTransport } from './recordingTransport';

/** `JUMPER_START_STEP`, bound by type: the tests run on the pinned protocol release, not its source. */
const START_STEP: typeof JUMPER_START_STEP = -1;

const CONFIG: JumperGameConfigPayload = {
  ladders: [
    {
      difficulty: 'EASY',
      coefficients: ['1.01', '1.04', '1.09'],
      accelerators: [{ accelerator: 'TRAMPOLINE', steps: 2 }],
      bonusBuyMultiplier: 100,
    },
  ],
};

const OPEN_ROUND: JumperRoundState = {
  status: 'in-game',
  difficulty: 'EASY',
  coeff: '0',
  winAmount: '0',
  slots: [{ step: 1, state: 'HIDDEN' }],
  lineNumber: START_STEP,
  landingStep: START_STEP,
  visitedSteps: [],
};

const MOVE: JumperMovePayload = {
  ...OPEN_ROUND,
  move: 'step',
  coeff: '1.09',
  slots: [{ step: 1, state: 'TRAMPOLINE' }],
  lineNumber: 1,
  landingStep: 3,
  visitedSteps: [{ step: 1, accelerator: 'TRAMPOLINE' }],
};

const BONUS: JumperStartBonusPayload = {
  difficulty: 'EASY',
  betAmount: '1.00',
  currency: 'USD',
  games: [{ finalStep: 1, coefficient: '1.04', route: [{ step: 0, action: 'STEP' }] }],
  totalCoefficient: '1.04',
  totalWin: '1.04',
};

const record = <T>(signal: { add(handler: (value: T) => void): unknown }): T[] => {
  const values: T[] = [];
  signal.add((value) => values.push(value));
  return values;
};

describe('JumperBridge commands', () => {
  it('parses the ladders and keeps them for late subscribers', () => {
    const bridge = new JumperBridge(recordingTransport());
    const configs = record(bridge.gameConfigReceived);

    bridge.receive({ type: 'ApplyGameConfig', payload: JSON.stringify(CONFIG) });

    expect(configs).toEqual([CONFIG]);
    expect(bridge.lastGameConfig).toEqual(CONFIG);
  });

  it('parses the restored round', () => {
    const bridge = new JumperBridge(recordingTransport());
    const states = record(bridge.gameStateReceived);

    bridge.receive({ type: 'ApplyGameState', payload: JSON.stringify(OPEN_ROUND) });

    expect(states).toEqual([OPEN_ROUND]);
    expect(bridge.lastGameState).toEqual(OPEN_ROUND);
  });

  it('hands a move to the game and makes it the current round', () => {
    const bridge = new JumperBridge(recordingTransport());
    const moves = record(bridge.moveReceived);

    bridge.receive({ type: 'ApplyJumperMove', payload: MOVE });

    expect(moves).toEqual([MOVE]);
    expect(bridge.lastGameState).toEqual(MOVE);
  });

  it('reports and keeps the difficulty', () => {
    const bridge = new JumperBridge(recordingTransport());
    const difficulties = record(bridge.difficultyChanged);

    bridge.receive({ type: 'SetJumperDifficulty', payload: 'HARD' });

    expect(difficulties).toEqual(['HARD']);
    expect(bridge.lastDifficulty).toBe('HARD');
  });

  it('reports the autoplay switch', () => {
    const bridge = new JumperBridge(recordingTransport());
    const switches = record(bridge.autoplayChanged);

    bridge.receive({ type: 'SetAutoplay', payload: true });

    expect(switches).toEqual([true]);
  });

  it('splits the restart into its reason and amount', () => {
    const bridge = new JumperBridge(recordingTransport());
    const restarts = record(bridge.restartRequested);

    bridge.receive({ type: 'RestartRound', payload: 'cashout|1.09 USD' });
    bridge.receive({ type: 'RestartRound', payload: '' });

    expect(restarts).toEqual<RestartRequest[]>([
      { reason: 'cashout', amount: '1.09 USD' },
      { reason: '', amount: '' },
    ]);
  });

  it('starts a jumper bonus series', () => {
    const bridge = new JumperBridge(recordingTransport());
    const bonuses = record(bridge.bonusStartRequested);

    bridge.receive({ type: 'StartBonus', payload: BONUS });

    expect(bonuses).toEqual([BONUS]);
  });

  it('ignores another mode\'s bonus', () => {
    const bridge = new JumperBridge(recordingTransport());
    const bonuses = record(bridge.bonusStartRequested);
    const twistBonus: TwistStartBonusPayload = { totalRounds: 3, spins: [] };

    bridge.receive({ type: 'StartBonus', payload: twistBonus });

    expect(bonuses).toEqual([]);
  });
});

describe('JumperBridge notifications', () => {
  it('reports the end of a jump and the bonus lifecycle', () => {
    const transport = recordingTransport();
    const bridge = new JumperBridge(transport);

    bridge.notifySpinReady();
    bridge.notifyBonusActive();
    bridge.saveBonusProgress({ game: 2 });
    bridge.notifyBonusEnded();
    bridge.requestPlay();

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'SpinReady' },
      { type: 'BonusActive' },
      { type: 'BonusProgressSave', raw: '{"game":2}' },
      { type: 'BonusEnded' },
      { type: 'RequestPlay' },
    ]);
  });
});
