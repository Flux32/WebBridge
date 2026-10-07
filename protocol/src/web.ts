/**
 * Контракт между React-хостом и веб-игрой — JS-бандлом, загруженным в ТОМ ЖЕ окне.
 * Движок внутри бандла контракту безразличен: Phaser, Pixi, three.js — всё равно.
 * Окно общее, поэтому EngineCommand/EngineEvent ходят структурами — без
 * сериализации в строки (в отличие от Unity-моста).
 *
 * Что делает бандл, когда его скрипт исполнится:
 *   1) выставляет глобальную фабрику `window.__WEB_GAME_BOOT__(host, container, options)`,
 *      которая поднимает игру внутри `container` и возвращает WebGameBridge;
 *   2) шлёт события в React через `host.emit(event)`;
 *   3) зовёт `host.ready()`, когда игра готова принимать команды (аналог Unity
 *      `isLoaded`), а по ходу загрузки — `host.setProgress(0..1)`.
 *
 * Реализация фабрики — `@omega/webbridge-js` (`createWebBoot`, `registerWebBoot`).
 * Прежние имена (`__PHASER_BOOT__`, `PhaserHostBridge`, …) — в `legacyPhaserNames.ts`.
 */
import type { EngineCommand } from './commands.js';
import type { EngineEvent } from './events.js';

/** Сторона React, передаётся в бандл. */
export interface WebHostBridge {
  /** Игра → React: типизированное событие. */
  emit(event: EngineEvent): void;
  /** Игра сообщает, что инициализирована и готова к командам. */
  ready(): void;
  /** Прогресс загрузки 0..1 (для общего лоадера). */
  setProgress(value: number): void;
}

/** Сторона веб-игры, которую драйвит React. */
export interface WebGameBridge {
  /** React → игра: доставить типизированную команду. */
  receive(command: EngineCommand): void;
  /** Очистка перед размонтированием (уничтожить игру). */
  destroy?(): void;
}

/** Опции рендера, которые хост передаёт бандлу на boot. */
export interface WebBootOptions {
  /**
   * Потолок devicePixelRatio для бэкстора canvas — единый источник правды здесь
   * хост. Бандл ограничивает бэкстор величиной
   * `cssSize × min(window.devicePixelRatio, devicePixelRatio)`, а не рендерит в
   * полный нативный DPR телефона: на DPR-3 это ~9× пикселей по площади,
   * просадка FPS и пик GPU-памяти.
   */
  devicePixelRatio?: number;
}

export type WebBootFn = (
  host: WebHostBridge,
  container: HTMLElement,
  options?: WebBootOptions,
) => WebGameBridge;

/** id DOM-контейнера, в который веб-игра монтирует свой canvas. */
export const WEB_GAME_CONTAINER_ID = 'web-game-root';

declare global {
  interface Window {
    /** Хост-мост, который React выставляет до загрузки бандла. */
    __WEB_GAME_HOST__?: WebHostBridge;
    /** Фабрика игры — предпочтительный способ регистрации бандла. */
    __WEB_GAME_BOOT__?: WebBootFn;
    /** Игра, зарегистрированная бандлом при self-boot (fallback хоста). */
    __WEB_GAME__?: WebGameBridge;
  }
}
