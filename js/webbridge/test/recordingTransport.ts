import type { EngineEvent } from '@omega/webbridge-protocol';
import type { BridgeTransport } from '../src/core/BridgeTransport';

/** Транспорт-накопитель: хранит всё, что мост отправил в React, по порядку. */
export interface RecordingTransport extends BridgeTransport {
  readonly sent: EngineEvent[];
}

export const recordingTransport = (): RecordingTransport => {
  const sent: EngineEvent[] = [];
  return {
    sent,
    send: (event) => {
      sent.push(event);
    },
  };
};
