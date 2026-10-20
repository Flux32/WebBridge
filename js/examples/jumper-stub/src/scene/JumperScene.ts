/**
 * What the stub shows besides the player: the ladder of the current difficulty, the round's slots,
 * the coefficient and a caption. Plain state — the game writes it, the renderer reads it.
 */
import type {
  JumperBonusGame,
  JumperDifficulty,
  JumperGameConfigPayload,
  JumperLadder,
  JumperRoundState,
  JumperSlot,
  JumperStartBonusPayload,
} from '@omega/webbridge-protocol';
import { collisionStepOf, freeGameSlots } from './routes';

const ZERO_COEFF = '0';
const SHAKE_MS = 350;

export class JumperScene {
  public config: JumperGameConfigPayload | null = null;
  public difficulty: JumperDifficulty | null = null;
  public slots: readonly JumperSlot[] = [];
  public coeff = ZERO_COEFF;
  public caption = 'Waiting for the host…';
  /** Where a closed round ended: the fall, or where a cashed-out player would have fallen. */
  public collisionStep: number | null = null;
  private shakeStartedAt = Number.NEGATIVE_INFINITY;

  /** The ladder of the current difficulty, once both the config and the difficulty are known. */
  public get ladder(): JumperLadder | null {
    return this.config?.ladders.find((ladder) => ladder.difficulty === this.difficulty) ?? null;
  }

  public reset(caption: string): void {
    this.slots = [];
    this.coeff = ZERO_COEFF;
    this.collisionStep = null;
    this.caption = caption;
  }

  /** A restored or freshly opened round. */
  public showRound(state: JumperRoundState, caption: string): void {
    this.difficulty = state.difficulty;
    this.slots = state.slots;
    this.coeff = state.coeff;
    this.collisionStep = state.status === 'in-game' ? null : collisionStepOf(state);
    this.caption = caption;
  }

  public showFreeGame(bonus: JumperStartBonusPayload, game: JumperBonusGame, index: number): void {
    this.difficulty = bonus.difficulty;
    this.slots = freeGameSlots(game);
    this.coeff = ZERO_COEFF;
    this.collisionStep = null;
    this.caption = `Free game ${index + 1}/${bonus.games.length}`;
  }

  public shake(now: number): void {
    this.shakeStartedAt = now;
  }

  /** Horizontal offset of the shake at `now`, 0 when it is over. */
  public shakeOffset(now: number): number {
    const elapsed = now - this.shakeStartedAt;
    if (elapsed >= SHAKE_MS) return 0;
    return Math.sin(elapsed / 18) * 10 * (1 - elapsed / SHAKE_MS);
  }

  public isShaking(now: number): boolean {
    return now - this.shakeStartedAt < SHAKE_MS;
  }
}
