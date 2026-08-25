/**
 * Формы данных, которыми обмениваются React и игра. Поля нативные
 * (число/булево/объект) — сериализация под конкретный движок делается
 * на стороне транспорта, не здесь.
 */

export type Orientation = 'portrait' | 'landscape';

/** Результат шага, который движок проигрывает (падение блока / проигрыш / выигрыш). */
export interface StepResultPayload {
  isWinMain: boolean;
  coinsTriggered: boolean;
  coinsCollected: number[];
  bonusGame?: unknown;
}

/** Игровая конфигурация раунда (коэффициенты, бонус-режимы, лимиты ставок). */
export interface GameConfigPayload {
  coefficients: number[];
  bonusCounts: Record<string, number>;
  bonusModes: Record<string, { price: string; count: number }>;
  currency?: string;
  minBetAmount?: number;
  maxBetAmount?: number;
  balance?: number;
}

/** Бонус road: лесенка по позициям (покупка / сбор в игре / restore). */
export interface RoadStartBonusPayload {
  modeId: string;
  difficulty: string;
  positions: number[];
  bonusCoefficients?: string;
  betAmount: number;
  currency: string;
  /**
   * Ставка в ВАЛЮТЕ ОТОБРАЖЕНИЯ строкой («$0.05»), как строка кэшаута. Движок
   * считает по ней бонусный TOTAL WIN, чтобы окно бонуса показывало те же
   * доллары, что и кэшаут (betAmount/currency остаются в валюте кошелька —
   * в них движок возвращает прогресс). Пусто → движок берёт betAmount.
   */
  displayBet?: string;
  bonusTotalCoefficient: number;
  bonusTotalWin: string;
  completedIterations: number;
  accumulatedCoefficient: number;
  accumulatedWin: number;
  currentStep: number;
}

/**
 * Бонус twist: купленная серия фри-спинов. Сервер считает её целиком в ответе
 * на покупку, поэтому хост отдаёт игре всю серию одним сообщением — дальше игра
 * крутит спины сама, в своём темпе, и стримит прогресс бонусными событиями.
 *
 * `spins` — раунды в виде обычных спин-ответов (сырой GameState-JSON, как у
 * `ApplySpinResult`): игре не нужно знать формат bonusGameResult, она проигрывает
 * их тем же путём, что и спин живой сессии.
 */
export interface TwistStartBonusPayload {
  /** Сколько фри-спинов объявил сервер; счётчик «Free games left» стартует с него. */
  totalRounds: number;
  spins: string[];
}

export type StartBonusPayload = RoadStartBonusPayload | TwistStartBonusPayload;

/** Ответ на запрос покупки бонуса от движка. */
export interface BonusPurchaseResultPayload {
  modeId: string;
  isPurchased: boolean;
  error?: string;
}

/** Видимость UI-элементов, которой управляет движок. */
export interface UiVisibilityPayload {
  hideDesktopBetBar?: boolean;
  hideMobileBetBar?: boolean;
  hideMobileLastWin?: boolean;
  hideSettingsMenuButton?: boolean;
  hideLogo?: boolean;
  hideBottomBalancePanel?: boolean;
  desktopBetBarInteractable?: boolean;
  mobileBetBarInteractable?: boolean;
}

/** Запрос движком покупки бонуса (bet-action). */
export interface BonusPurchaseRequestPayload {
  betAmount?: unknown;
  currency?: unknown;
  difficulty?: unknown;
  bonusType?: unknown;
}

/** Телеметрия кадров: только Unity-сборка, Phaser её не шлёт. */
export interface UnityFrameSamplePayload {
  startTimeSeconds: number;
  sampleDurationMs: number;
  frameCount: number;
  averageFps: number;
  frameTimeP95Ms: number;
  maximumFrameMs: number;
  jankedFrameCount: number;
  longFrameCount: number;
  estimatedDroppedFrames: number;
  foregroundSequence: number;
}

/**
 * Одно действие внутри раунда слота: сервер описывает ими всё, что происходит
 * поверх выпавшей доски — залипшие монеты, респины, выдачу джекпота. Форма
 * действия зависит от его `action`, поэтому остальные поля открыты.
 */
export interface SlotAction {
  action: string;
  [key: string]: unknown;
}

/**
 * Известные значения `SlotAction.action`. Восстановлены из эталонного клиента
 * hold-and-win; список открыт — сервер может прислать и то, чего здесь нет,
 * поэтому `SlotAction.action` остаётся строкой.
 */
export const SLOT_ACTIONS = {
  winLines: 'WIN_LINES',
  strikeCoinsCollection: 'STRIKE_COINS_COLLECTION',
  superStrikeCoinsAdded: 'SUPER_STRIKE_COINS_ADDED',
  superStrikeMultiplierAdded: 'SUPER_STRIKE_MULTIPLIER_ADDED',
  superStrikeJackpotAdded: 'SUPER_STRIKE_JACKPOT_ADDED',
  superStrikeMultiplierCollected: 'SUPER_STRIKE_MULTIPLIER_COLLECTED',
  enhancedSuperStrike: 'ENHANCED_SUPER_STRIKE',
  pileOfGold: 'PILE_OF_GOLD',
  bonusRun: 'BONUS_RUN',
  bonusBuy: 'BONUS_BUY',
  bonusSpinsCount: 'BONUS_SPINS_COUNT',
} as const;

/**
 * Монета в действии сбора. `index` — плоский индекс ячейки доски в том же
 * column-major порядке, что и строка доски (`reel * rows + row`); `symbol` —
 * символ доски. Денежные поля приходят строками, как их отдаёт платформа.
 */
export interface SlotCoin {
  index: number;
  symbol?: string;
  payout?: string;
  coeff?: string;
}

/**
 * Сбор монет: они летят из своих ячеек в ячейку `triggerIndex` — ту, где стоит
 * монета-триггер.
 */
export interface SlotCoinsCollectionAction extends SlotAction {
  action: typeof SLOT_ACTIONS.strikeCoinsCollection;
  triggerIndex: number;
  coins: SlotCoin[];
}

/**
 * Результат спина слота целиком: сервер считает раунд одним ответом, игра его
 * только проигрывает. Зеркало `SlotSpinResult` во фронтенде (`src/slot/types.ts`),
 * который нормализует сырой ответ бэка перед отправкой в игру.
 *
 * `boards` — доски раунда по порядку (базовый спин, затем бонусные, если есть);
 * `actions` — по массиву действий на каждую доску. Денежные значения приходят
 * строками, как их отдаёт платформа: приводить их к number — дело игры.
 */
export interface SlotSpinResult {
  betAmount: string;
  coeff: string;
  currency: string;
  isFinished: boolean;
  isWin: boolean;
  winAmount: string;
  rounds: number;
  boards: string[];
  actions: SlotAction[][];
}
