import type { EngineCommand, WebGameBridge } from '@omega/webbridge-protocol';

/** Игра-накопитель для мок-хостов: хранит всё, что хост ей прислал, по порядку. */
export interface RecordingGame extends WebGameBridge {
  readonly received: EngineCommand[];
}

export const recordingGame = (): RecordingGame => {
  const received: EngineCommand[] = [];
  return {
    received,
    receive: (command) => {
      received.push(command);
    },
    destroy: () => {},
  };
};

/** Разобранный JSON-payload последней команды этого типа. */
export const lastPayload = (game: RecordingGame, type: EngineCommand['type']): unknown => {
  const command = game.received.filter((received) => received.type === type).at(-1);
  if (command === undefined || !('payload' in command) || typeof command.payload !== 'string') {
    throw new Error(`Хост не присылал ${type} со строковым payload`);
  }
  return JSON.parse(command.payload);
};
