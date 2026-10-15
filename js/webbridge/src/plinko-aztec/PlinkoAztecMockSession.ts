/**
 * Бэкенд-половина мока Plinko Aztec — зеркало C#-шного `PlinkoAztecMockHost`:
 * собирает те же GameState, что присылает платформа, и хранит то, чем на бою
 * владеет сервер, — прогресс бамперов по каждой комбинации ставки и идущую бонусную
 * игру. Суммы ИЛЛЮСТРАТИВНЫЕ и считаются в number: мок не источник истины по выплатам.
 */
import type { PlinkoAztecMockHostOptions, PlinkoAztecMockScenario } from './plinkoAztecMockOptions';

/** Выбор бет-бара, под который собирается ответ. */
export interface PlinkoAztecBetSelection {
  readonly ballsAmount: number;
  readonly betPerBall: string;
}

interface BallResult {
  readonly position: string;
  readonly coeff: string;
  readonly bonusBumpAmount: number;
}

interface BonusGameResult {
  readonly gameNumber: number;
  readonly level: number;
  readonly progress: number;
  readonly ballPerDrop: number;
  readonly ballsAmount: number;
  readonly freeSpinProgress: number;
  readonly winAmount: string;
}

interface DroppedBalls {
  readonly balls: BallResult[];
  readonly coefficient: number;
  readonly bumps: number;
  readonly isWheelTriggered: boolean;
}

const SPIN_SLOT_LABEL = 'spin';
const BONUS_WHEEL_SECTOR = 'bonus';
const MAX_BUMPS_PER_BALL = 3;

const formatCoefficient = (value: number): string => String(Number(value.toFixed(4)));

export class PlinkoAztecMockSession {
  private bonusProgress: Readonly<Record<string, number>> = {};
  private activeBonus: BonusGameResult | null = null;
  private bonusGamesPlayed = 0;

  public constructor(private readonly options: PlinkoAztecMockHostOptions) {}

  public get isBonusActive(): boolean {
    return this.activeBonus !== null;
  }

  /** Назад к новому игроку: без прогресса бамперов и без бонусной игры. */
  public reset(): void {
    this.bonusProgress = {};
    this.activeBonus = null;
    this.bonusGamesPlayed = 0;
  }

  public buildGameConfig(): object {
    const { slotCoefficients, betPerBallOptions, decimalPlaces, currency, ballsAmountOptions } = this.options;
    const defaultBetPerBall = Number(betPerBallOptions[0]);
    return {
      betConfig: {
        minBetAmount: this.formatAmount(defaultBetPerBall),
        maxBetAmount: this.formatAmount(defaultBetPerBall * 100),
        maxWinAmount: this.formatAmount(defaultBetPerBall * 10000),
        defaultBetAmount: this.formatAmount(defaultBetPerBall),
        decimalPlaces: String(decimalPlaces),
        currency,
      },
      positions: slotCoefficients.map((coefficient) => ({
        coefficient: Math.max(0, coefficient),
        probability: 1 / slotCoefficients.length,
      })),
      ballsAmountOptions,
      showStartupModal: false,
      bonusGameProgress: { ...this.bonusProgress },
    };
  }

  /** Состояние сессии, как его отдаёт платформа на загрузке. */
  public buildGameState(selection: PlinkoAztecBetSelection): object {
    const isFinished = this.activeBonus === null;
    return { ...this.createState(selection), status: isFinished ? 'none' : 'in-game', isFinished };
  }

  /** Ответ на `play`: каждый шарик в своей ячейке, колесо и вход в бонус — если выпали. */
  public buildDropResult(selection: PlinkoAztecBetSelection, scenario: PlinkoAztecMockScenario): object {
    const drop = this.dropBalls(selection.ballsAmount, scenario);
    this.addBonusProgress(selection, drop.bumps);

    const win = drop.coefficient * Number(selection.betPerBall);
    if (!drop.isWheelTriggered) return this.createRoundState(selection, drop, win);

    if (scenario === 'bonus-game') {
      this.startBonusGame();
      const freeSpinResult = { position: BONUS_WHEEL_SECTOR, coeff: formatCoefficient(0), winAmount: this.formatAmount(0) };
      return { ...this.createRoundState(selection, drop, win), freeSpinResult };
    }

    const wheelCoefficient = this.options.fortuneWheelCoefficient;
    const wheelWin = win * wheelCoefficient;
    const freeSpinResult = {
      position: formatCoefficient(wheelCoefficient),
      coeff: formatCoefficient(wheelCoefficient),
      winAmount: this.formatAmount(wheelWin),
    };
    return { ...this.createRoundState(selection, drop, wheelWin), freeSpinResult };
  }

  /** Ответ на `step`: один бросок бонусной игры, её счётчики продвинуты. */
  public buildStepResult(selection: PlinkoAztecBetSelection): object {
    const bonus = this.activeBonus;
    if (bonus === null) throw new Error('PlinkoAztecMockSession: шаг бонуса без идущей бонусной игры');

    const drop = this.dropBalls(bonus.ballPerDrop, 'random');
    const stepWin = drop.coefficient * Number(selection.betPerBall);
    this.advanceBonusGame(bonus, stepWin, drop.bumps);
    return this.createRoundState(selection, drop, stepWin);
  }

