/**
 * Единственное место в пакете, знающее про хост веб-игры. Собирает фабрику
 * `window.__WEB_GAME_BOOT__`, которую ждёт React-адаптер шелла: поднимает
 * транспорт поверх `host.emit`, отдаёт мост игре и возвращает `WebGameBridge` —
 * приёмник команд.
 *
 * `TGame` намеренно generic: пакет не зависит ни от одного движка (Phaser, Pixi,
 * three.js), иначе мост потянул бы движок в любой билд.
 */
import type {
  EngineCommand,
  WebBootFn,
  WebBootOptions,
  WebGameBridge,
  WebHostBridge,
} from '@omega/webbridge-protocol';
import type { BridgeBase } from '../core/BridgeBase';
import type { BridgeTransport } from '../core/BridgeTransport';

export interface WebBootConfig<TBridge extends BridgeBase, TGame> {
  /** Создать мост поверх транспорта в React. */
  createBridge(transport: BridgeTransport): TBridge;
  /**
   * Создать игру внутри `container` (`new Phaser.Game(...)`, `new Application()`
   * Pixi и т. п.); сцены получают мост и подписываются на его сигналы. Позвать
   * `host.ready()` обязан сам вызывающий код — когда игра реально готова
   * принимать команды (аналог Unity `isLoaded`).
   */
  createGame(bridge: TBridge, container: HTMLElement, options: WebBootOptions, host: WebHostBridge): TGame;
  /** Уничтожить игру при размонтировании хоста. */
  destroyGame(game: TGame): void;
}

export const createWebBoot = <TBridge extends BridgeBase, TGame>(
  config: WebBootConfig<TBridge, TGame>,
): WebBootFn => (host, container, options = {}): WebGameBridge => {
  const transport: BridgeTransport = { send: (event) => host.emit(event) };
  const bridge = config.createBridge(transport);
  const game = config.createGame(bridge, container, options, host);

  return {
    receive: (command: EngineCommand) => bridge.receive(command),
    destroy: () => {
      bridge.dispose();
      config.destroyGame(game);
    },
  };
};

/**
 * Отдать фабрику шеллу. Выставляет и прежнее имя `__PHASER_BOOT__`: шеллы тегов
 * до перехода на `__WEB_GAME_BOOT__` ищут только его, а билд игры конфигуратор
 * может выпустить с любым из них.
 */
export const registerWebBoot = (boot: WebBootFn): void => {
  window.__WEB_GAME_BOOT__ = boot;
  window.__PHASER_BOOT__ = boot;
};
