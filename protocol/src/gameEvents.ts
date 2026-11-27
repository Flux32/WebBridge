/**
 * Собственные события игры (ADR-0011 «собственные события игр и конструктор воронок»): правила
 * имени и параметров, по которым мост предупреждает, шелл отклоняет, а Vector и C# повторяют.
 * Игра шлёт событие `TrackEvent`, контекст (игра, сессия, релиз, устройство) добавляет шелл.
 *
 * Правило для игр: в событиях нет персональных данных и денег. Эвристика ниже ловит очевидное
 * (почту, URL, UUID, длинные числа, ключи вроде `email` или `bet`), но не доказывает отсутствие ПДн —
 * нарушение остаётся дефектом игры.
 */

export type GameEventParamValue = string | number | boolean;
export type GameEventParams = Readonly<Record<string, GameEventParamValue>>;

export const GAME_EVENT_LIMITS = {
  nameMaxLength: 64,
  keyMaxLength: 32,
  maxParams: 20,
  stringMaxLength: 128,
  numberMaxAbs: 1e15,
  /** `JSON.stringify(params)` в UTF-8. */
  paramsMaxBytes: 1024,
  maxEventsPerSession: 100,
  bucketSize: 20,
  /** Одно событие в 2 с. */
  bucketRefillMs: 2000,
  maxNamesPerSession: 50,
  maxRejectionsPerSession: 10,
} as const;

/** Имя события и ключ параметра. */
export const GAME_EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/** `shell_` — служебные события шелла; `tutorial_`, `ad_` — запас под будущие стандартные события. */
export const RESERVED_GAME_EVENT_PREFIXES = ['shell_', 'tutorial_', 'ad_'] as const;

/** Встроенные события аналитики шелла (ADR-0009). */
export const RESERVED_GAME_EVENT_NAMES = [
  'session_start',
  'startup',
  'heartbeat',
  'first_bet',
  'perf_sample',
  'error',
] as const;

/** Ключ сравнивается целиком: `card` запрещён, `card_kind` — нет. */
export const FORBIDDEN_GAME_EVENT_KEYS = {
  pii: [
    'email',
    'phone',
    'name',
    'first_name',
    'last_name',
    'nickname',
    'username',
    'user_id',
    'player_id',
    'ip',
    'address',
    'token',
    'password',
    'card',
  ],
  money: ['bet', 'stake', 'win', 'payout', 'balance'],
} as const;

/** Строка-значение (и имя события для цифр), похожая на данные о человеке. */
export const GAME_EVENT_PII_PATTERNS = {
  email: /[^\s@]+@[^\s@]+\.[^\s@]+/,
  url: /\b[a-z][a-z\d+.-]*:\/\/|\bwww\./i,
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  digitRun: /\d{7,}/,
} as const;

export const GAME_EVENT_REJECTION_REASONS = [
  'bad_name',
  'reserved_name',
  'bad_params',
  'standard_params',
  'pii',
  'money',
  'rate_limited',
  'session_limit',
  'too_many_names',
  'too_large',
  'inbox_full',
] as const;

export type GameEventRejectionReason = (typeof GAME_EVENT_REJECTION_REASONS)[number];

export type StandardParamFormat =
  /** Любая строка в пределах 128 символов. */
  | 'text'
  /** `GAME_EVENT_NAME_PATTERN`, до 64 символов. */
  | 'identifier'
  /** Число > 0. */
  | 'positive'
  /** Число ≥ 0. */
  | 'non_negative'
  | 'positive_integer'
  /** Любое число в пределах `numberMaxAbs`. */
  | 'number';

export interface StandardParamSpec {
  readonly type: 'string' | 'number';
  readonly format: StandardParamFormat;
  readonly required: boolean;
}

export type StandardGameEvents = Readonly<Record<string, Readonly<Record<string, StandardParamSpec>>>>;

/**
 * Стандартные события: фиксированные имена параметров, на которых строятся готовые карточки «Уровни» и
 * «Ресурсы» в админке. Форма — данные, а не код, чтобы шелл, мост и Vector читали одно и то же.
 * Стандартное событие с неверными параметрами отклоняется (`standard_params`), а не уходит как собственное.
 */
export const STANDARD_GAME_EVENTS = {
  level_start: {
    level: { type: 'string', format: 'text', required: true },
    attempt: { type: 'number', format: 'positive_integer', required: false },
  },
  level_complete: {
    level: { type: 'string', format: 'text', required: true },
    duration_ms: { type: 'number', format: 'non_negative', required: false },
    score: { type: 'number', format: 'number', required: false },
  },
  level_fail: {
    level: { type: 'string', format: 'text', required: true },
    duration_ms: { type: 'number', format: 'non_negative', required: false },
    reason: { type: 'string', format: 'identifier', required: false },
  },
  resource_source: {
    currency: { type: 'string', format: 'identifier', required: true },
    amount: { type: 'number', format: 'positive', required: true },
    source: { type: 'string', format: 'identifier', required: true },
  },
  resource_sink: {
    currency: { type: 'string', format: 'identifier', required: true },
    amount: { type: 'number', format: 'positive', required: true },
    sink: { type: 'string', format: 'identifier', required: true },
  },
} as const satisfies StandardGameEvents;

export type StandardGameEventName = keyof typeof STANDARD_GAME_EVENTS;
