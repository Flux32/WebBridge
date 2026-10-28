/**
 * The boot every demo game goes through — `createWebBoot` of the bridge package, plus what the shell
 * needs from any web engine: `host.ready()` once the game takes commands, `UiVisibility` (the shell's
 * "bridge ready"), the mode's initial sync, a tap on the scene as the Play button, and the backend feed.
 */
import { createWebBoot, type BridgeBase, type BridgeTransport } from '@omega/webbridge-js';
import type { EngineCommand, WebBootFn, WebBootOptions, WebHostBridge } from '@omega/webbridge-protocol';
import type { BackendFeed } from './BackendFeed';
import { Stage, type SceneRenderer } from './Stage';

export interface DemoScene {
  readonly renderer: SceneRenderer;
  /** A tap on the playfield; without it a tap asks the host for a move (`RequestPlay`). */
  onTap?(): void;
  destroy(): void;
}

export interface DemoContext<TBridge extends BridgeBase> {
  readonly bridge: TBridge;
  readonly stage: Stage;
}

export interface DemoMode<TBridge extends BridgeBase> {
  readonly title: string;
  readonly accent: string;
  createBridge(transport: BridgeTransport): TBridge;
  createScene(context: DemoContext<TBridge>): DemoScene;
  /** Asks the host for the mode's config and state once the game is ready. */
  startSync(bridge: TBridge): void;
}

const VISIBLE_BARS = {
  hideDesktopBetBar: false,
  hideMobileBetBar: false,
  desktopBetBarInteractable: true,
  mobileBetBarInteractable: true,
} as const;

class DemoGame<TBridge extends BridgeBase> {
  private readonly stage: Stage;
  private readonly scene: DemoScene;
  private readonly readyTimerId: number;
  private readonly unsubscribe: () => void;

  public constructor(
    mode: DemoMode<TBridge>,
    private readonly bridge: TBridge,
    container: HTMLElement,
    options: WebBootOptions,
    host: WebHostBridge,
  ) {
    this.stage = new Stage({ container, devicePixelRatio: options.devicePixelRatio, bridge, title: mode.title, accent: mode.accent });
    this.scene = mode.createScene({ bridge, stage: this.stage });
    this.stage.setRenderer(this.scene.renderer);
    this.stage.canvas.addEventListener('pointerdown', this.onTap);
    this.unsubscribe = bridge.disabledPlayPressed.add(() => this.stage.shake());
    // A tick later, not inside the boot call: a mock host attaches to the returned game first.
    this.readyTimerId = window.setTimeout(() => {
      host.ready();
      bridge.setUiVisibility(VISIBLE_BARS);
      mode.startSync(bridge);
    }, 0);
  }

  public get feed(): BackendFeed {
    return this.stage.feed;
  }

  public destroy(): void {
    window.clearTimeout(this.readyTimerId);
    this.stage.canvas.removeEventListener('pointerdown', this.onTap);
    this.unsubscribe();
    this.scene.destroy();
    this.stage.destroy();
  }

  private readonly onTap = (): void => {
    if (this.scene.onTap) this.scene.onTap();
    else this.bridge.requestPlay();
  };
}

/** The `__WEB_GAME_BOOT__` of one demo game; both directions of the bridge land in its feed. */
export const createDemoBoot =
  <TBridge extends BridgeBase>(mode: DemoMode<TBridge>): WebBootFn =>
  (host, container, options) => {
    let feed: BackendFeed | null = null;
    const boot = createWebBoot<TBridge, DemoGame<TBridge>>({
      createBridge: (transport) =>
        mode.createBridge({
          send: (event) => {
            feed?.record('out', event);
            transport.send(event);
          },
        }),
      createGame: (bridge, gameContainer, gameOptions, gameHost) => {
        const game = new DemoGame(mode, bridge, gameContainer, gameOptions, gameHost);
        feed = game.feed;
        return game;
      },
      destroyGame: (game) => game.destroy(),
    });
    const game = boot(host, container, options);
    return {
      receive: (command: EngineCommand) => {
        feed?.record('in', command);
        game.receive(command);
      },
      destroy: () => game.destroy?.(),
    };
  };
