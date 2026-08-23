/**
 * Единственное место в пакете, знающее про Phaser-хост. Собирает фабрику
 * `window.__PHASER_BOOT__`, которую ждёт React-адаптер (`usePhaserAdapter`):
 * поднимает транспорт поверх `host.emit`, отдаёт мост игре и возвращает
 * `PhaserGameBridge` — приёмник команд.
 *
 * `TGame` намеренно generic: пакет не должен зависеть от `phaser` как от
 * пакета, иначе мост потянет за собой движок в любой билд.
 */
import type {
  EngineCommand,
  PhaserBootFn,
  PhaserBootOptions,
  PhaserGameBridge,
  PhaserHostBridge,
} from '@public/webbridge-protocol';
import type { BridgeBase } from '../core/BridgeBase';
import type { BridgeTransport } from '../core/BridgeTransport';

export interface PhaserBootConfig<TBridge extends BridgeBase, TGame> {
  /** Создать мост поверх транспорта в React. */
  createBridge(transport: BridgeTransport): TBridge;
  /**
   * Создать игру. Внутри — `new Phaser.Game(...)`; сцены получают мост и
   * подписываются на его сигналы. Позвать `host.ready()` обязан сам вызывающий
   * код — когда сцена реально готова принимать команды (аналог Unity `isLoaded`).
   */
  createGame(bridge: TBridge, container: HTMLElement, options: PhaserBootOptions, host: PhaserHostBridge): TGame;
  /** Уничтожить игру при размонтировании хоста. */
  destroyGame(game: TGame): void;
}

export const createPhaserBoot = <TBridge extends BridgeBase, TGame>(
  config: PhaserBootConfig<TBridge, TGame>,
): PhaserBootFn => (host, container, options = {}): PhaserGameBridge => {
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
