/**
 * The plinko round as the engine sees it: the config carries a slot line per risk (`coefficients`), and a
 * drop (`ApplyDropResult`) says where the ball lands (`resultPosition`, an index into the line of its
 * `risk`), what that pays (`coeff`) and the win (`winAmount`). The risk is the bet bar's: the engine learns
 * it only with a drop.
 */
import { readNumber, readNumbers, readRecord, readText, PlinkoPayloadError, type PayloadRecord } from './payload';
import { slotLineOf, type Slot } from './slotLine';

export type PlinkoRisk = 'LOW' | 'MEDIUM' | 'HIGH';

const RISKS: readonly PlinkoRisk[] = ['LOW', 'MEDIUM', 'HIGH'];
/** The first risk of the bet bar: the board shows its line until a drop names another. */
const RISK_BEFORE_FIRST_DROP: PlinkoRisk = 'LOW';

export interface PlinkoDrop {
  readonly slot: number;
  readonly coefficient: number;
  readonly risk: PlinkoRisk;
  readonly winAmount: string;
  readonly currency: string;
}

export type PlinkoOutcome = 'win' | 'even' | 'loss';

export const outcomeOf = (coefficient: number): PlinkoOutcome => {
  if (coefficient > 1) return 'win';
  return coefficient < 1 ? 'loss' : 'even';
};

const isRisk = (value: unknown): value is PlinkoRisk => RISKS.some((risk) => risk === value);

const readRisk = (record: PayloadRecord): PlinkoRisk => {
  const risk = record.risk;
  if (!isRisk(risk)) throw new PlinkoPayloadError(`risk is not one of ${RISKS.join(', ')}: ${JSON.stringify(risk)}`);
  return risk;
};

export class PlinkoRound {
  private lines: Readonly<Record<PlinkoRisk, readonly Slot[]>> | null = null;
  private currentRisk: PlinkoRisk = RISK_BEFORE_FIRST_DROP;

  public get risk(): PlinkoRisk {
    return this.currentRisk;
  }

  /** The slot line of the current risk; empty until the config arrives. */
  public get slots(): readonly Slot[] {
    return this.lines?.[this.currentRisk] ?? [];
  }

  public setConfig(config: unknown): void {
    const coefficients = readRecord(readRecord(config, 'config').coefficients, 'config.coefficients');
    this.lines = {
      LOW: slotLineOf(readNumbers(coefficients.LOW, 'coefficients.LOW')),
      MEDIUM: slotLineOf(readNumbers(coefficients.MEDIUM, 'coefficients.MEDIUM')),
      HIGH: slotLineOf(readNumbers(coefficients.HIGH, 'coefficients.HIGH')),
    };
  }

  /** Reads a drop and switches the board to its risk line. Throws `PlinkoPayloadError` on a broken one. */
  public readDrop(result: unknown): PlinkoDrop {
    const record = readRecord(result, 'drop result');
    const risk = readRisk(record);
    const slot = readNumber(record, 'resultPosition');
    const line = this.lines?.[risk] ?? [];
    if (!Number.isInteger(slot) || slot < 0 || slot >= line.length) {
      throw new PlinkoPayloadError(`resultPosition ${slot} is not one of the ${line.length} ${risk} slots`);
    }
    this.currentRisk = risk;
    return {
      slot,
      coefficient: readNumber(record, 'coeff'),
      risk,
      winAmount: readText(record, 'winAmount'),
      currency: readText(record, 'currency'),
    };
  }
}
