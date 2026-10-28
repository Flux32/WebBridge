/**
 * Проводной формат Unity: имена GameObject/событий и строки, которые Unity шлёт
 * в React. Шелл эти константы не импортирует — держит свою копию в
 * `src/engine/unity/unityProtocol.ts` фронтенда, поэтому правка провода идёт в
 * обе стороны. Что каждая строка, которую шлёт Unity-пакет, здесь перечислена,
 * проверяет `js/webbridge/test/unityWire.test.ts` по исходникам C#.
 *
 * Веб-игра этот модуль не импортирует: там нет ни строк, ни префиксов.
 */

/** Имя GameObject в Unity, принимающего все команды. */
export const UNITY_BRIDGE_OBJECT = 'WebBridge';

/** Имя события, через которое Unity шлёт сообщения в React (`SendToReact`). */
export const UNITY_REACT_EVENT = 'SendToReact';

/**
 * Сообщения Unity → React без параметров: приходят строкой как есть.
 */
export const UNITY_PLAIN_MESSAGES = [
  'RequestGameConfig',
  'RequestGameState',
  'RequestWhiteLabel',
  'RequestFastGame',
  'RequestTranslations',
  'RequestBetBarViewportMetrics',
  'RequestPlay',
  'RequestStep',
  'RequestBallsAmount',
  'RequestBetPerBall',
  'DropFinished',
  'SpinReady',
  'RoundShown',
  'OpenTransitionScreen',
  'CloseTransitionScreen',
  'BonusProgressClear',
  'BonusActive',
  'BonusEnded',
  'BonusCleared',
  'FastGame_1',
  'FastGame_0',
] as const;

/**
 * Сообщения Unity → React с полезной нагрузкой в хвосте строки:
 * `<префикс><нагрузка>`.
 */
export const UNITY_PREFIXED_MESSAGES = {
  playSound: 'PlaySound_',
  playMusic: 'PlayMusic_',
  playLoop: 'PlayLoop_',
  stopLoop: 'StopLoop_',
  setVolume: 'SetVolume_',
  uiVisibility: 'UiVisibility_',
  bonusProgressSave: 'BonusProgressSave_',
} as const;

/**
 * Значение отметки сценария окна уходит в Unity разложенным на две строки:
 * `valueType` (`int` | `float` | `bool` | `string`) и `value` — само значение
 * текстом. Одно поле с числом, флагом или строкой в C# читалось бы вручную,
 * а так payload остаётся обычным типизированным классом.
 */
export const UNITY_SIGNAL_VALUE_FIELDS = { type: 'valueType', value: 'value' } as const;

export type UnityPlainMessage = (typeof UNITY_PLAIN_MESSAGES)[number];
export type UnityPrefix = (typeof UNITY_PREFIXED_MESSAGES)[keyof typeof UNITY_PREFIXED_MESSAGES];
