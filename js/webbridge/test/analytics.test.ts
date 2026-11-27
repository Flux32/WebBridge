import type { EngineEvent } from '@omega/webbridge-protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BridgeLogger } from '../src/core/BridgeLogger';
import { CrushBridge } from '../src/crush/CrushBridge';
import { SlotCoinBridge } from '../src/slot-coin/SlotCoinBridge';
import { recordingTransport } from './recordingTransport';

describe.each([
  ['CrushBridge', (transport: ReturnType<typeof recordingTransport>) => new CrushBridge(transport)],
  ['SlotCoinBridge', (transport: ReturnType<typeof recordingTransport>) => new SlotCoinBridge(transport)],
])('%s analytics', (_name, createBridge) => {
  const setup = () => {
    const transport = recordingTransport();
    return { transport, analytics: createBridge(transport).analytics };
  };

  beforeEach(() => {
    BridgeLogger.isEnabled = true;
  });

  afterEach(() => {
    BridgeLogger.isEnabled = false;
    vi.restoreAllMocks();
  });

  it('sends a custom event with its params', () => {
    const { transport, analytics } = setup();

    analytics.track('bonus_meter_full', { stage: 2, fast_game: true });

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'TrackEvent', name: 'bonus_meter_full', params: { stage: 2, fast_game: true } },
    ]);
  });

  it('omits params when the game gives none', () => {
    const { transport, analytics } = setup();

    analytics.track('bonus_meter_full');

    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'TrackEvent', name: 'bonus_meter_full' }]);
  });

  it('sends a copy of the params so a later change by the game does not reach the shell inbox', () => {
    const { transport, analytics } = setup();
    const params = { stage: 2 };

    analytics.track('bonus_meter_full', params);
    params.stage = 3;

    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'TrackEvent', name: 'bonus_meter_full', params: { stage: 2 } }]);
    const sent = transport.sent[0];
    expect(sent?.type === 'TrackEvent' && sent.params).not.toBe(params);
  });

  it('turns a level into a string in the level helpers', () => {
    const { transport, analytics } = setup();

    analytics.levelStart('boss_1', { attempt: 3 });
    analytics.levelComplete(3, { duration_ms: 41_200, score: 1200 });
    analytics.levelFail('boss_1', { reason: 'timeout' });

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'TrackEvent', name: 'level_start', params: { level: 'boss_1', attempt: 3 } },
      { type: 'TrackEvent', name: 'level_complete', params: { level: '3', duration_ms: 41_200, score: 1200 } },
      { type: 'TrackEvent', name: 'level_fail', params: { level: 'boss_1', reason: 'timeout' } },
    ]);
  });

  it('sends a level event with only the level', () => {
    const { transport, analytics } = setup();

    analytics.levelStart(1);

    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'TrackEvent', name: 'level_start', params: { level: '1' } }]);
  });

  it('sends the resource helpers', () => {
    const { transport, analytics } = setup();

    analytics.resourceSource({ currency: 'gems', amount: 5, source: 'chest' });
    analytics.resourceSink({ currency: 'gems', amount: 3, sink: 'reroll' });

    expect(transport.sent).toEqual<EngineEvent[]>([
      { type: 'TrackEvent', name: 'resource_source', params: { currency: 'gems', amount: 5, source: 'chest' } },
      { type: 'TrackEvent', name: 'resource_sink', params: { currency: 'gems', amount: 3, sink: 'reroll' } },
    ]);
  });

  it('lets the helper level win over a level in the extra params', () => {
    const { transport, analytics } = setup();

    analytics.levelStart('boss_1', { level: 'other' } as never);

    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'TrackEvent', name: 'level_start', params: { level: 'boss_1' } }]);
  });

  it('warns with the reason but still sends an event the shell will reject', () => {
    const { transport, analytics } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    analytics.track('Bad Name', { email: 'a@b.co' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('bad_name');
    expect(transport.sent).toEqual<EngineEvent[]>([{ type: 'TrackEvent', name: 'Bad Name', params: { email: 'a@b.co' } }]);
  });

  it('warns about a standard event with the wrong params through the common track path', () => {
    const { analytics } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    analytics.track('level_start', { level: 3 });

    expect(warn.mock.calls[0]?.[0]).toContain('standard_params');
  });

  it('does not warn for a valid event', () => {
    const { analytics } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    analytics.track('bonus_meter_full', { stage: 2 });
    analytics.levelComplete('boss_1', { score: 1 });

    expect(warn).not.toHaveBeenCalled();
  });

  it('stays quiet while the bridge logging is off', () => {
    BridgeLogger.isEnabled = false;
    const { transport, analytics } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    analytics.track('Bad Name');

    expect(warn).not.toHaveBeenCalled();
    expect(transport.sent).toHaveLength(1);
  });

  it.each([undefined, null, 5, Symbol('name')])('does not throw on the non-string name %s, it warns and still sends', (name) => {
    const { transport, analytics } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => analytics.track(name as never)).not.toThrow();

    expect(warn.mock.calls[0]?.[0]).toContain('bad_name');
    expect(transport.sent).toHaveLength(1);
  });

  it('warns about an undefined param value because the shell rejects it too', () => {
    const { analytics } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    analytics.levelStart('boss_1', { attempt: undefined } as never);

    expect(warn.mock.calls[0]?.[0]).toContain('bad_params');
  });

  it('does not throw on a nonsense value, it only warns', () => {
    const { transport, analytics } = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => analytics.track('evt', { nested: { a: 1 } as never, big: 10n as never })).not.toThrow();
    expect(transport.sent).toHaveLength(1);
  });
});
