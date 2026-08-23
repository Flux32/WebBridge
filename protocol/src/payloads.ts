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
