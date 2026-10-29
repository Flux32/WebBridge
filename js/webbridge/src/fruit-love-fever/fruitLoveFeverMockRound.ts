/**
 * One Fruit Love Fever round as the dev backend plays it, for the mock host. The play reply is the base
 * spin; three scatters or a bought bonus leave it unfinished with 8–12 free spins, each the reply of one
 * step. A wild that lands in a free spin sticks to its cell until the bonus ends, and the server already
 * puts the sticky wilds into every later step's board. The top-level `winAmount` is the running total;
 * `bonusGame.winAmount` is the free spin's own. A bought bonus is priced in bets: its coefficients are
 * relative to `amount / price`.
 */
import type {
  FruitLoveFeverBonusBuy,
  FruitLoveFeverBonusGame,
  FruitLoveFeverCell,
  FruitLoveFeverReel,
  FruitLoveFeverSpinResult,
  FruitLoveFeverStepResult,
  FruitLoveFeverWinLine,
} from '@omega/webbridge-protocol';
import {
  BONUS_SCATTERS,
  countScatters,
  dealBoard,
  evaluateLines,
  linesCoeff,
  REEL_ROWS,
  SCATTER_PAY,
  withBonusScatters,
  type DealOptions,
  type MockBoard,
  type MockCell,
} from './fruitLoveFeverMockBoards';

// Local copies of the protocol's tables: the bridge imports only protocol types, so it runs on the
// released protocol until it moves to the one that has these constants.
const BONUS_PRICES: Readonly<Record<FruitLoveFeverBonusBuy, number>> = { x75: 75, x200: 200 };
const OUTCOMES = ['wild', 'pineapple', 'banana', 'coconut', 'strawberry', 'mojito', 'bra', 'a', 'k', 'q', 'j', 'ten', 'scatter'] as const;
const REEL_STOPS = 80;
const WILD = 0;
const FREE_SPINS = { min: 8, max: 12 } as const;

const BASE_DEAL: DealOptions = { wildChance: 0.06, scatterChance: 0.035 };
const FREE_SPIN_DEAL: Readonly<Record<FruitLoveFeverBonusBuy | 'scatter', DealOptions>> = {
  scatter: { wildChance: 0.055, scatterChance: 0 },
  x75: { wildChance: 0.055, scatterChance: 0 },
  x200: { wildChance: 0.09, scatterChance: 0 },
};

export interface FruitLoveFeverMockPlay {
  /** The play's `amount`: the bet, or the full price of a bought bonus. */
  readonly amount: number;
  readonly currency: string;
  readonly bonusBuy?: FruitLoveFeverBonusBuy;
  readonly random: () => number;
}

const cents = (value: number): number => Math.round(value * 100) / 100;

/** Twelve decimals, as `bonusGame.coeff` comes from the server. */
const longDecimal = (value: number): string => value.toFixed(12);

const cellsOf = (reel: readonly MockCell[]): FruitLoveFeverCell[] =>
  reel.map((cell, index) => ({
    outcomeNumber: cell.symbol,
    outcome: OUTCOMES[cell.symbol],
    ...(cell.coeff === undefined ? {} : { coeff: String(cell.coeff) }),
    index,
  }));

/** The five reels of a reply, keyed as the server keys them. */
const byReel = <T>(make: (reel: number) => T): Record<FruitLoveFeverReel, T> => ({
  '1': make(0),
  '2': make(1),
  '3': make(2),
  '4': make(3),
  '5': make(4),
});

interface PlayedSpin {
  readonly board: MockBoard;
  readonly lines: FruitLoveFeverWinLine[];
  readonly coeff: number;
  readonly isFinished: boolean;
  readonly bonusGame: FruitLoveFeverBonusGame | undefined;
}

export class FruitLoveFeverMockRound {
  public lastReply: FruitLoveFeverSpinResult;
  private readonly baseBet: number;
  private readonly sticky = new Map<number, MockCell>();
  private readonly totalFreeSpins: number;
  private totalWin = 0;
  private freeSpinsPlayed = 0;

