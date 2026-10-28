import type { WebBootFn, WebGameBridge, WebHostBridge } from '@omega/webbridge-protocol';

/** A mock host of the bridge package: it stands in for the shell and answers the game itself. */
export interface DevMockHost {
  readonly host: WebHostBridge & { attach(game: WebGameBridge): void };
  bindKeys(): void;
}

/** What the dev page needs of a mode: its demo game's boot and the mode's mock host. */
export interface DevMode {
  readonly boot: WebBootFn;
  createMockHost(): DevMockHost;
  readonly hint: string;
}
