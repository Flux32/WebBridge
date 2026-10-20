import type {
  JUMPER_START_STEP,
  EngineCommand,
  JumperGameConfigPayload,
  JumperRoundState,
  JumperSlot,
} from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import {
  commandTypes,
  createJumperHost,
  FALL,
  LAND,
  lastMove,
  layoutDraws,
  movesOf,
  scriptedRandom,
} from './jumperMockFixtures';
import { lastPayload } from './recordingGame';

/** `JUMPER_START_STEP`, bound by type: the tests run on the pinned protocol release, not its source. */
const START_STEP: typeof JUMPER_START_STEP = -1;

const slotAt = (slots: JumperSlot[], step: number): JumperSlot['state'] | undefined =>
  slots.find((slot) => slot.step === step)?.state;

describe('JumperMockHost session', () => {
  it('serves the dev backend ladders', () => {
    const { host, game } = createJumperHost();

    host.emit({ type: 'RequestGameConfig' });

    const config = lastPayload(game, 'ApplyGameConfig') as JumperGameConfigPayload;
    expect(config.ladders.map((ladder) => [ladder.difficulty, ladder.coefficients.length])).toEqual([
      ['EASY', 40],
      ['MEDIUM', 38],
      ['HARD', 35],
    ]);
    expect(config.ladders[2]).toMatchObject({
      coefficients: expect.arrayContaining(['1.04', '192271.88']) as unknown,
      accelerators: [
        { accelerator: 'TRAMPOLINE', steps: 2 },
        { accelerator: 'JETPACK', steps: 4 },
        { accelerator: 'ROCKET', steps: 8 },
      ],
      bonusBuyMultiplier: 100,
    });
  });

  it('pushes the difficulty, the ladders and an idle session when the game is ready', () => {
    const { host, game } = createJumperHost({ difficulty: 'MEDIUM' });

    host.ready();

    expect(game.received[0]).toEqual<EngineCommand>({ type: 'SetJumperDifficulty', payload: 'MEDIUM' });
    expect(commandTypes(game.received)).toEqual(['SetJumperDifficulty', 'ApplyGameConfig', 'ApplyGameState']);
    expect(lastPayload(game, 'ApplyGameState')).toMatchObject<Partial<JumperRoundState>>({
      status: 'none',
      difficulty: 'MEDIUM',
    });
  });

  it('switches the difficulty between rounds', () => {
    const { host, game } = createJumperHost();

    host.setDifficulty('HARD');

    expect(host.difficulty).toBe('HARD');
    expect(game.received).toEqual<EngineCommand[]>([{ type: 'SetJumperDifficulty', payload: 'HARD' }]);
  });

  it('keeps the difficulty through a live round', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), LAND]) });
    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'SpinReady' });

    host.setDifficulty('HARD');

    expect(host.difficulty).toBe('EASY');
    expect(commandTypes(game.received)).not.toContain('SetJumperDifficulty');
  });
});

