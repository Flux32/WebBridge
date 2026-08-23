/**
 * Контракт между React-хостом и Phaser-бандлом, загруженным в ТОМ ЖЕ окне.
 * Окно общее, поэтому EngineCommand/EngineEvent ходят структурами — без
 * сериализации в строки (в отличие от Unity-моста).
 *
 * Что делает бандл, когда его скрипт исполнится:
 *   1) выставляет глобальную фабрику `window.__PHASER_BOOT__(host, container, options)`,
 *      которая создаёт Phaser.Game внутри `container` и возвращает PhaserGameBridge;
 *   2) шлёт события в React через `host.emit(event)`;
 *   3) зовёт `host.ready()`, когда игра готова принимать команды (аналог Unity
 *      `isLoaded`), а по ходу загрузки — `host.setProgress(0..1)`.
 *
 * Реализация фабрики — `@omega/webbridge-js` (`createPhaserBoot`).
 */
import type { EngineCommand } from './commands';
import type { EngineEvent } from './events';

/** Сторона React, передаётся в бандл. */
export interface PhaserHostBridge {
  /** Phaser → React: типизированное событие. */
  emit(event: EngineEvent): void;
  /** Phaser сообщает, что игра инициализирована и готова к командам. */
  ready(): void;
  /** Прогресс загрузки 0..1 (для общего лоадера). */
  setProgress(value: number): void;
}

/** Сторона Phaser-игры, которую драйвит React. */
export interface PhaserGameBridge {
  /** React → Phaser: доставить типизированную команду. */
  receive(command: EngineCommand): void;
  /** Очистка перед размонтированием (уничтожить Phaser.Game). */
  destroy?(): void;
}

/** Опции рендера, которые хост передаёт бандлу на boot. */
export interface PhaserBootOptions {
  /**
   * Потолок devicePixelRatio для бэкстора canvas — единый источник правды здесь
   * хост. Бандл ограничивает бэкстор величиной
   * `cssSize × min(window.devicePixelRatio, devicePixelRatio)`, а не рендерит в
   * полный нативный DPR телефона: на DPR-3 это ~9× пикселей по площади,
   * просадка FPS и пик GPU-памяти.
   */
  devicePixelRatio?: number;
}

export type PhaserBootFn = (
  host: PhaserHostBridge,
  container: HTMLElement,
  options?: PhaserBootOptions,
) => PhaserGameBridge;

/** id DOM-контейнера, в который Phaser монтирует свой canvas. */
export const PHASER_CONTAINER_ID = 'phaser-root';

declare global {
  interface Window {
    /** Хост-мост, который React выставляет до загрузки бандла. */
    __PHASER_HOST__?: PhaserHostBridge;
    /** Фабрика игры — предпочтительный способ регистрации бандла. */
    __PHASER_BOOT__?: PhaserBootFn;
    /** Игра, зарегистрированная бандлом при self-boot (fallback хоста). */
    __PHASER_GAME__?: PhaserGameBridge;
  }
}
