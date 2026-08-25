/**
 * Заглушка React-стороны для слота — аналог `MockHost` из режима Crush, но под
 * другую механику: у слота нет ни лесенки, ни шага, ни кэшаута, а раунд
 * приходит одним ответом.
 *
 * Смысл тот же: игра идёт по НАСТОЯЩЕМУ пути — тот же `__PHASER_BOOT__`, тот же
 * мост, те же команды. Подменяется только собеседник, поэтому мок проверяет
 * интеграцию, а не обходит её.
 *
 * Доски генерируются НАСТОЯЩИМ алфавитом бэка. Это принципиально: мок, который
 * шлёт выдуманные символы, не поймает ошибку разбора доски — а именно она
 * дольше всего жила незамеченной, потому что не падает, а молча рисует мусор.
 */
import type {
  EngineEvent,
  PhaserGameBridge,
  PhaserHostBridge,
  SlotAction,
  SlotCoin,
  SlotSpinResult,
} from '@omega/webbridge-protocol';
import { SLOT_ACTIONS } from '@omega/webbridge-protocol';

/**
 * Алфавит доски — коды платформы. Символ здесь это КЛЮЧ, а не число: коды
 * идут `0`…`9`, затем `a`…`m`, и сворачивать их арифметикой нельзя.
 *
 * `0` (empty) намеренно не генерируется: пустая ячейка встречается только в
 * бонусных досках, и в обычном спине была бы не тем, что проверяем.
 */
const BASE_SYMBOLS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** Монеты-множители ×1 ×2 ×3 ×5 ×7 ×10 ×15. */
const COIN_SYMBOLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const COIN_COEFFS: Record<string, number> = { a: 1, b: 2, c: 3, d: 5, e: 7, f: 10, g: 15 };
/** Джекпот-медальоны mini / minor / major / grand. */
const JACKPOT_SYMBOLS = ['h', 'i', 'j', 'k'];
const JACKPOT_COEFFS: Record<string, number> = { h: 25, i: 50, j: 150, k: 1000 };
/** Монета-триггер, в которую слетаются остальные. */
const TRIGGER_SYMBOL = 'l';

export interface SlotMockHostOptions {
  reels: number;
  rows: number;
  /** Доля ячеек первого и третьего барабанов, занятых монетами. */
  coinChance: number;
  /** Вероятность, что раунд закончится сбором монет. */
  collectChance: number;
  /** Вероятность джекпот-медальона вместо обычной монеты. */
  jackpotChance: number;
  currency: string;
  betAmount: number;
}

const DEFAULTS: SlotMockHostOptions = {
  reels: 3,
  rows: 4,
  coinChance: 0.35,
  collectChance: 0.45,
  jackpotChance: 0.12,
  currency: 'USD',
  betAmount: 1,
};

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;

export class SlotMockHost implements PhaserHostBridge {
  private readonly options: SlotMockHostOptions;
  private game: PhaserGameBridge | null = null;

  /**
   * Раунд занят, пока игра не доиграла и не прислала SpinReady — ровно так же
   * бет-бар React держит кнопку заблокированной. Заодно это проверяет, что игра
   * шлёт сигнал один раз и в конце: если она молчит, мок залипнет, и это видно.
   */
  private isBusy = false;

