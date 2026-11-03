/**
 * Dragon Pots on the bridge. One `ApplySpinResult` is the whole round, played in the server's order: the
 * reels stop and the ways pay, the coins fly into their pots and the triggered pots burst, the jackpot pick
 * reveals its tiles, the Hold & Win plays try by try — and only after the round's total does the host hear
 * the single `SpinReady`, a bought bonus included. `ApplyGameState` is always `{}`: nothing to resume.
 */
import { BridgeLogger, type DragonPotsBridge } from '@omega/webbridge-js';
import type { DragonPotsJackpotTile, DragonPotsPotColor } from '@omega/webbridge-protocol';
import { MoveQueue } from '../../kit/MoveQueue';
import type { HoldAndWinCoin, HoldAndWinPlan, JackpotPlan } from './dragonPotsFeatures';
import { DragonPotsRoundError } from './dragonPotsRead';
import { planDragonPotsRound, type CoinDrop, type DragonPotsPlan, type WayPlan } from './dragonPotsRound';

export interface DragonPotsMotions {
  spin(plan: DragonPotsPlan): Promise<boolean>;
  showWays(ways: readonly WayPlan[]): Promise<boolean>;
  /** The coins leave their cells for their pots. */
  dropCoins(coins: readonly CoinDrop[]): Promise<boolean>;
  burstPots(pots: readonly DragonPotsPotColor[]): Promise<boolean>;
  openJackpot(): Promise<boolean>;
  revealTile(index: number): Promise<boolean>;
  winJackpot(jackpot: JackpotPlan): Promise<boolean>;
  openHoldAndWin(plan: HoldAndWinPlan): Promise<boolean>;
  /** One try: the empty cells spin. */
  respin(): Promise<boolean>;
  /** A coin lands and collects the board. */
  landCoin(coin: HoldAndWinCoin): Promise<boolean>;
  closeHoldAndWin(winAmount: number): Promise<boolean>;
  /** The round's win after a feature: the server's `winAmount`. */
  showTotal(totalWin: number): Promise<boolean>;
  celebrate(): void;
}

export type DragonPotsPhase = 'idle' | 'spinning' | 'paying' | 'pots' | 'jackpot' | 'holdAndWin' | 'total' | 'broken';

export interface JackpotView {
  readonly revealed: DragonPotsJackpotTile[];
  won: DragonPotsJackpotTile | null;
}

export interface HoldAndWinView {
  readonly rows: number;
  readonly columns: number;
  /** Coin value in base bets by board cell. */
  readonly coins: Map<number, number>;
  respinsLeft: number;
  total: number;
}

/** Ticks of a pot's fill; one short of full until the pot triggers. */
export const POT_TICKS = 5;
const TRIES_PER_SPIN = 3;

export class DragonPotsController {
  public phase: DragonPotsPhase = 'idle';
  public lastResult = '';
  public win = 0;
  public currency = '';
  public featureName = '';
  public plan: DragonPotsPlan | null = null;
  public readonly pots: Record<DragonPotsPotColor, number> = { Red: 0, Green: 0, Blue: 0 };
  public jackpot: JackpotView | null = null;
  public holdAndWin: HoldAndWinView | null = null;
  private readonly queue = new MoveQueue();
  private readonly unsubscribe: () => void;

  public constructor(
    private readonly bridge: DragonPotsBridge,
    private readonly motions: DragonPotsMotions,
  ) {
    this.unsubscribe = bridge.spinResultReceived.add((reply) => this.queue.enqueue(() => this.playRound(reply)));
  }

  public get isFastGame(): boolean {
    return this.bridge.isFastGameEnabled;
  }

  public destroy(): void {
    this.queue.close();
    this.unsubscribe();
  }

  private async playRound(reply: unknown): Promise<boolean> {
    const plan = this.planOf(reply);
    if (plan === null) return true;
    this.begin(plan);
    const isPlayed =
      (await this.playBase(plan)) &&
      (await this.playPots(plan)) &&
      (plan.jackpot === null || (await this.playJackpot(plan.jackpot))) &&
      (plan.holdAndWin === null || (await this.playHoldAndWin(plan.holdAndWin)));
    if (!isPlayed) return false;
    return this.finish(plan);
  }

