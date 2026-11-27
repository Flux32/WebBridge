/**
 * Правила собственных событий игры (ADR-0011), по которым мост предупреждает в лог. Сами правила и числа
 * лежат в протоколе (`gameEvents.ts`); решение об отказе принимает шелл, поэтому здесь они только
 * показывают разработчику, что событие не дойдёт. Функция не бросает ни на каком входе.
 */
import {
  FORBIDDEN_GAME_EVENT_KEYS,
  GAME_EVENT_LIMITS,
  GAME_EVENT_NAME_PATTERN,
  GAME_EVENT_PII_PATTERNS,
  RESERVED_GAME_EVENT_NAMES,
  RESERVED_GAME_EVENT_PREFIXES,
  STANDARD_GAME_EVENTS,
} from '@omega/webbridge-protocol';
import type {
  GameEventParams,
  GameEventRejectionReason,
  StandardParamFormat,
  StandardParamSpec,
} from '@omega/webbridge-protocol';

type ParamValues = Readonly<Record<string, unknown>>;

const piiKeys: readonly string[] = FORBIDDEN_GAME_EVENT_KEYS.pii;
const moneyKeys: readonly string[] = FORBIDDEN_GAME_EVENT_KEYS.money;
const reservedNames: readonly string[] = RESERVED_GAME_EVENT_NAMES;
const standardEvents: Readonly<Record<string, Readonly<Record<string, StandardParamSpec>>>> = STANDARD_GAME_EVENTS;
const textEncoder = new TextEncoder();

const isIdentifier = (value: string): boolean =>
  value.length <= GAME_EVENT_LIMITS.nameMaxLength && GAME_EVENT_NAME_PATTERN.test(value);

const isValidName = (name: string): boolean => name.length > 0 && isIdentifier(name);

const isValidKey = (key: string): boolean =>
  key.length > 0 && key.length <= GAME_EVENT_LIMITS.keyMaxLength && GAME_EVENT_NAME_PATTERN.test(key);

const isValidValue = (value: unknown): boolean => {
  switch (typeof value) {
    case 'string':
      return value.length <= GAME_EVENT_LIMITS.stringMaxLength;
    case 'number':
      return Number.isFinite(value) && Math.abs(value) <= GAME_EVENT_LIMITS.numberMaxAbs;
    case 'boolean':
      return true;
    default:
      return false;
  }
};

const hasPiiPattern = (text: string): boolean =>
  Object.values(GAME_EVENT_PII_PATTERNS).some((pattern) => pattern.test(text));

const matchesFormat = (value: string | number, format: StandardParamFormat): boolean => {
  switch (format) {
    case 'text':
      return typeof value === 'string';
    case 'identifier':
      return typeof value === 'string' && isValidName(value);
    case 'positive':
      return typeof value === 'number' && value > 0;
    case 'non_negative':
      return typeof value === 'number' && value >= 0;
    case 'positive_integer':
      return typeof value === 'number' && Number.isInteger(value) && value >= 1;
    case 'number':
      return typeof value === 'number';
  }
};

const matchesSpec = (value: unknown, spec: StandardParamSpec): boolean =>
  typeof value === spec.type && matchesFormat(value as string | number, spec.format);

const violatesStandardShape = (name: string, params: ParamValues): boolean => {
  const shape = standardEvents[name];
  if (shape === undefined) return false;

  return Object.entries(shape).some(([key, spec]) => {
    const value = params[key];
    return value === undefined ? spec.required : !matchesSpec(value, spec);
  });
};

const isOversized = (params: ParamValues): boolean =>
  textEncoder.encode(JSON.stringify(params)).length > GAME_EVENT_LIMITS.paramsMaxBytes;

const findPrivacyRejection = (params: ParamValues): GameEventRejectionReason | null => {
  for (const [key, value] of Object.entries(params)) {
    if (piiKeys.includes(key)) return 'pii';
    if (moneyKeys.includes(key)) return 'money';
    if (typeof value === 'string' && hasPiiPattern(value)) return 'pii';
  }

  return null;
};

const findNameRejection = (name: string): GameEventRejectionReason | null => {
  // JS-игра без типов может прислать что угодно: не-строка — такое же плохое имя.
  if (typeof name !== 'string' || !isValidName(name)) return 'bad_name';
  if (GAME_EVENT_PII_PATTERNS.digitRun.test(name)) return 'pii';
  if (reservedNames.includes(name) || RESERVED_GAME_EVENT_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return 'reserved_name';
  }

  return null;
};

const hasValidShape = (params: ParamValues): boolean => {
  const entries = Object.entries(params);
  return (
    entries.length <= GAME_EVENT_LIMITS.maxParams &&
    entries.every(([key, value]) => isValidKey(key) && isValidValue(value))
  );
};

/**
 * Причина, по которой шелл отклонит событие, или `null`, если событие правильное. Проверяется то, что
 * видно игре: форма имени и параметров, зарезервированные имена, стандартные события, ПДн и деньги.
 * Лимиты сессии (частота, число событий и имён) знает только шелл.
 */
export const findGameEventRejection = (
  name: string,
  params: GameEventParams | undefined,
): GameEventRejectionReason | null => {
  const nameRejection = findNameRejection(name);
  if (nameRejection !== null) return nameRejection;

  const values: ParamValues = params ?? {};
  if (!hasValidShape(values)) return 'bad_params';
  if (isOversized(values)) return 'too_large';
  if (violatesStandardShape(name, values)) return 'standard_params';

  return findPrivacyRejection(values);
};
