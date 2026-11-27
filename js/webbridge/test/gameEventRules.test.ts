import { GAME_EVENT_LIMITS } from '@omega/webbridge-protocol';
import { describe, expect, it } from 'vitest';
import { findGameEventRejection } from '../src/core/gameEventRules';

describe('findGameEventRejection', () => {
  it('accepts a plain custom event with and without params', () => {
    expect(findGameEventRejection('bonus_meter_full', undefined)).toBeNull();
    expect(findGameEventRejection('bonus_meter_full', { stage: 2, fast_game: true, kind: 'gold' })).toBeNull();
  });

  describe('name', () => {
    it.each(['', 'Level', '1level', 'level-1', 'level start', 'a'.repeat(GAME_EVENT_LIMITS.nameMaxLength + 1)])(
      'rejects the malformed name %j as bad_name',
      (name) => {
        expect(findGameEventRejection(name, undefined)).toBe('bad_name');
      },
    );

    it.each([undefined, null, 5, {}, ['a']])('rejects the non-string name %j as bad_name instead of throwing', (name) => {
      expect(findGameEventRejection(name as never, undefined)).toBe('bad_name');
    });

    it('accepts a name of the maximum length', () => {
      expect(findGameEventRejection('a'.repeat(GAME_EVENT_LIMITS.nameMaxLength), undefined)).toBeNull();
    });

    it('rejects a digit run in the name as pii', () => {
      expect(findGameEventRejection('call_1234567', undefined)).toBe('pii');
      expect(findGameEventRejection('call_123456', undefined)).toBeNull();
    });

    it.each(['shell_event_rejected', 'tutorial_step', 'ad_shown', 'session_start', 'startup', 'heartbeat', 'first_bet', 'perf_sample', 'error'])(
      'rejects the reserved name %s',
      (name) => {
        expect(findGameEventRejection(name, undefined)).toBe('reserved_name');
      },
    );

    it('lets a reserved word through when it is only part of the name', () => {
      expect(findGameEventRejection('error_popup', undefined)).toBeNull();
      expect(findGameEventRejection('bad_shell_event', undefined)).toBeNull();
    });
  });

  describe('params', () => {
    it('accepts the maximum number of params and rejects one more', () => {
      const params = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i}`, i]));

      expect(findGameEventRejection('many', params(GAME_EVENT_LIMITS.maxParams))).toBeNull();
      expect(findGameEventRejection('many', params(GAME_EVENT_LIMITS.maxParams + 1))).toBe('bad_params');
    });

    it.each(['Stage', '1st', 'stage-1', '', 'k'.repeat(GAME_EVENT_LIMITS.keyMaxLength + 1)])(
      'rejects the malformed key %j as bad_params',
      (key) => {
        expect(findGameEventRejection('evt', { [key]: 1 })).toBe('bad_params');
      },
    );

    it('checks the string length', () => {
      expect(findGameEventRejection('evt', { s: 'x'.repeat(GAME_EVENT_LIMITS.stringMaxLength) })).toBeNull();
      expect(findGameEventRejection('evt', { s: 'x'.repeat(GAME_EVENT_LIMITS.stringMaxLength + 1) })).toBe('bad_params');
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, 1e15 + 1, -1e16])('rejects the number %s', (value) => {
      expect(findGameEventRejection('evt', { n: value })).toBe('bad_params');
    });

    it('accepts the numeric bounds', () => {
      expect(findGameEventRejection('evt', { n: 1e15, m: -1e15, z: 0, f: 0.5 })).toBeNull();
    });

    it.each([null, undefined, [1], { a: 1 }, () => 1, 10n])('rejects a non-primitive value %s', (value) => {
      expect(findGameEventRejection('evt', { v: value as never })).toBe('bad_params');
    });

    it('rejects params over one kilobyte of JSON', () => {
      const wide = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`key_${i}`, 'y'.repeat(GAME_EVENT_LIMITS.stringMaxLength)]));

      expect(findGameEventRejection('evt', wide)).toBe('too_large');
    });

    it('counts the params size in UTF-8 bytes, not characters', () => {
      const wide = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`key_${i}`, 'я'.repeat(100)]));

      expect(JSON.stringify(wide).length).toBeLessThan(GAME_EVENT_LIMITS.paramsMaxBytes);
      expect(findGameEventRejection('evt', wide)).toBe('too_large');
    });
  });

  describe('pii and money', () => {
    it.each(['email', 'phone', 'name', 'first_name', 'last_name', 'nickname', 'username', 'user_id', 'player_id', 'ip', 'address', 'token', 'password', 'card'])(
      'rejects the key %s as pii',
      (key) => {
        expect(findGameEventRejection('evt', { [key]: 'x' })).toBe('pii');
      },
    );

    it('compares the key as a whole', () => {
      expect(findGameEventRejection('evt', { card_kind: 'ace', token_type: 'gold' })).toBeNull();
    });

    it.each(['bet', 'stake', 'win', 'payout', 'balance'])('rejects the key %s as money', (key) => {
      expect(findGameEventRejection('evt', { [key]: 1 })).toBe('money');
    });

    it.each(['a@b.co', 'see https://example.com', 'www.example.com', '123e4567-e89b-12d3-a456-426614174000', 'id 1234567'])(
      'rejects the pii-looking value %j',
      (value) => {
        expect(findGameEventRejection('evt', { note: value })).toBe('pii');
      },
    );

    it('accepts a number with a long digit run because only strings are scanned', () => {
      expect(findGameEventRejection('evt', { score: 12345678 })).toBeNull();
    });
  });

  describe('standard events', () => {
    it('accepts the documented shapes', () => {
      expect(findGameEventRejection('level_start', { level: 'boss_1', attempt: 3 })).toBeNull();
      expect(findGameEventRejection('level_complete', { level: '3', duration_ms: 0, score: -5 })).toBeNull();
      expect(findGameEventRejection('level_fail', { level: 'x', reason: 'timeout' })).toBeNull();
      expect(findGameEventRejection('resource_source', { currency: 'gems', amount: 5, source: 'chest' })).toBeNull();
      expect(findGameEventRejection('resource_sink', { currency: 'gems', amount: 0.5, sink: 'reroll' })).toBeNull();
    });

    it('allows own params on top of the standard ones', () => {
      expect(findGameEventRejection('level_start', { level: '1', first_try: true })).toBeNull();
    });

    it('rejects a missing required param', () => {
      expect(findGameEventRejection('level_start', {})).toBe('standard_params');
      expect(findGameEventRejection('level_start', undefined)).toBe('standard_params');
      expect(findGameEventRejection('resource_sink', { currency: 'gems', amount: 3 })).toBe('standard_params');
    });

    it('rejects a number where the standard event wants a string', () => {
      expect(findGameEventRejection('level_start', { level: 3 })).toBe('standard_params');
    });

    it.each([
      ['level_start', { level: '1', attempt: 0 }],
      ['level_start', { level: '1', attempt: 1.5 }],
      ['level_complete', { level: '1', duration_ms: -1 }],
      ['level_fail', { level: '1', reason: 'Time Out' }],
      ['resource_source', { currency: 'EUR', amount: 5, source: 'chest' }],
      ['resource_source', { currency: 'gems', amount: 0, source: 'chest' }],
      ['resource_sink', { currency: 'gems', amount: -1, sink: 'reroll' }],
      ['resource_sink', { currency: 'gems', amount: '3', sink: 'reroll' }],
    ] as const)('rejects %s with %j', (name, params) => {
      expect(findGameEventRejection(name, params)).toBe('standard_params');
    });

    it('reports bad_params for a structural fault before the standard shape', () => {
      expect(findGameEventRejection('level_start', { level: 'x'.repeat(200) })).toBe('bad_params');
    });
  });
});