  private createRoundState(selection: PlinkoAztecBetSelection, drop: DroppedBalls, win: number): object {
    const isFinished = this.activeBonus === null;
    return {
      ...this.createState(selection),
      status: isFinished ? 'win' : 'in-game',
      isFinished,
      isWin: win > 0,
      coeff: drop.coefficient,
      winAmount: this.formatAmount(win),
      ballsResult: drop.balls,
    };
  }

  private createState(selection: PlinkoAztecBetSelection): object {
    const { currency, decimalPlaces } = this.options;
    const betAmount = this.formatAmount(Number(selection.betPerBall) * selection.ballsAmount);
    return {
      bet: { amount: betAmount, currency, decimalPlaces },
      betAmount,
      currency,
      ballsAmount: selection.ballsAmount,
      betPerBall: selection.betPerBall,
      bonusGameState: {
        progress: { ...this.bonusProgress },
        ...(this.activeBonus === null ? {} : { result: this.activeBonus }),
      },
    };
  }

  private dropBalls(count: number, scenario: PlinkoAztecMockScenario): DroppedBalls {
    const balls: BallResult[] = [];
    let coefficient = 0;
    let bumps = 0;
    let isWheelTriggered = false;

    for (let ballIndex = 0; ballIndex < count; ballIndex++) {
      const slotCoefficient = this.options.slotCoefficients[this.resolveSlot(ballIndex, scenario)]!;
      const isSpinSlot = slotCoefficient <= 0;
      const bonusBumpAmount = this.rollBumps();

      isWheelTriggered ||= isSpinSlot;
      coefficient += isSpinSlot ? 0 : slotCoefficient;
      bumps += bonusBumpAmount;
      balls.push({
        position: isSpinSlot ? SPIN_SLOT_LABEL : formatCoefficient(slotCoefficient),
        coeff: formatCoefficient(isSpinSlot ? 0 : slotCoefficient),
        bonusBumpAmount,
      });
    }

    return { balls, coefficient, bumps, isWheelTriggered };
  }

  private resolveSlot(ballIndex: number, scenario: PlinkoAztecMockScenario): number {
    const { slotCoefficients } = this.options;
    const paying = slotCoefficients.filter((coefficient) => coefficient > 0);

    if (scenario === 'top') return slotCoefficients.indexOf(Math.max(...paying));
    if (scenario === 'bottom') return slotCoefficients.indexOf(Math.min(...paying));
    if ((scenario === 'fortune-wheel' || scenario === 'bonus-game') && ballIndex === 0) return this.spinSlotIndex();

    return Math.floor(this.options.random() * slotCoefficients.length);
  }

  private spinSlotIndex(): number {
    const index = this.options.slotCoefficients.findIndex((coefficient) => coefficient <= 0);
    if (index < 0) throw new Error('PlinkoAztecMockSession: в линии ячеек нет ячейки колеса (коэффициент 0)');

    return index;
  }

  private rollBumps(): number {
    let bumps = 0;
    for (let chance = 0; chance < MAX_BUMPS_PER_BALL; chance++) {
      if (this.options.random() < this.options.bumperChance) bumps++;
    }
    return bumps;
  }

  private startBonusGame(): void {
    this.bonusGamesPlayed++;
    this.activeBonus = {
      gameNumber: this.bonusGamesPlayed,
      level: 1,
      progress: 0,
      ballPerDrop: this.options.bonusBallsPerStep,
      ballsAmount: this.options.bonusSteps,
      freeSpinProgress: 0,
      winAmount: this.formatAmount(0),
    };
  }

  /** Выигрыш шага копится в бонусе, бамперы поднимают уровень, последний шаг возвращает раунд. */
  private advanceBonusGame(bonus: BonusGameResult, stepWin: number, stepBumps: number): void {
    const threshold = this.options.bonusLevelThreshold;
    const levelsGained = Math.floor((bonus.progress + stepBumps) / threshold);
    const ballsAmount = bonus.ballsAmount - 1;

    this.activeBonus = ballsAmount <= 0 ? null : {
      ...bonus,
      level: bonus.level + levelsGained,
      progress: (bonus.progress + stepBumps) % threshold,
      ballPerDrop: bonus.ballPerDrop + levelsGained,
      ballsAmount,
      winAmount: this.formatAmount(Number(bonus.winAmount) + stepWin),
    };
  }

  /** Счётчики независимы по комбинации `CUR-balls-betPerBall`, как их ведёт бэкенд. */
  private addBonusProgress(selection: PlinkoAztecBetSelection, bumps: number): void {
    const key = `${this.options.currency}-${selection.ballsAmount}-${formatCoefficient(Number(selection.betPerBall))}`;
    this.bonusProgress = { ...this.bonusProgress, [key]: (this.bonusProgress[key] ?? 0) + bumps };
  }

  private formatAmount(value: number): string {
    return value.toFixed(this.options.decimalPlaces);
  }
}
