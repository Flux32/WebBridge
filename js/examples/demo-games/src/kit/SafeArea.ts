/**
 * The part of the canvas the shell's interface leaves to the game. The host reports how much its bet bar
 * covers from the bottom and its top strip from the top, as canvas fractions; a scene lays itself out
 * inside what is left.
 */
import type { BetBarViewportMetricsPayload } from '@omega/webbridge-protocol';
import type { BridgeBase } from '@omega/webbridge-js';
import type { Rect } from './paint';
import type { Viewport } from './Surface';

/** Until the host reports its bar, the bar is assumed to cover the usual share of a phone screen. */
const BAR_SHARE_BEFORE_METRICS = 0.24;
const EDGE_PADDING = 16;

interface Insets {
  readonly top: number;
  readonly bottom: number;
}

const insetsOf = (payload: string): Insets => {
  const metrics = JSON.parse(payload) as BetBarViewportMetricsPayload;
  return { top: metrics.heightStartViewport ?? 0, bottom: metrics.heightEndViewport };
};

export class SafeArea {
  private desktop: Insets | null = null;
  private mobile: Insets | null = null;
  private readonly unsubscribers: (() => void)[];

  public constructor(bridge: BridgeBase, onChange: () => void) {
    this.unsubscribers = [
      bridge.desktopBetBarViewportMetricsReceived.add((payload) => {
        this.desktop = insetsOf(payload);
        onChange();
      }),
      bridge.mobileBetBarViewportMetricsReceived.add((payload) => {
        this.mobile = insetsOf(payload);
        onChange();
      }),
    ];
  }

  /** The playfield: the canvas minus the host's bars and an edge padding. */
  public content(viewport: Viewport): Rect {
    const isPortrait = viewport.width < viewport.height;
    const insets = (isPortrait ? this.mobile : this.desktop) ?? { top: 0, bottom: BAR_SHARE_BEFORE_METRICS };
    const top = viewport.height * insets.top + EDGE_PADDING;
    const bottom = viewport.height * (1 - insets.bottom) - EDGE_PADDING;
    return {
      x: EDGE_PADDING,
      y: top,
      width: viewport.width - EDGE_PADDING * 2,
      height: Math.max(0, bottom - top),
    };
  }

  public destroy(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }
}
