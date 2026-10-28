/**
 * Plinko drawn: the readout on top, the peg board of the current risk line under it. The drop is a motion
 * the controller awaits before it tells the host the ball has landed.
 */
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import { drawReadout, readoutBottomOf } from './drawReadout';
import { PegBoard } from './PegBoard';
import type { PlinkoMotions } from './PlinkoController';
import { plinkoReadout, type PlinkoViewModel } from './plinkoReadout';
import type { PlinkoOutcome, PlinkoRound } from './plinkoRound';

export interface PlinkoSceneModel extends PlinkoViewModel {
  readonly round: PlinkoRound;
}

const CONFETTI = [PALETTE.sky, PALETTE.amber, PALETTE.mint, PALETTE.violet];
const SPARKS = [PALETTE.coral, PALETTE.amber];
const BOARD_GAP = 10;

export class PlinkoView implements SceneRenderer, PlinkoMotions {
  private readonly board: PegBoard;

  public constructor(
    private readonly stage: Stage,
    accent: string,
    private readonly model: () => PlinkoSceneModel,
  ) {
    this.board = new PegBoard(stage, accent, () => this.model().round.slots);
  }

  public drop(slots: readonly number[]): Promise<boolean> {
    return this.board.drop(slots);
  }

  public land(slot: number, outcome: PlinkoOutcome): void {
    const { x, y } = this.board.slotPoint(slot);
    if (outcome === 'win') this.stage.celebrate(x, y, CONFETTI);
    if (outcome === 'loss') this.stage.particles.burst({ x, y, colors: SPARKS, count: 14, speed: 260 }, performance.now());
    this.stage.redraw();
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    const view = this.model();
    const { playfield, now } = frame;
    const top = readoutBottomOf(playfield) + BOARD_GAP;
    const area = { x: playfield.x, y: top, width: playfield.width, height: playfield.y + playfield.height - top };
    this.board.draw(context, area, now);
    drawReadout(context, playfield, now, {
      ...plinkoReadout(view),
      valueColor: view.error === null ? PALETTE.ink : PALETTE.coral,
      isWaiting: view.phase === 'idle',
    });
  }

  public isAnimating(): boolean {
    return this.model().phase === 'idle';
  }
}