  private begin(plan: DragonPotsPlan): void {
    this.plan = plan;
    this.win = 0;
    this.currency = plan.currency;
    this.featureName = '';
    this.jackpot = null;
    this.holdAndWin = null;
  }

  private async playBase(plan: DragonPotsPlan): Promise<boolean> {
    this.phase = 'spinning';
    if (!(await this.motions.spin(plan))) return false;
    if (plan.ways.length === 0) return true;
    this.phase = 'paying';
    this.win = plan.baseWin;
    return this.motions.showWays(plan.ways);
  }

  private async playPots(plan: DragonPotsPlan): Promise<boolean> {
    if (plan.coins.length === 0) return true;
    this.phase = 'pots';
    if (!(await this.motions.dropCoins(plan.coins))) return false;
    for (const coin of plan.coins) {
      const isTriggered = plan.triggered.includes(coin.color);
      this.pots[coin.color] = isTriggered ? POT_TICKS : Math.min(POT_TICKS - 1, this.pots[coin.color] + 1);
    }
    if (plan.triggered.length === 0) return true;
    this.featureName = plan.featureName;
    if (!(await this.motions.burstPots(plan.triggered))) return false;
    plan.triggered.forEach((pot) => (this.pots[pot] = 0));
    return true;
  }

  private async playJackpot(jackpot: JackpotPlan): Promise<boolean> {
    this.phase = 'jackpot';
    const view: JackpotView = { revealed: [], won: null };
    this.jackpot = view;
    if (!(await this.motions.openJackpot())) return false;
    for (const [index, tile] of jackpot.tiles.entries()) {
      view.revealed.push(tile);
      if (!(await this.motions.revealTile(index))) return false;
    }
    view.won = jackpot.won;
    this.win += jackpot.winAmount;
    if (!(await this.motions.winJackpot(jackpot))) return false;
    this.jackpot = null;
    return true;
  }

  private async playHoldAndWin(plan: HoldAndWinPlan): Promise<boolean> {
    this.phase = 'holdAndWin';
    const view: HoldAndWinView = { rows: plan.rows, columns: plan.columns, coins: new Map(plan.initial.map((coin) => [coin.cell, coin.coeff])), respinsLeft: TRIES_PER_SPIN, total: 0 };
    this.holdAndWin = view;
    const winBefore = this.win;
    if (!(await this.motions.openHoldAndWin(plan))) return false;
    for (const tries of plan.spins) {
      for (const landed of tries) {
        if (!(await this.motions.respin())) return false;
        if (landed.length === 0) {
          view.respinsLeft -= 1;
          continue;
        }
        for (const coin of landed) {
          view.coins.set(coin.cell, coin.coeff);
          view.total = coin.total;
          this.win = winBefore + coin.total;
          if (!(await this.motions.landCoin(coin))) return false;
        }
        view.respinsLeft = TRIES_PER_SPIN;
      }
    }
    if (!(await this.motions.closeHoldAndWin(plan.winAmount))) return false;
    this.holdAndWin = null;
    return true;
  }

  private async finish(plan: DragonPotsPlan): Promise<boolean> {
    this.win = plan.totalWin;
    if (plan.jackpot !== null || plan.holdAndWin !== null) {
      this.phase = 'total';
      if (!(await this.motions.showTotal(plan.totalWin))) return false;
    }
    this.phase = 'idle';
    this.lastResult = plan.totalWin > 0 ? `Won ${plan.totalWin.toFixed(2)} ${plan.currency}` : 'No win';
    if (plan.totalWin > 0) this.motions.celebrate();
    this.bridge.notifySpinReady();
    return true;
  }

  /**
   * The boundary of a reply: one the scene cannot draw truthfully becomes a visible broken state. No
   * `SpinReady` follows — the round was not shown, so the bar stays locked and the fault stays in sight.
   */
  private planOf(reply: unknown): DragonPotsPlan | null {
    try {
      return planDragonPotsRound(reply);
    } catch (error) {
      if (!(error instanceof DragonPotsRoundError)) throw error;
      BridgeLogger.error(`[demo dragon-pots] ApplySpinResult rejected: ${error.message}`);
      this.phase = 'broken';
      this.lastResult = error.message;
      return null;
    }
  }
}
