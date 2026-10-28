import type { EngineEvent } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import type { BridgeBase } from '../src/core/BridgeBase';
import { CrushBridge } from '../src/crush/CrushBridge';
import { SlotCoinBridge } from '../src/slot-coin/SlotCoinBridge';
import { recordingTransport } from './recordingTransport';

const bridges: ReadonlyArray<[string, (transport: ReturnType<typeof recordingTransport>) => BridgeBase]> = [
  ['CrushBridge', (transport) => new CrushBridge(transport)],
  ['SlotCoinBridge', (transport) => new SlotCoinBridge(transport)],
];

describe.each(bridges)('%s core events', (_name, createBridge) => {
  it('sends a sound with its volume and omits the volume when none is given', () => {
    const transport = recordingTransport();
    const bridge = createBridge(transport);

    bridge.playSound('click', 0.5);
    bridge.playMusic('theme');

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'PlaySound', key: 'click', volume: 0.5 },
      { type: 'PlayMusic', key: 'theme' },
    ]);
  });

  it('sends a looped sound and its stop', () => {
    const transport = recordingTransport();
    const bridge = createBridge(transport);

    bridge.playLoop('wind', 0.2);
    bridge.stopLoop('wind');

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'PlayLoop', key: 'wind', volume: 0.2 },
      { type: 'StopLoop', key: 'wind' },
    ]);
  });

  it('merges every UI visibility patch into the state it sends', () => {
    const transport = recordingTransport();
    const bridge = createBridge(transport);

    bridge.setUiVisibility({ hideDesktopBetBar: false });
    bridge.setUiVisibility({ hideLogo: true });

    expect(transport.sent.at(-1)).toEqual<EngineEvent>({
      type: 'UiVisibility',
      payload: { hideDesktopBetBar: false, hideLogo: true },
    });
  });

  it('answers SyncUiVisibility with the visibility it holds', () => {
    const transport = recordingTransport();
    const bridge = createBridge(transport);
    bridge.setUiVisibility({ hideDesktopBetBar: false });

    bridge.receive({ type: 'SyncUiVisibility' });

    expect(transport.sent.at(-1)).toEqual<EngineEvent>({
      type: 'UiVisibility',
      payload: { hideDesktopBetBar: false },
    });
  });
});
