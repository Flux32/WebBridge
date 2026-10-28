import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  SlotBridge,
  SlotCoinBridge,
  SlotCoinMockHost,
  SlotMockHost,
  type SlotCoinMockHostOptions,
  type SlotMockHostOptions,
} from '../src';

describe('pre-1.15.0 slot names', () => {
  it('keeps SlotBridge as the slot-coin bridge itself', () => {
    expect(SlotBridge).toBe(SlotCoinBridge);
  });

  it('keeps SlotMockHost as the slot-coin mock host itself', () => {
    expect(SlotMockHost).toBe(SlotCoinMockHost);
  });

  it('keeps SlotMockHostOptions as the slot-coin mock host options', () => {
    expectTypeOf<SlotMockHostOptions>().toEqualTypeOf<SlotCoinMockHostOptions>();
  });
});
