/**
 * Параметры мока Plinko Aztec — зеркало C#-шного `PlinkoAztecMockSettings`: что
 * заглушка платформы отдаёт конфигом и чем платят выдуманные раунды.
 */

/** Что сделает следующий бросок: редкий исход — по кнопке, а не ожиданием случайного. */
export type PlinkoAztecMockScenario = 'random' | 'top' | 'bottom' | 'fortune-wheel' | 'bonus-game';

export interface PlinkoAztecMockHostOptions {
  /** Линия ячеек слева направо. Ноль — ячейка колеса фортуны (`spin`). */
  slotCoefficients: number[];
  /** Варианты числа шариков в бет-баре; первый — выбор по умолчанию. */
  ballsAmountOptions: number[];
  /** Варианты ставки за шар строками бэкенда (`"0.2"`, `"2"`); первый — выбор по умолчанию. */
  betPerBallOptions: string[];
  currency: string;
  decimalPlaces: number;
  /** Шанс, что шарик заденет бампер на каждом из трёх шансов по пути вниз. */
  bumperChance: number;
  /** Сколько попаданий в бамперы поднимают бонусную игру на уровень. */
  bonusLevelThreshold: number;
  /** Сколько шагов идёт выигранная бонусная игра. */
  bonusSteps: number;
  /** Шариков за шаг бонуса на первом уровне; каждый уровень добавляет один. */
  bonusBallsPerStep: number;
  /** Множитель, на котором встаёт колесо, когда оно не дало бонусную игру. */
  fortuneWheelCoefficient: number;
  /** Источник случайности; тесты подменяют его, чтобы исход был предсказуем. */
  random: () => number;
}

export const DEFAULT_PLINKO_AZTEC_MOCK_OPTIONS: PlinkoAztecMockHostOptions = {
  slotCoefficients: [1000, 130, 26, 9, 4, 2, 0.2, 0, 0.2, 2, 4, 9, 26, 130, 1000],
  ballsAmountOptions: [10, 20, 50],
  betPerBallOptions: ['1', '2', '5', '10'],
  currency: 'USD',
  decimalPlaces: 2,
  bumperChance: 0.25,
  bonusLevelThreshold: 5,
  bonusSteps: 5,
  bonusBallsPerStep: 3,
  fortuneWheelCoefficient: 2,
  random: Math.random,
};
