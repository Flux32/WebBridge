/**
 * Прежние имена фабрики — с тех пор, когда единственным веб-движком был Phaser.
 * Игры, написанные на них, продолжают собираться; удаляются только мажорной версией.
 */
import type { BridgeBase } from '../core/BridgeBase';
import { createWebBoot, type WebBootConfig } from './createWebBoot';

/** @deprecated Используйте `WebBootConfig`. */
export type PhaserBootConfig<TBridge extends BridgeBase, TGame> = WebBootConfig<TBridge, TGame>;

/** @deprecated Используйте `createWebBoot` и `registerWebBoot`. */
export const createPhaserBoot = createWebBoot;
