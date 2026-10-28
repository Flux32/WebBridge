/**
 * Plinko Aztec drawn: the readout on top, the shared peg board under it, the fortune wheel over the board
 * and, in the bonus game, an amber frame that invites the next tap. Drops and the wheel are motions the
 * controller awaits before it tells the host the round has played out.
 */
import { drawText, fillRoundRect, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import { drawReadout, readoutBottomOf } from '../plinko/drawReadout';
import { PegBoard } from '../plinko/PegBoard';
import type { Slot } from '../plinko/slotLine';
import { aztecReadout, type AztecViewModel } from './aztecReadout';
import type { AztecMotions } from './PlinkoAztecController';
import type { WheelSpin } from './wheel';
import { WheelOverlay } from './WheelOverlay';

export interface AztecSceneModel extends AztecViewModel {
  readonly line: readonly Slot[];
}

const BOARD_GAP = 10;
const BONUS_PILL = 'BONUS · TAP TO DROP';
const PILL_HEIGHT = 24;

export class AztecView implements SceneRenderer, AztecMotions {
  private readonly board: PegBoard;
  private readonly wheel: WheelOverlay;
  private readonly bonusFrame = withAlpha(PALETTE.amber, 0.5);
  private readonly bonusPill = withAlpha(PALETTE.amber, 0.2);
  private boardArea: Rect = { x: 0, y: 0, width: 0, height: 0 };

  public constructor(
    private readonly stage: Stage,
    private readonly accent: string,
    private readonly model: () => AztecSceneModel,
  ) {
    this.board = new PegBoard(stage, accent, () => this.model().line);
    this.wheel = new WheelOverlay(stage, accent);
  }

  public drop(slots: readonly number[]): Promise<boolean> {
    return this.board.drop(slots);
  }

  public spinWheel(spin: WheelSpin): Promise<boolean> {
    return this.wheel.play(spin);
  }

  public celebrate(): void {
    const { x, y, width, height } = this.boardArea;
    this.stage.celebrate(x + width / 2, y + height * 0.8, [this.accent, PALETTE.amber, PALETTE.mint, PALETTE.violet]);
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const view = this.model();
    const { playfield, now } = frame;
    const top = readoutBottomOf(playfield) + BOARD_GAP;
    this.boardArea = { x: playfield.x, y: top, width: playfield.width, height: playfield.y + playfield.height - top };
    if (view.phase === 'bonus' || view.phase === 'bonus-step') this.drawBonusFrame(context, view, now);
    this.board.draw(context, this.boardArea, now);
    this.wheel.draw(context, this.boardArea);
    drawReadout(context, playfield, now, {
      ...aztecReadout(view),
      valueColor: valueColorOf(view),
      isWaiting: view.phase === 'idle' || view.phase === 'bonus',
    });
  }

  public isAnimating(): boolean {
    const { phase } = this.model();
    return phase === 'idle' || phase === 'bonus';
  }

  private drawBonusFrame(context: CanvasRenderingContext2D, view: AztecViewModel, now: number): void {
    const area = this.boardArea;
    const pulse = view.phase === 'bonus' ? 0.6 + 0.4 * Math.sin(now / 320) : 0.6;
    context.globalAlpha = pulse;
    strokeRoundRect(context, area, this.bonusFrame, 2);
    context.globalAlpha = 1;
    const pillWidth = 168;
    const pill = { x: area.x + (area.width - pillWidth) / 2, y: area.y - PILL_HEIGHT / 2, width: pillWidth, height: PILL_HEIGHT };
    fillRoundRect(context, pill, PALETTE.dusk, PILL_HEIGHT / 2);
    fillRoundRect(context, pill, this.bonusPill, PILL_HEIGHT / 2);
    drawText(context, BONUS_PILL, pill.x + pillWidth / 2, pill.y + PILL_HEIGHT / 2 + 0.5, {
      size: 11, weight: 800, color: PALETTE.amber,
    });
  }
}

const valueColorOf = (view: AztecViewModel): string => {
  if (view.error !== null) return PALETTE.coral;
  return view.bonus !== null ? PALETTE.amber : PALETTE.ink;
};
