/**
 * One live jumper round as the dev backend keeps it: the slot layout drawn on
 * `play`, which slots the player has seen, and where they stand. Builds the
 * round states the server replies with (RoadFrontent `src/modes/jumper/PROTOCOL.md`).
 */
import type {
  JUMPER_START_STEP,
  JumperLadder,
  JumperRoundState,
  JumperSlot,
  JumperVisitedStep,
} from '@omega/webbridge-protocol';
import { acceleratorDistance, coefficientAt, lastStepOf } from './jumperMockLadders';
import { multiplyAmount } from './jumperMockMoney';
import type { JumperSlotContent } from './jumperMockOptions';

const ZERO = '0';

/**
 * The protocol's start step, bound to it by type: the package runs on its pinned protocol
 * release, and a runtime import of a constant newer than the pin would be `undefined`.
 */
const START_STEP: typeof JUMPER_START_STEP = -1;

/** The bet a round is played for, as the server formats money. */
export interface JumperMockBet {
  readonly amount: string;
  readonly decimalPlaces: number;
}

interface Landing {
  readonly landingStep: number;
  readonly visitedSteps: JumperVisitedStep[];
}

/** The state of a session with no live round. */
export const idleJumperState = (ladder: JumperLadder): JumperRoundState => ({
  status: 'none',
  difficulty: ladder.difficulty,
  coeff: ZERO,
  winAmount: ZERO,
  slots: [],
  lineNumber: START_STEP,
  landingStep: START_STEP,
  visitedSteps: [],
});

export class JumperMockRound {
  private readonly revealedSteps = new Set<number>();
  private current: JumperRoundState;

  public constructor(
    private readonly ladder: JumperLadder,
    private readonly bet: JumperMockBet,
    private readonly layout: ReadonlyMap<number, JumperSlotContent>,
  ) {
    this.current = { ...idleJumperState(ladder), status: 'in-game', slots: this.describeSlots() };
  }

  public get state(): JumperRoundState {
    return this.current;
  }

  /** Cash out needs a jump behind: the server refuses `payout` right after `play`. */
  public get hasJumped(): boolean {
    return this.current.landingStep !== START_STEP;
  }

  /** The next jump: to `landingStep + 1`, then through the accelerator chain from there. */
  public jump(isFall: boolean): JumperRoundState {
    const lineNumber = this.current.landingStep + 1;
    const landing = this.resolveLanding(lineNumber);
    this.reveal(lineNumber, landing.landingStep);
    const moved: JumperRoundState = { ...this.current, ...landing, lineNumber, slots: this.describeSlots() };
    this.current = isFall ? this.fall(moved) : this.land(moved);
    return this.current;
  }

  /** Close the round with the win so far; `collisionPosition` is where the next jump would have fallen. */
  public payout(): JumperRoundState {
    this.current = { ...this.current, status: 'win', collisionPosition: this.current.landingStep + 1 };
    return this.current;
  }

  private resolveLanding(lineNumber: number): Landing {
    const lastStep = lastStepOf(this.ladder);
    const visitedSteps: JumperVisitedStep[] = [];
    let step = lineNumber;
    let content = this.layout.get(step);
    while (content !== undefined && content !== 'NONE') {
      visitedSteps.push({ step, accelerator: content });
      step = Math.min(step + acceleratorDistance(this.ladder, content), lastStep);
      content = this.layout.get(step);
    }
    return { landingStep: step, visitedSteps };
  }

  private fall(moved: JumperRoundState): JumperRoundState {
    return { ...moved, status: 'lose', coeff: ZERO, winAmount: ZERO, collisionPosition: moved.landingStep };
  }

  private land(moved: JumperRoundState): JumperRoundState {
    const coeff = coefficientAt(this.ladder, moved.landingStep);
    const winAmount = multiplyAmount(this.bet.amount, coeff, this.bet.decimalPlaces);
    if (moved.landingStep < lastStepOf(this.ladder)) return { ...moved, coeff, winAmount };

    // At the top there is nothing left to fall from: as in a bought bonus, the collision lies off the ladder.
    return { ...moved, status: 'win', coeff, winAmount, collisionPosition: this.ladder.coefficients.length };
  }

  /** Every slot the player landed on or flew over shows what it holds. */
  private reveal(fromStep: number, toStep: number): void {
    this.layout.forEach((_, step) => {
      if (step >= fromStep && step <= toStep) this.revealedSteps.add(step);
    });
  }

  private describeSlots(): JumperSlot[] {
    return Array.from(this.layout, ([step, content]) => ({
      step,
      state: this.revealedSteps.has(step) ? content : 'HIDDEN',
    }));
  }
}
