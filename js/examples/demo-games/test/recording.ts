import type { EngineEvent } from '@omega/webbridge-protocol';
import type { BridgeTransport } from '@omega/webbridge-js';

/** Keeps everything a bridge sent to the host, in order. */
export interface RecordingTransport extends BridgeTransport {
  readonly sent: EngineEvent[];
}

export const recordingTransport = (): RecordingTransport => {
  const sent: EngineEvent[] = [];
  return { sent, send: (event) => void sent.push(event) };
};

/** A motion the test finishes by hand: the scene must wait for it before reporting the move. */
export interface PendingMotion {
  readonly name: string;
  finish(): void;
}

/** Lets every queued promise continuation run: a macrotask comes after all microtasks. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export const manualMotions = () => {
  const pending: PendingMotion[] = [];
  const play = (name: string): Promise<boolean> =>
    new Promise((resolve) => pending.push({ name, finish: () => resolve(true) }));
  /** Finishes every motion, including the ones the finished ones start, and lets the awaiting code run. */
  const finishAll = async (): Promise<void> => {
    await settle();
    while (pending.length > 0) {
      pending.splice(0).forEach((motion) => motion.finish());
      await settle();
    }
  };
  return { pending, play, finishAll };
};

export const eventTypes = (transport: RecordingTransport): string[] => transport.sent.map((event) => event.type);