  public constructor(options: Partial<SlotMockHostOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Отдать мока игре, поднятой через `__PHASER_BOOT__`. */
  public attach(game: PhaserGameBridge): void {
    this.game = game;
  }

  public emit(event: EngineEvent): void {
    switch (event.type) {
      case 'RequestGameConfig':
        this.send({
          type: 'ApplyGameConfig',
          payload: JSON.stringify({ currency: this.options.currency }),
        });
        return;
      case 'RequestGameState':
        // Барабану между спинами хранить нечего — как и на бэке, где
        // restoreCommands для слота пуст.
        this.send({ type: 'ApplyGameState', payload: JSON.stringify({ status: 'none' }) });
        return;
      case 'RequestWhiteLabel':
        this.send({ type: 'ApplyWhiteLabel', payload: false });
        return;
      case 'RequestFastGame':
        this.send({ type: 'SetFastGame', payload: false });
        return;
      case 'SpinReady':
        this.isBusy = false;
        return;
      default:
        return;
    }
  }

  public ready(): void {}

  public setProgress(): void {}

  /**
   * Обычный спин. Сбор случается не всегда — как и на бою, где монеты просто
   * лежат на барабанах, пока не выпадет монета-триггер. Пока предыдущий раунд
   * доигрывается, нажатие игнорируется.
   */
  public spin(): void {
    if (this.isBusy) return;

    const rolled = this.makeBoard();
    const round = Math.random() < this.options.collectChance
      ? this.makeCollect(rolled)
      : { board: rolled, actions: [] };

    this.deliver([round.board], [round.actions]);
  }

  /** Спин, который гарантированно заканчивается сбором монет. */
  public spinWithCollect(): void {
    if (this.isBusy) return;

    const round = this.makeCollect(this.makeBoard({ forceCoins: true }), { force: true });
    this.deliver([round.board], [round.actions]);
  }

  /**
   * Раунд из нескольких досок — как бонусные респины. Проверяет, что игра
   * проигрывает их по очереди и присылает SpinReady ровно один раз, в конце.
   */
  public spinBonusRound(boards = 3): void {
    if (this.isBusy) return;

    const rolled = Array.from({ length: Math.max(2, boards) }, () => this.makeBoard({ forceCoins: true }));
    // Сбор — только на последней доске, как финал серии респинов.
    const rounds = rolled.map((board, i) => (
      i === rolled.length - 1
        ? this.makeCollect(board, { force: true })
        : { board, actions: [] as SlotAction[] }
    ));
    this.deliver(rounds.map(r => r.board), rounds.map(r => r.actions));
  }

  /**
   * Клавиши по образцу мок-панели Crush: пробел — спин, C — спин со сбором,
   * B — бонусный раунд из нескольких досок.
   */
  public bindKeys(target: EventTarget = window): () => void {
    const onKeyDown = (event: Event): void => {
      const key = (event as KeyboardEvent).code;
      if (key === 'Space') this.spin();
      else if (key === 'KeyC') this.spinWithCollect();
      else if (key === 'KeyB') this.spinBonusRound();
      else return;

      event.preventDefault();
    };

    target.addEventListener('keydown', onKeyDown);
    return () => target.removeEventListener('keydown', onKeyDown);
  }

  /**
   * Доска в column-major: подряд идут `rows` символов одного барабана, сверху
   * вниз. Монеты кладутся только на крайние барабаны — так же, как в пейтабле
   * платформы («Appears only on reels 1 and 3»).
   */
  private makeBoard(opts: { forceCoins?: boolean } = {}): string {
    const { reels, rows, coinChance, jackpotChance } = this.options;
    let out = '';

    for (let reel = 0; reel < reels; reel++) {
      const canHoldCoins = reel === 0 || reel === reels - 1;
      let placed = 0;

      for (let row = 0; row < rows; row++) {
        const wantCoin = canHoldCoins
          && (opts.forceCoins && placed === 0 ? true : Math.random() < coinChance);

        if (wantCoin) {
          out += Math.random() < jackpotChance ? pick(JACKPOT_SYMBOLS) : pick(COIN_SYMBOLS);
          placed++;
        } else {
          out += pick(BASE_SYMBOLS);
        }
      }
    }
    return out;
  }

  /**
   * Собирает все монеты доски в ячейку-триггер.
   *
   * Возвращает и доску тоже: триггер надо ПОСТАВИТЬ на неё, иначе действие
   * ссылается на ячейку, в которой нарисован обычный символ, и картинка
   * расходится с данными. Триггер идёт на средний барабан — там, где в
   * платформенной игре появляется монета-курица.
   */
  private makeCollect(
    board: string,
    opts: { force?: boolean } = {},
  ): { board: string; actions: SlotAction[] } {
    const { rows, reels } = this.options;
    const cells = board.split('');

    const coins: SlotCoin[] = [];
    cells.forEach((symbol, index) => {
      const coeff = COIN_COEFFS[symbol] ?? JACKPOT_COEFFS[symbol];
      if (coeff === undefined) return;

      coins.push({
        index,
        symbol,
        coeff: String(coeff),
        payout: (coeff * this.options.betAmount).toFixed(2),
      });
    });

    if (coins.length === 0 && !opts.force) return { board, actions: [] };

    // Триггер — середина среднего барабана.
    const middleReel = Math.floor(reels / 2);
    const triggerIndex = middleReel * rows + Math.floor(rows / 2);
    cells[triggerIndex] = TRIGGER_SYMBOL;

    return {
      board: cells.join(''),
      actions: [{
        action: SLOT_ACTIONS.strikeCoinsCollection,
        triggerIndex,
        coins,
      }],
    };
  }

  /**
   * Складывает результат раунда и отдаёт его игре. Суммы здесь
   * ИЛЛЮСТРАТИВНЫЕ — считаются из коэффициентов собранных монет. Мок не
   * является вторым источником истины по выплатам: на бою их считает сервер.
   */
  private deliver(boards: string[], actions: SlotAction[][]): void {
    this.isBusy = true;

    const totalCoeff = actions
      .flat()
      .flatMap((a) => (Array.isArray(a.coins) ? (a.coins as SlotCoin[]) : []))
      .reduce((sum, c) => sum + Number(c.coeff ?? 0), 0);

    const winAmount = totalCoeff * this.options.betAmount;

    const result: SlotSpinResult = {
      betAmount: this.options.betAmount.toFixed(9),
      coeff: String(totalCoeff),
      currency: this.options.currency,
      isFinished: true,
      isWin: winAmount > 0,
      winAmount: winAmount.toFixed(2),
      rounds: boards.length,
      boards,
      actions,
    };

    this.send({ type: 'ApplySpinResult', payload: JSON.stringify(result) });
  }

  private send(command: Parameters<PhaserGameBridge['receive']>[0]): void {
    this.game?.receive(command);
  }
}
