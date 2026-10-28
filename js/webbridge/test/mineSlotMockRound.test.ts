import { describe, expect, it } from 'vitest';
import { playMineSlotRounds } from '../src/mine-slot/mineSlotMockRound';

/** Five columns of six blocks; column-major, the top block first. */
const FIELD = 'dsrgco' + 'dddddd' + 'dsrgco' + 'dsrgco' + 'dsrgco';
const EMPTY_BOARD = 'xxxxxxxxxxxxxxx';

/** A board with `symbol` at the top cell of `reel`. */
const boardWith = (cells: Record<number, string>): string =>
  [...EMPTY_BOARD].map((symbol, index) => cells[index] ?? symbol).join('');

const play = (boards: readonly string[]) => playMineSlotRounds({ boards, field: FIELD, betAmount: 1, random: () => 0 });

describe('playMineSlotRounds', () => {
  it('spends a pickaxe strength on the blocks of its column, top first, paying nothing for dirt', () => {
    const result = play([boardWith({ 0: '2' })]);

    expect(result.pickaxes).toEqual([
      { round: 0, index: 0, brokenBlocks: [{ index: 0, damage: 1 }, { index: 1, damage: 1 }] },
    ]);
  });

  it('pays a block broken by two pickaxes on the hit that breaks it', () => {
    const result = play([boardWith({ 0: '1', 1: '2' })]);

    expect(result.pickaxes.map((hit) => hit.brokenBlocks)).toEqual([
      [{ index: 0, damage: 1 }],
      [{ index: 1, damage: 2, coeff: 0.1, payout: '0.10' }],
    ]);
    expect(result.coeff).toBe(0.1);
  });

  it('makes every pickaxe of its reel strength five with an enchantment book', () => {
    const result = play([boardWith({ 0: '1', 1: 'e' })]);

    expect(result.pickaxes[0]?.brokenBlocks.reduce((sum, block) => sum + block.damage, 0)).toBe(5);
  });

  it('opens the chest of a column broken through and multiplies the win by it', () => {
    const result = play([boardWith({ 3: '5', 4: '1' })]);

    expect(result.chests).toHaveLength(1);
    expect(result.chests[0]?.col).toBe(1);
    expect(result.coeff).toBe(0);
  });

  it('lets dynamite fall after the pickaxes and hit its column and both neighbours', () => {
    const result = play([boardWith({ 6: 'd' })]);

    expect(result.tnt[0]?.brokenBlocks.map((block) => block.index)).toEqual([12, 6, 18]);
  });

  it('keeps the field between the rounds of a bonus game', () => {
    const result = play([boardWith({ 0: '1' }), boardWith({ 0: '1' })]);

    expect(result.pickaxes.map((hit) => hit.brokenBlocks[0]?.index)).toEqual([0, 1]);
    expect(result.rounds).toBe(2);
  });
});
