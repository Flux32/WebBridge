/**
 * Откуда пришла смена выбора бет-бара. `none` — не шаг игрока: первое значение
 * после загрузки, ответ на `RequestBallsAmount` / `RequestBetPerBall` и
 * подрезка, которую React делает, когда конфиг бэкенда убрал выбранный вариант.
 * Зеркало C#-шных `PlinkoAztecBallsAmountDirection` / `PlinkoAztecBetPerBallDirection`.
 */
export type SelectionDirection = 'none' | 'increased' | 'decreased';

/**
 * Новое число шариков в броске вместе с прежним: доска добавляет или убирает
 * ровно разницу, а не пересобирает лоток целиком.
 */
export interface BallsAmountChange {
  readonly amount: number;
  /** `0`, пока React не прислал первый выбор. */
  readonly previousAmount: number;
  readonly direction: SelectionDirection;
}

/** Ставки — строки бэкенда (`"0.2"`, `"2"`) как есть, без округления. */
export interface BetPerBallChange {
  readonly betPerBall: string;
  /** `null`, пока React не прислал первую ставку. */
  readonly previousBetPerBall: string | null;
  readonly direction: SelectionDirection;
}

/** Первое значение не с чем сравнить — это синхронизация, а не шаг игрока. */
export const resolveDirection = (isFirstValue: boolean, comparison: number): SelectionDirection => {
  if (isFirstValue) return 'none';

  return comparison > 0 ? 'increased' : 'decreased';
};
