/**
 * A mine-slot reply as the scene plays it. One `ApplySpinResult` carries every round — the base spin and the
 * free spins — on one field. Per round: the reels stop, the round's pickaxes strike in list order, then its
 * dynamite; a chest opens in the round its column is broken through.
 */
import { MINE_SLOT_REELS, type MineSlotSpinResult } from '@omega/webbridge-protocol';
import { FIELD_CELLS, FIELD_COLUMNS, MineField } from './mineSlotField';
import { MineSlotRoundError, readCodes, readIndex, readList, readNumber, readOptionalNumber, readRecord } from './mineSlotRead';
import { blockOf, reelSymbolOf, type Block, type ReelSymbol } from './mineSlotSymbols';

export const REEL_COUNT = MINE_SLOT_REELS.count;
export const REEL_ROWS = MINE_SLOT_REELS.rows;
const BOARD_CELLS = REEL_COUNT * REEL_ROWS;

export interface MineSlotBlockHit {
  readonly cell: number;
  readonly damage: number;
  /** Only on the hit that breaks a block that pays. */
  readonly coeff: number | null;
  readonly payout: number | null;
}

export type StrikerKind = 'pickaxe' | 'dynamite';

/** A pickaxe or a dynamite leaving its board cell for the field. */
export interface MineSlotStrike {
  readonly kind: StrikerKind;
  readonly round: number;
  readonly boardIndex: number;
  readonly column: number;
  readonly symbol: ReelSymbol;
  readonly hits: readonly MineSlotBlockHit[];
}

export interface MineSlotChestOpening {
  readonly column: number;
  readonly coeff: number;
}

export interface MineSlotRoundPlan {
  readonly board: readonly ReelSymbol[];
  readonly strikes: readonly MineSlotStrike[];
  readonly chests: readonly MineSlotChestOpening[];
}

export interface MineSlotPlan {
  readonly blocks: readonly Block[];
  readonly rounds: readonly MineSlotRoundPlan[];
  readonly coeff: number;
  readonly isWin: boolean;
  readonly winText: string;
}

const readBlockHit = (raw: unknown): MineSlotBlockHit => {
  const hit = readRecord(raw, 'broken block');
  return {
    cell: readIndex(hit.index, 'broken block index', FIELD_CELLS),
    damage: readNumber(hit.damage, 'broken block damage'),
    coeff: readOptionalNumber(hit.coeff, 'broken block coeff'),
    payout: readOptionalNumber(hit.payout, 'broken block payout'),
  };
};

const readStrikes = (raw: unknown, kind: StrikerKind, boards: readonly (readonly ReelSymbol[])[]): MineSlotStrike[] =>
  readList(raw, kind === 'pickaxe' ? 'pickaxes' : 'tnt').map((entry) => {
    const hit = readRecord(entry, kind);
    const round = readIndex(hit.round, `${kind} round`, boards.length);
    const boardIndex = readIndex(hit.index, `${kind} index`, BOARD_CELLS);
    const symbol = boards[round]?.[boardIndex] ?? { kind: 'empty' };
    if (symbol.kind !== kind) {
      throw new MineSlotRoundError(`${kind} of round ${round} sits on cell ${boardIndex}, which holds ${symbol.kind}`);
    }
    const hits = readList(hit.brokenBlocks, `${kind} brokenBlocks`).map(readBlockHit);
    return { kind, round, boardIndex, column: Math.floor(boardIndex / REEL_ROWS), symbol, hits };
  });

const readChests = (raw: unknown): MineSlotChestOpening[] =>
  readList(raw, 'chests').map((entry) => {
    const chest = readRecord(entry, 'chest');
    return { column: readIndex(chest.col, 'chest col', FIELD_COLUMNS), coeff: readNumber(chest.coeff, 'chest coeff') };
  });

/** Replays the hits on a scratch field: a chest opens after the round that breaks its column through. */
const scheduleChests = (
  blocks: readonly Block[],
  strikesByRound: readonly (readonly MineSlotStrike[])[],
  chests: readonly MineSlotChestOpening[],
): MineSlotChestOpening[][] => {
  const field = new MineField(blocks);
  let waiting = [...chests];
  const schedule = strikesByRound.map((strikes) => {
    strikes.forEach((strike) => strike.hits.forEach((hit) => field.hit(hit.cell, hit.damage)));
    const opened = waiting.filter((chest) => field.isBrokenThrough(chest.column));
    waiting = waiting.filter((chest) => !opened.includes(chest));
    return opened;
  });
  const [stray] = waiting;
  if (stray !== undefined) throw new MineSlotRoundError(`chest of column ${stray.column} opens, but the column is not broken through`);
  return schedule;
};

/** Throws `MineSlotRoundError` on a reply the scene cannot show truthfully. */
export const planMineSlotRound = (result: MineSlotSpinResult): MineSlotPlan => {
  const boardList = readList(result.boards, 'boards');
  if (boardList.length === 0) throw new MineSlotRoundError('reply without boards');
  const boards = boardList.map((board, index) => readCodes(board, `board ${index + 1}`, BOARD_CELLS, reelSymbolOf));
  const blocks = readCodes(result.field, 'field', FIELD_CELLS, blockOf);
  const pickaxes = readStrikes(result.pickaxes, 'pickaxe', boards);
  const dynamite = readStrikes(result.tnt, 'dynamite', boards);
  const strikesByRound = boards.map((_, round) => [
    ...pickaxes.filter((strike) => strike.round === round),
    ...dynamite.filter((strike) => strike.round === round),
  ]);
  const chests = scheduleChests(blocks, strikesByRound, readChests(result.chests));
  const winAmount = readNumber(result.winAmount, 'winAmount');
  return {
    blocks,
    rounds: boards.map((board, round) => ({ board, strikes: strikesByRound[round] ?? [], chests: chests[round] ?? [] })),
    coeff: readNumber(result.coeff, 'coeff'),
    isWin: winAmount > 0,
    winText: `${winAmount.toFixed(2)} ${String(result.currency)}`,
  };
};
