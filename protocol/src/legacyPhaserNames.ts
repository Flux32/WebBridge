/**
 * Прежние имена контракта веб-игры (`web.ts`) — с тех пор, когда единственным
 * веб-движком был Phaser. Живут, пока живут выпущенные пакеты: игры, собранные
 * до 1.12.0, регистрируют `__PHASER_BOOT__` и читают `__PHASER_HOST__`, а шеллы
 * старых тегов знают только эти имена. Удаляются только сменой мажорной версии.
 */
import type { WebBootFn, WebBootOptions, WebGameBridge, WebHostBridge } from './web.js';

/** @deprecated Используйте `WebHostBridge`. */
export type PhaserHostBridge = WebHostBridge;
/** @deprecated Используйте `WebGameBridge`. */
export type PhaserGameBridge = WebGameBridge;
/** @deprecated Используйте `WebBootOptions`. */
export type PhaserBootOptions = WebBootOptions;
/** @deprecated Используйте `WebBootFn`. */
export type PhaserBootFn = WebBootFn;

/** @deprecated Используйте `WEB_GAME_CONTAINER_ID`; шеллы с 1.12.0 монтируют игру в него. */
export const PHASER_CONTAINER_ID = 'phaser-root';

declare global {
  interface Window {
    /** @deprecated Используйте `__WEB_GAME_HOST__`; хост выставляет оба. */
    __PHASER_HOST__?: WebHostBridge;
    /** @deprecated Используйте `__WEB_GAME_BOOT__` (`registerWebBoot` выставляет оба). */
    __PHASER_BOOT__?: WebBootFn;
    /** @deprecated Используйте `__WEB_GAME__`. */
    __PHASER_GAME__?: WebGameBridge;
  }
}
