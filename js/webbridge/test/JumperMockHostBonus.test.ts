import type { EngineCommand, JumperStartBonusPayload } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { DEV_BACKEND_JUMPER_LADDERS } from '../src/jumper/jumperMockLadders';
import { createJumperHost, layoutDraws, LAND, scriptedRandom } from './jumperMockFixtures';
import type { RecordingGame } from './recordingGame';

const DISTANCES: Record<string, number> = { STEP: 1, TRAMPOLINE: 2, JETPACK: 4, ROCKET: 8 };

/** A seeded generator (mulberry32): a varied series that repeats on every run. */
const seededRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const toCents = (amount: string): number => Math.round(Number(amount) * 100);

const startedBonus = (game: RecordingGame): JumperStartBonusPayload => {
  const command = game.received.find((received) => received.type === 'StartBonus');
  if (command?.type !== 'StartBonus') throw new Error('The host sent no StartBonus');
  return command.payload as JumperStartBonusPayload; // The jumper mock only ever sends a jumper series.
};

describe('JumperMockHost bonus', () => {
  it.each([1, 2, 3, 4, 5])('settles routes that follow the ladder and add up (seed %i)', (seed) => {
    const { host, game } = createJumperHost({ difficulty: 'HARD', betAmount: '0.30', random: seededRandom(seed) });
    const coefficients = DEV_BACKEND_JUMPER_LADDERS[2]!.coefficients;

    host.buyBonus();

    const bonus = startedBonus(game);
    expect(bonus).toMatchObject({ difficulty: 'HARD', betAmount: '0.30', currency: 'USD' });
    expect(bonus.games.length).toBeGreaterThanOrEqual(3);
    expect(bonus.games.length).toBeLessThanOrEqual(10);
    for (const { route, finalStep, coefficient } of bonus.games) {
      expect(route[0]?.step).toBe(0);
      route.slice(1).forEach((point, index) => {
        const previous = route[index]!;
        expect(point.step).toBe(previous.step + DISTANCES[previous.action]!);
      });
      const lastJump = route.at(-1)!;
      expect(lastJump.step + DISTANCES[lastJump.action]!).toBe(finalStep);
      expect(coefficient).toBe(coefficients[finalStep]);
    }
    const coefficientCents = bonus.games.reduce((sum, game) => sum + toCents(game.coefficient), 0);
    expect(toCents(bonus.totalCoefficient)).toBe(coefficientCents);
    expect(toCents(bonus.totalWin)).toBe(Math.round((coefficientCents * 30) / 100));
  });

  it('pays exact decimal sums', () => {
    // Three games (count draw 0), each: a plain jump from step 0, then stop on step 1 (EASY 1.04).
    const freeGame = [0.1, 0];
    const draws = [0, ...freeGame, ...freeGame, ...freeGame];
    const { host, game } = createJumperHost({ betAmount: '0.10', loseChance: 0.5, random: scriptedRandom(draws) });

    host.buyBonus();

    expect(startedBonus(game)).toMatchObject({ totalCoefficient: '3.12', totalWin: '0.31' });
  });

  it('locks the bar until the engine ends the series', () => {
    const { host, game } = createJumperHost({ random: seededRandom(7) });
    host.buyBonus();

    host.emit({ type: 'RequestPlay' });

    expect(game.received.at(-1)).toEqual<EngineCommand>({ type: 'DisabledPlayPressed' });
    expect(host.isBonusActive).toBe(true);

    host.emit({ type: 'BonusEnded' });

    expect(host.isBonusActive).toBe(false);
  });

  it('is not sold during a live round', () => {
    const { host, game } = createJumperHost({ random: scriptedRandom([...layoutDraws({}), LAND]) });
    host.emit({ type: 'RequestPlay' });
    host.emit({ type: 'SpinReady' });

    host.buyBonus();

    expect(game.received.map((command) => command.type)).not.toContain('StartBonus');
  });
});