describe('JumperMockHost round', () => {
  it('opens the round with every slot hidden and plays the first jump to step 0', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), LAND]) });

    host.emit({ type: 'RequestPlay' });

    const [opened, firstJump] = movesOf(game);
    expect(opened).toMatchObject({
      move: 'play',
      status: 'in-game',
      coeff: '0',
      lineNumber: START_STEP,
      landingStep: START_STEP,
      visitedSteps: [],
    });
    expect(opened?.slots).toHaveLength(39);
    expect(opened?.slots.every((slot) => slot.state === 'HIDDEN')).toBe(true);
    expect(firstJump).toMatchObject({ move: 'step', status: 'in-game', lineNumber: 0, landingStep: 0, coeff: '1.01' });
    expect(slotAt(firstJump!.slots, 0)).toBe('NONE');
    expect(slotAt(firstJump!.slots, 1)).toBe('HIDDEN');
  });

  it('throws the player through an accelerator chain and pays the landing step', () => {
    const accelerators = { 1: 'TRAMPOLINE', 3: 'JETPACK', 5: 'ROCKET' } as const;
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws(accelerators), LAND, LAND]) });
    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'SpinReady' });

    host.emit({ type: 'RequestPlay' });

    const jump = lastMove(game);
    expect(jump).toMatchObject({
      status: 'in-game',
      lineNumber: 1,
      landingStep: 7,
      visitedSteps: [
        { step: 1, accelerator: 'TRAMPOLINE' },
        { step: 3, accelerator: 'JETPACK' },
      ],
      coeff: '1.45',
      winAmount: '1.45',
    });
    // Step 5 was flown over: shown, though the player never touched it.
    expect([2, 3, 4, 5, 6, 7].map((step) => slotAt(jump.slots, step))).toEqual([
      'NONE',
      'JETPACK',
      'NONE',
      'ROCKET',
      'NONE',
      'NONE',
    ]);
    expect(slotAt(jump.slots, 8)).toBe('HIDDEN');
  });

  it('closes the round as a win once a chain reaches the top', () => {
    const rockets = { 0: 'ROCKET', 8: 'ROCKET', 16: 'ROCKET', 24: 'ROCKET', 32: 'ROCKET' } as const;
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws(rockets), LAND]) });
    host.emit({ type: 'RequestPlay' });

    expect(lastMove(game)).toMatchObject({ status: 'win', landingStep: 39, coeff: '62.58', collisionPosition: 40 });

    host.emit({ type: 'SpinReady' });

    expect(game.received.at(-1)).toEqual<EngineCommand>({ type: 'RestartRound', payload: 'win|62.58 USD' });
  });

  it('loses the bet on a fall and restarts once the engine has played it', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({ 0: 'TRAMPOLINE' }), FALL]) });

    host.emit({ type: 'RequestPlay' });

    expect(lastMove(game)).toMatchObject({
      status: 'lose',
      coeff: '0',
      winAmount: '0',
      lineNumber: 0,
      landingStep: 2,
      collisionPosition: 2,
    });
    expect(commandTypes(game.received)).not.toContain('RestartRound');

    host.emit({ type: 'SpinReady' });

    expect(game.received.at(-1)).toEqual<EngineCommand>({ type: 'RestartRound', payload: 'lose|' });
  });

  it('holds the next round until the engine has reset the scene after a restart', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), FALL, ...layoutDraws({}), LAND]) });
    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'SpinReady' });

    host.emit({ type: 'RequestPlay' });

    expect(game.received.at(-1)).toEqual<EngineCommand>({ type: 'DisabledPlayPressed' });
    expect(movesOf(game)).toHaveLength(2);
  });

  it('opens a new round after a loss', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), FALL, ...layoutDraws({}), LAND]) });
    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'SpinReady' });
    host.emit({ type: 'SpinReady' });

    host.emit({ type: 'RequestPlay' });

    expect(movesOf(game).map((move) => move.move)).toEqual(['play', 'step', 'play', 'step']);
    expect(lastMove(game)).toMatchObject({ status: 'in-game', lineNumber: 0 });
  });

  it('refuses a move while a jump is in flight', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), LAND, LAND]) });
    host.emit({ type: 'RequestPlay' });

    host.emit({ type: 'RequestPlay' });

    expect(game.received.at(-1)).toEqual<EngineCommand>({ type: 'DisabledPlayPressed' });
    expect(movesOf(game)).toHaveLength(2);

    host.emit({ type: 'SpinReady' });
    host.emit({ type: 'RequestPlay' });

    expect(lastMove(game)).toMatchObject({ lineNumber: 1, landingStep: 1 });
  });

  it('restores the live round on a state request', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), LAND]) });
    host.emit({ type: 'RequestPlay' });

    host.emit({ type: 'RequestGameState' });

    expect(lastPayload(game, 'ApplyGameState')).toMatchObject({ status: 'in-game', landingStep: 0, coeff: '1.01' });
  });
});

describe('JumperMockHost cash out', () => {
  it('presses cash out, pays the round out and restarts with the win', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), LAND]) });
    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'SpinReady' });
    const mark = game.received.length;

    host.cashout();

    expect(commandTypes(game.received.slice(mark))).toEqual(['CashoutPressed', 'ApplyJumperMove', 'RestartRound']);
    expect(lastMove(game)).toMatchObject({ move: 'payout', status: 'win', winAmount: '1.01', collisionPosition: 1 });
    expect(game.received.at(-1)).toEqual<EngineCommand>({ type: 'RestartRound', payload: 'cashout|1.01 USD' });
  });

  it('holds the bar after a cash out until the engine has reset the scene', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), LAND, ...layoutDraws({}), LAND]) });
    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'SpinReady' });
    host.cashout();

    host.emit({ type: 'RequestPlay' });

    expect(game.received.at(-1)).toEqual<EngineCommand>({ type: 'DisabledPlayPressed' });

    host.emit({ type: 'SpinReady' });
    host.emit({ type: 'RequestPlay' });

    expect(movesOf(game).map((move) => move.move)).toEqual(['play', 'step', 'payout', 'play', 'step']);
  });

  it('does not cash out before the first jump has landed', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), LAND]) });
    host.cashout();
    host.emit({ type: 'RequestPlay' });
    const mark = game.received.length;

    host.cashout();

    expect(game.received.slice(mark)).toEqual([]);
  });
});
