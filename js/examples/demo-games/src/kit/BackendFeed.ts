/**
 * The showcase part of a demo game: a short live log of what crossed the bridge — the backend's answer
 * as the host forwarded it (`←`) and the game's own report back (`→`). A tester sees the protocol of the
 * mode without opening the console.
 */
import type { EngineCommand, EngineEvent } from '@omega/webbridge-protocol';

export type FeedDirection = 'in' | 'out';

export interface FeedLine {
  readonly direction: FeedDirection;
  readonly text: string;
}

const MAX_LINES = 5;
/** The header fits each line to the canvas width; this only bounds what a frame measures. */
const MAX_PAYLOAD_CHARS = 120;

/** Plumbing the host sends many times a second or on every resize: noise in a protocol log. */
const QUIET_TYPES: ReadonlySet<string> = new Set([
  'SyncUiVisibility',
  'SetCanvasSize',
  'SetDesktopBetBarViewportMetrics',
  'SetMobileBetBarViewportMetrics',
  'SetWheelBetBarMetrics',
  'ChangeOrientation',
  'ApplyTranslations',
  'SetLoggingEnabled',
  'SetAssetsBasePath',
  'UiVisibility',
  'RequestBetBarViewportMetrics',
  'PlaySound',
  'PlayLoop',
  'StopLoop',
]);

const compact = (value: unknown): string => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined) return '';
  return text.length > MAX_PAYLOAD_CHARS ? `${text.slice(0, MAX_PAYLOAD_CHARS - 1)}…` : text;
};

/** `Type payload` with the payload squeezed into one short line. */
export const describeMessage = (message: EngineCommand | EngineEvent): string | null => {
  if (QUIET_TYPES.has(message.type)) return null;
  if ('payload' in message && message.payload !== undefined) return `${message.type} ${compact(message.payload)}`;
  if ('raw' in message) return `${message.type} ${compact(message.raw)}`;
  return message.type;
};

export class BackendFeed {
  private readonly lines: FeedLine[] = [];

  public constructor(private readonly onChange: () => void) {}

  public get entries(): readonly FeedLine[] {
    return this.lines;
  }

  public record(direction: FeedDirection, message: EngineCommand | EngineEvent): void {
    const text = describeMessage(message);
    if (text === null) return;
    this.lines.push({ direction, text });
    if (this.lines.length > MAX_LINES) this.lines.shift();
    this.onChange();
  }
}
