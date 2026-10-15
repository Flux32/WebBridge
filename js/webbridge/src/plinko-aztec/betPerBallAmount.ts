/**
 * Ставка за шар как сумма — только чтобы проверить её и сравнить две ставки.
 * Сами деньги в number не переводятся: дробь вроде `0.1` в нём неточна, а
 * игре нужна строка бэкенда без округления (из неё собирается ключ прогресса
 * бонуса `CUR-balls-betPerBall`).
 */

/** Как `betPerBall` бэкенда: цифры и точка — без знака, разрядов и экспоненты. */
const PLAIN_DECIMAL = /^(\d*)\.?(\d*)$/;

/** Цифры суммы без ведущих нулей целой части и хвостовых нулей дробной: `"2"` и `"02.0"` равны. */
export interface BetPerBallAmount {
  readonly integerDigits: string;
  readonly fractionDigits: string;
}

/** `null` — строка не сумма бэкенда (пусто, знак, запятая, экспонента). */
export const parseBetPerBall = (betPerBall: string): BetPerBallAmount | null => {
  const match = PLAIN_DECIMAL.exec(betPerBall);
  if (match === null) return null;

  const [, integerDigits = '', fractionDigits = ''] = match;
  if (integerDigits === '' && fractionDigits === '') return null;

  return {
    integerDigits: integerDigits.replace(/^0+/, ''),
    fractionDigits: fractionDigits.replace(/0+$/, ''),
  };
};

export const isZeroBetPerBall = (amount: BetPerBallAmount): boolean =>
  amount.integerDigits === '' && amount.fractionDigits === '';

/** Знак разности `left − right`: отрицательное, ноль или положительное. */
export const compareBetPerBall = (left: BetPerBallAmount, right: BetPerBallAmount): number => {
  if (left.integerDigits.length !== right.integerDigits.length) {
    return left.integerDigits.length - right.integerDigits.length;
  }

  const width = Math.max(left.fractionDigits.length, right.fractionDigits.length);
  const leftDigits = left.integerDigits + left.fractionDigits.padEnd(width, '0');
  const rightDigits = right.integerDigits + right.fractionDigits.padEnd(width, '0');
  if (leftDigits === rightDigits) return 0;

  return leftDigits < rightDigits ? -1 : 1;
};
