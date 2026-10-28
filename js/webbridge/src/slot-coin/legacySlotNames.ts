/**
 * Прежние имена режима slot-coin — до 1.15.0 он назывался просто `slot`, пока слот
 * был один. Игры, написанные на них, продолжают собираться; удаляются только мажорной
 * версией.
 */
import { SlotCoinBridge } from './SlotCoinBridge';
import { SlotCoinMockHost, type SlotCoinMockHostOptions } from './SlotCoinMockHost';

/** @deprecated Используйте `SlotCoinBridge`. */
export const SlotBridge = SlotCoinBridge;
/** @deprecated Используйте `SlotCoinBridge`. */
export type SlotBridge = SlotCoinBridge;

/** @deprecated Используйте `SlotCoinMockHost`. */
export const SlotMockHost = SlotCoinMockHost;
/** @deprecated Используйте `SlotCoinMockHost`. */
export type SlotMockHost = SlotCoinMockHost;

/** @deprecated Используйте `SlotCoinMockHostOptions`. */
export type SlotMockHostOptions = SlotCoinMockHostOptions;
