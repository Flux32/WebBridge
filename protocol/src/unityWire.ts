/**
 * Проводной формат Unity: имена GameObject/событий, имена методов и строковые
 * префиксы. Единственное место, где эти строки записаны на TS-стороне —
 * `src/engine/unity/unityProtocol.ts` во фронтенде мапит доменные команды через
 * них, а C#-тест сверяет с ними публичные методы мостов.
 *
 * Phaser этот модуль не импортирует: там нет ни строк, ни префиксов.
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
  'RequestActiveGameState',
  'RequestWhiteLabel',
  'RequestFastGame',
  'RequestTranslations',
  'RequestBetBarViewportMetrics',
  'RequestStep',
  'RequestBallsAmount',
  'DropFinished',
  'RoundShown',
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
  uiVisibility: 'UiVisibility_',
  bonusProgressSave: 'BonusProgressSave_',
} as const;

export type UnityPlainMessage = (typeof UNITY_PLAIN_MESSAGES)[number];
export type UnityPrefix = (typeof UNITY_PREFIXED_MESSAGES)[keyof typeof UNITY_PREFIXED_MESSAGES];
