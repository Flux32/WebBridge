/**
 * What the jumper view shows besides the player: the ladder of the current difficulty, the round's slots,
 * the coefficient and the round's phase. Plain state — the controller writes it, the view reads it.
 */
import type { JumperDifficulty } from '@omega/webbridge-protocol';
import type { JumperBonus, JumperRound, JumperSlotView } from './jumperModel';
import { freeGameSlots } from './jumperRoute';

export type JumperPhase = 'waiting' | 'idle' | 'open' | 'playing' | 'fell' | 'won' | 'cashed' | 'bonus';

export class JumperScene {
  public ladders: ReadonlyMap<JumperDifficulty, readonly number[]> = new Map();
  public difficulty: JumperDifficulty | null = null;
  public slots: readonly JumperSlotView[] = [];
  /** The coefficient the player stands on; null in front of the first step. */
  public coefficient: number | null = null;
  /** Where a closed round ended: the fall, or where a cashed-out player would have fallen. */
  public collisionStep: number | null = null;
  public phase: JumperPhase = 'waiting';
  /** The last closed round, or a free game's place in the series. */
  public note = '';

  public get ladder(): readonly number[] {
    return this.difficulty === null ? [] : (this.ladders.get(this.difficulty) ?? []);
  }

  public reset(note: string): void {
    this.slots = [];
    this.coefficient = null;
    this.collisionStep = null;
    this.phase = 'idle';
    this.note = note;
  }

  /** A round as the server describes it: restored, opened or after a jump. */
  public showRound(round: JumperRound): void {
    this.difficulty = round.difficulty;
    this.slots = round.slots;
    this.coefficient = round.landingStep < 0 ? null : round.coefficient;
    this.collisionStep = round.status === 'in-game' ? null : round.collisionStep;
  }

  public showFreeGame(bonus: JumperBonus, index: number): void {
    const game = bonus.games[index];
    this.difficulty = bonus.difficulty;
    this.slots = game === undefined ? [] : freeGameSlots(game);
    this.coefficient = null;
    this.collisionStep = null;
    this.phase = 'bonus';
    this.note = `Free game ${index + 1} of ${bonus.games.length}`;
  }
}
