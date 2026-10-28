/**
 * The crush round as the engine sees it: the host sends only whether a step survived
 * (`ApplyStepResult.isWinMain`), never which step it was, so the engine counts steps itself and reads
 * the coefficient from the ladder (`UpdateCoeffs`) at its own index.
 */
import type { StepResultPayload } from '@omega/webbridge-protocol';

/**
 * The ladder as it crosses the bridge. The protocol types it `number[]`, but the shell forwards the
 * server's config as is, and the backend sends decimal strings (`"1.03"`).
 */
export const toLadder = (values: readonly unknown[]): number[] | null => {
  const ladder = values.map((value) => (typeof value === 'string' ? Number(value) : value));
  return ladder.every((value): value is number => typeof value === 'number' && Number.isFinite(value)) ? ladder : null;
};

export type CrushStepOutcome = 'advance' | 'top' | 'crush';

/** In front of the first step: right after `play`, before the first `step` lands. */
export const START_STEP = -1;

export class CrushRound {
  private currentStep = START_STEP;

  public constructor(private ladder: readonly number[]) {}

  public get step(): number {
    return this.currentStep;
  }

  public get steps(): readonly number[] {
    return this.ladder;
  }

  /** The coefficient of the step the player stands on; null in front of the first one. */
  public get coefficient(): number | null {
    return this.ladder[this.currentStep] ?? null;
  }

  public setLadder(ladder: readonly number[]): void {
    this.ladder = ladder;
  }

  /** A lost step still moves the player onto the step it aimed at: that is where the block falls. */
  public applyStep(result: StepResultPayload): CrushStepOutcome {
    this.currentStep += 1;
    if (!result.isWinMain) return 'crush';
    return this.currentStep >= this.ladder.length - 1 ? 'top' : 'advance';
  }

  /** A live round restored after a reload: `lineNumber` of the server state. */
  public restore(step: number): void {
    this.currentStep = step;
  }

  public reset(): void {
    this.currentStep = START_STEP;
  }
}