  public constructor(private readonly play: FruitLoveFeverMockPlay) {
    this.baseBet = play.bonusBuy === undefined ? play.amount : play.amount / BONUS_PRICES[play.bonusBuy];
    const dealt = dealBoard(play.random, BASE_DEAL);
    const board = play.bonusBuy === undefined ? dealt : withBonusScatters(dealt);
    const isBonus = countScatters(board) >= BONUS_SCATTERS;
    this.totalFreeSpins = isBonus ? FREE_SPINS.min + Math.floor(play.random() * (FREE_SPINS.max - FREE_SPINS.min + 1)) : 0;
    // A bought bonus pays nothing for its base spin; a dealt one pays its lines and the scatters.
    const lines = play.bonusBuy === undefined ? evaluateLines(board) : [];
    const coeff = play.bonusBuy === undefined ? linesCoeff(lines) + (isBonus ? SCATTER_PAY : 0) : 0;
    this.totalWin = cents(coeff * this.baseBet);
    const bonusGame = isBonus ? this.bonusGame(null, 0) : undefined;
    this.lastReply = this.reply({ board, lines, coeff: cents(coeff), isFinished: !isBonus, bonusGame });
  }

  public get isFinished(): boolean {
    return this.lastReply.isFinished;
  }

  /** Plays the next free spin. Throws once the bonus is over: the server answers "Active round not found". */
  public nextStep(): FruitLoveFeverStepResult {
    if (this.isFinished) throw new Error('[FruitLoveFeverMockRound] no free spin left: the round is finished');
    this.freeSpinsPlayed += 1;
    const board = this.dealFreeSpin();
    const lines = evaluateLines(board);
    const spinCoeff = linesCoeff(lines);
    const spinWin = cents(spinCoeff * this.baseBet);
    this.totalWin = cents(this.totalWin + spinWin);
    const isFinished = this.freeSpinsPlayed === this.totalFreeSpins;
    // The server keeps the top-level coeff at the base spin's until the last free spin settles the round.
    const coeff = isFinished ? Math.round((this.totalWin / this.play.amount) * 1000) / 1000 : Number(this.lastReply.coeff);
    const bonusGame = this.bonusGame(spinCoeff, spinWin);
    const step: FruitLoveFeverStepResult = { ...this.reply({ board, lines, coeff, isFinished, bonusGame }), bonusGame };
    this.lastReply = step;
    return step;
  }

  /** A fresh board with every sticky wild in place; the wilds that land now stick from here on. */
  private dealFreeSpin(): MockBoard {
    const deal = FREE_SPIN_DEAL[this.play.bonusBuy ?? 'scatter'];
    const board = dealBoard(this.play.random, deal).map((reel, reelIndex) =>
      reel.map((cell, row) => this.sticky.get(reelIndex * REEL_ROWS + row) ?? cell),
    );
    board.forEach((reel, reelIndex) =>
      reel.forEach((cell, row) => {
        if (cell.symbol === WILD) this.sticky.set(reelIndex * REEL_ROWS + row, cell);
      }),
    );
    return board;
  }

  private bonusGame(spinCoeff: number | null, spinWin: number): FruitLoveFeverBonusGame {
    return {
      currentGameNumber: spinCoeff === null ? null : this.freeSpinsPlayed,
      totalFreeSpinsAmount: this.totalFreeSpins,
      coeff: spinCoeff === null ? '0' : longDecimal(spinCoeff),
      winAmount: spinCoeff === null ? '0' : spinWin.toFixed(2),
    };
  }

  private reply({ board, lines, coeff, isFinished, bonusGame }: PlayedSpin): FruitLoveFeverSpinResult {
    const { amount, currency, bonusBuy, random } = this.play;
    // Mid-bonus replies are 'win' whatever they paid so far, as the server sends them.
    const status = !isFinished || this.totalWin > 0 ? 'win' : 'lose';
    return {
      status,
      bet: { amount: amount.toFixed(2), currency, decimalPlaces: 2 },
      betAmount: amount.toFixed(2),
      coeff,
      currency,
      isFinished,
      isWin: status === 'win',
      winAmount: this.totalWin.toFixed(2),
      slot: {
        reelsCells: byReel((reel) => cellsOf(board[reel] ?? [])),
        reelsPosition: byReel(() => Math.floor(random() * REEL_STOPS)),
        winLines: lines,
      },
      ...(bonusBuy === undefined ? {} : { bonusBuy }),
      ...(bonusGame === undefined ? {} : { bonusGame }),
    };
  }
}
