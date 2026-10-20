import type { EngineCommand, JumperMovePayload } from '@omega/webbridge-protocol';
import { JumperMockHost, type JumperMockHostOptions, type JumperSlotContent } from '../src/jumper/JumperMockHost';
import { recordingGame, type RecordingGame } from './recordingGame';

/** Steps of the default EASY ladder that can hold a slot: every one below the top (39). */
export const EASY_SLOT_STEPS = 39;

/** With equal weights a draw maps onto the weight order NONE, TRAMPOLINE, JETPACK, ROCKET. */
const CONTENT_DRAW: Record<JumperSlotContent, number> = { NONE: 0.1, TRAMPOLINE: 0.3, JETPACK: 0.6, ROCKET: 0.9 };

export const LAND = 0.99;
export const FALL = 0;

/** A random source that plays the given draws in order and fails the test once they run out. */
export const scriptedRandom = (draws: number[]): (() => number) => {
  const queue = [...draws];
  return () => {
    const draw = queue.shift();
    if (draw === undefined) throw new Error('scriptedRandom: the test did not script this draw');
    return draw;
  };
};

/**
 * The draws `play` spends opening a round with a slot on every step below the
 * top: the slot count, the shuffle, then each slot's content in step order.
 * Steps missing from `accelerators` hold an empty (`NONE`) slot.
 */
export const layoutDraws = (accelerators: Partial<Record<number, JumperSlotContent>>): number[] => {
  const contents = Array.from({ length: EASY_SLOT_STEPS }, (_, step) => accelerators[step] ?? 'NONE');
  return [0, ...contents.map(() => 0), ...contents.map((content) => CONTENT_DRAW[content])];
};

export interface JumperMockFixture {
  readonly host: JumperMockHost;
  readonly game: RecordingGame;
}

export const createJumperHost = (options: Partial<JumperMockHostOptions> = {}): JumperMockFixture => {
  const host = new JumperMockHost({
    slotCount: { min: EASY_SLOT_STEPS, max: EASY_SLOT_STEPS },
    slotWeights: { NONE: 1, TRAMPOLINE: 1, JETPACK: 1, ROCKET: 1 },
    ...options,
  });
  const game = recordingGame();
  host.attach(game);
  return { host, game };
};

export const movesOf = (game: RecordingGame): JumperMovePayload[] =>
  game.received.flatMap((command) => (command.type === 'ApplyJumperMove' ? [command.payload] : []));

export const lastMove = (game: RecordingGame): JumperMovePayload => {
  const move = movesOf(game).at(-1);
  if (move === undefined) throw new Error('The host sent no ApplyJumperMove');
  return move;
};

export const commandTypes = (commands: EngineCommand[]): EngineCommand['type'][] =>
  commands.map((command) => command.type);
