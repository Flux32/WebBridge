/**
 * Twist drawn: three totem columns over the sector panel, under the board's multiplier. A triple lights
 * its sector's cells; death breaks every cell off with a shake.
 */
import { drawGlow, fillRoundRect, strokeRoundRect, withAlpha, type Rect } from '../../kit/paint';
import { PALETTE } from '../../kit/palette';
import type { Frame, SceneRenderer, Stage } from '../../kit/Stage';
import type { TwistMotions } from './TwistController';
import { drawTotem, TOTEM_COLORS } from './twistGlyphs';
import { PANEL_HEIGHT, TwistPanel } from './twistPanel';
import { drawTwistReadout, type TwistViewModel } from './twistReadout';
import type { Totem, TotemTriple } from './twistSpin';
import type { TwistProgress } from './twistTable';
import { TOTEM_SPIN_MS, TwistTotems } from './twistTotems';

const FILL_MS = 420;
const WIPE_MS = 560;
const PAUSE_MS = 650;
const READOUT_HEIGHT = 124;
const COLUMN_GAP = 12;

interface Layout {
  readonly windows: readonly Rect[];
  readonly head: number;
  readonly panel: Rect;
}

const layoutOf = (playfield: Rect): Layout => {
  const panel = { x: playfield.x, y: playfield.y + playfield.height - PANEL_HEIGHT, width: playfield.width, height: PANEL_HEIGHT };
  const top = playfield.y + READOUT_HEIGHT;
  const room = panel.y - 20 - top;
  const width = Math.min((playfield.width - COLUMN_GAP * 2) / 3, 110);
  const height = Math.max(60, Math.min(room, width * 1.5));
  const y = top + (room - height) / 2;
  const left = playfield.x + (playfield.width - width * 3 - COLUMN_GAP * 2) / 2;
  const windows = [0, 1, 2].map((column) => ({ x: left + column * (width + COLUMN_GAP), y, width, height }));
  return { windows, head: Math.min(width * 0.78, height * 0.62), panel };
};

export class TwistView implements SceneRenderer, TwistMotions {
  private readonly totems = new TwistTotems();
  private readonly panel = new TwistPanel();
  private layout: Layout = layoutOf({ x: 0, y: 0, width: 0, height: 0 });

  public constructor(
    private readonly stage: Stage,
    private readonly model: () => TwistViewModel,
  ) {}

  public async spin(totems: TotemTriple): Promise<boolean> {
    this.totems.prepare(totems, this.model().series === null ? 'round' : 'series');
    const isPlayed = await this.stage.animator.play(TOTEM_SPIN_MS, (p) => this.totems.advance(p * TOTEM_SPIN_MS));
    if (isPlayed) this.totems.settle(totems);
    return isPlayed;
  }

  public fill(progress: TwistProgress): Promise<boolean> {
    this.panel.aim(progress);
    return this.stage.animator.play(FILL_MS, (p) => this.panel.advance(p));
  }

  public async wipe(): Promise<boolean> {
    this.stage.shake();
    const { panel } = this.layout;
    this.stage.particles.burst(
      { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2, colors: [PALETTE.coral, PALETTE.violet], count: 32, speed: 440 },
      performance.now(),
    );
    const isPlayed = await this.stage.animator.play(WIPE_MS, (p) => (this.panel.drop = p));
    this.panel.clear();
    return isPlayed;
  }

  public pause(): Promise<boolean> {
    return this.stage.animator.wait(PAUSE_MS);
  }

  public celebrate(): void {
    const middle = this.layout.windows[1];
    if (middle === undefined) return;
    this.stage.celebrate(middle.x + middle.width / 2, middle.y + middle.height / 2, [PALETTE.mint, PALETTE.amber, PALETTE.sky]);
  }

  public isAnimating(): boolean {
    const { phase } = this.model();
    return phase === 'idle' || phase === 'playing';
  }

  public draw(context: CanvasRenderingContext2D, frame: Frame): void {
    this.layout = layoutOf(frame.playfield);
    this.drawColumns(context);
    this.panel.draw(context, this.layout.panel);
    drawTwistReadout(context, frame, this.model());
  }

  private drawColumns(context: CanvasRenderingContext2D): void {
    const { windows, head } = this.layout;
    const tripleColor = tripleColorOf(this.totems.landed);
    for (const window of windows) {
      if (tripleColor !== null) drawGlow(context, window.x + window.width / 2, window.y + window.height / 2, window.width, withAlpha(tripleColor, 0.3));
      fillRoundRect(context, window, PALETTE.dusk, 18);
      strokeRoundRect(context, window, withAlpha(tripleColor ?? PALETTE.mint, tripleColor === null ? 0.25 : 0.8), 1.5, 18);
    }
    this.totems.draw(context, windows, head * 1.12, (totem, x, y, distance) => {
      context.globalAlpha = Math.max(0.12, 1 - distance * 0.75);
      drawTotem(context, totem, x, y, head);
      context.globalAlpha = 1;
    });
  }
}

const tripleColorOf = (landed: TotemTriple | null): string | null => {
  if (landed === null) return null;
  const [first, second, third]: readonly Totem[] = landed;
  if (first === undefined || first !== second || second !== third) return null;
  return TOTEM_COLORS[first];
};
