/**
 * The dev page's stand-in for the twist backend: a session of filled sectors and the raw replies the shell
 * forwards. The amounts are illustrative, worked out from the sector table at a bet of 1; the real money is
 * the server's. Money and coefficients go out as strings, the way the platform sends them.
 */
import { EMPTY_PROGRESS, progressCoefficient, sectorCellCount, TWIST_SECTORS, type TwistProgress, type TwistSector } from './twistTable';
import type { TwistOutcome } from './twistSpin';

const OUTCOME_WEIGHTS: readonly (readonly [TwistOutcome, number])[] = [
  ['fire', 0.18], ['earth', 0.22], ['water', 0.26], ['air', 0.24], ['death', 0.07],
];
const BET = 1;
const CURRENCY = 'USD';

const rollOutcome = (outcomes: readonly (readonly [TwistOutcome, number])[]): TwistOutcome => {
  const total = outcomes.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [outcome, weight] of outcomes) {
    roll -= weight;
    if (roll <= 0) return outcome;
  }
  return 'air';
};

const isSector = (outcome: TwistOutcome): outcome is TwistSector => outcome !== 'death' && outcome !== 'air';
const money = (coefficient: number): string => (coefficient * BET).toFixed(2);

export class TwistMockSession {
  private progress: Record<TwistSector, number> = { ...EMPTY_PROGRESS };
  public isLive = false;

  public get fullSector(): TwistSector | null {
    return TWIST_SECTORS.find((sector) => this.progress[sector] >= sectorCellCount(sector)) ?? null;
  }

  public get cashoutAmount(): string {
    return money(progressCoefficient(this.progress));
  }

  public spin(): Record<string, unknown> {
    const outcome = rollOutcome(OUTCOME_WEIGHTS);
    if (isSector(outcome)) this.progress[outcome] = Math.min(sectorCellCount(outcome), this.progress[outcome] + 1);
    const isDeath = outcome === 'death';
    const reply = { ...this.state(), outcome, sessionIsFinished: isDeath, isFinished: isDeath, status: isDeath ? 'lose' : 'in-game' };
    this.isLive = !isDeath;
    if (isDeath) this.progress = { ...EMPTY_PROGRESS };
    return reply;
  }

  /** The shell's PART CASHOUT: one cell off every filled sector; `null` while no sector has two. */
  public partCashout(): Record<string, unknown> | null {
    if (!TWIST_SECTORS.some((sector) => this.progress[sector] >= 2)) return null;
    const before = progressCoefficient(this.progress);
    for (const sector of TWIST_SECTORS) this.progress[sector] = Math.max(0, this.progress[sector] - 1);
    return { ...this.state(), isFinished: true, isWin: true, winAmount: money(before - progressCoefficient(this.progress)) };
  }

  /** The host pays a sector filled to its bonus cell on its own: the sector empties. */
  public collectBonus(sector: TwistSector): Record<string, unknown> {
    this.progress[sector] = 0;
    return this.state();
  }

  public close(): void {
    this.progress = { ...EMPTY_PROGRESS };
    this.isLive = false;
  }

  /** A bought series: free spins without death, the board filling from empty. */
  public bonusSeries(count: number): { totalRounds: number; spins: string[]; winAmount: string } {
    const board: Record<TwistSector, number> = { ...EMPTY_PROGRESS };
    const spins = Array.from({ length: count }, () => {
      const outcome = rollOutcome(OUTCOME_WEIGHTS.filter(([candidate]) => candidate !== 'death'));
      if (isSector(outcome)) board[outcome] = Math.min(sectorCellCount(outcome) - 1, board[outcome] + 1);
      return JSON.stringify({ outcome, progress: { ...board }, autoWinCoeff: '0' });
    });
    return { totalRounds: count, spins, winAmount: money(progressCoefficient(board)) };
  }

  public state(): Record<string, unknown> {
    const progress: TwistProgress = { ...this.progress };
    const fullSector = this.fullSector;
    return {
      status: this.isLive ? 'in-game' : 'none',
      betAmount: String(BET),
      currency: CURRENCY,
      coeff: String(progressCoefficient(progress)),
      progress,
      sessionIsFinished: false,
      bonus: fullSector === null ? { hasBonus: false } : { hasBonus: true, coeff: String(progressCoefficient({ ...EMPTY_PROGRESS, [fullSector]: progress[fullSector] })) },
    };
  }
}
