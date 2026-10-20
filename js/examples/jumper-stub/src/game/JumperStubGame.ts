/**
 * The stub jumper game: subscribes the stage to the bridge and answers the host the way the real
 * engine must — `SpinReady` after every jump, bonus events around the free games.
 */
import type { JumperBridge, RestartRequest } from '@omega/webbridge-js';
import type { JumperMovePayload, JumperRoundState, WebBootOptions, WebHostBridge } from '@omega/webbridge-protocol';
import { collisionStepOf, jumpWaypoints, START_STEP } from '../scene/routes';
import { playBonusSeries } from './playBonusSeries';
import { StubStage } from './StubStage';
import { FALL_MS, JUMP_MS } from './timings';

const IDLE_CAPTION = 'Tap to play';

export class JumperStubGame {
  private readonly stage: StubStage;
  private readonly unsubscribers: (() => void)[];
  private readonly readyFrameId: number;

  public constructor(
    private readonly bridge: JumperBridge,
    container: HTMLElement,
    options: WebBootOptions,
    host: WebHostBridge,
  ) {
    this.stage = new StubStage(container, options.devicePixelRatio);
    this.unsubscribers = this.subscribe();
    this.stage.canvas.addEventListener('pointerdown', this.onTap);
    bridge.setUiVisibility({
      hideDesktopBetBar: false,
      hideMobileBetBar: false,
      desktopBetBarInteractable: true,
      mobileBetBarInteractable: true,
    });
    bridge.start();
    // Ready once the first frame is up: by then a mock host has attached to the returned game.
    this.readyFrameId = requestAnimationFrame(() => host.ready());
  }

  public destroy(): void {
    cancelAnimationFrame(this.readyFrameId);
    this.stage.canvas.removeEventListener('pointerdown', this.onTap);
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.stage.destroy();
  }

  private subscribe(): (() => void)[] {
    const { bridge, stage } = this;
    return [
      bridge.gameConfigReceived.add((config) => {
        stage.scene.config = config;
        stage.redraw();
      }),
      bridge.difficultyChanged.add((difficulty) => {
        stage.scene.difficulty = difficulty;
        stage.redraw();
      }),
      bridge.gameStateReceived.add((state) => this.restore(state)),
      bridge.moveReceived.add((move) => void this.applyMove(move)),
      bridge.restartRequested.add((request) => this.restart(request)),
      bridge.bonusStartRequested.add((bonus) => void playBonusSeries(bridge, stage, bonus)),
      bridge.disabledPlayPressed.add(() => stage.shake()),
    ];
  }

  private readonly onTap = (): void => {
    this.bridge.requestPlay();
  };

  private restore(state: JumperRoundState): void {
    if (state.status === 'none') {
      this.stage.scene.difficulty = state.difficulty;
      this.stage.scene.reset(IDLE_CAPTION);
    } else {
      this.stage.scene.showRound(state, 'Restored round');
    }
    this.stage.place(state.landingStep);
  }

  private async applyMove(move: JumperMovePayload): Promise<void> {
    switch (move.move) {
      case 'play':
        this.stage.scene.showRound(move, 'Round open — jumping');
        this.stage.place(START_STEP);
        return;
      case 'step':
        await this.playJump(move);
        return;
      case 'payout':
        this.stage.scene.showRound(move, `Cashed out ${move.winAmount} — waiting for RestartRound`);
        this.stage.redraw();
        return;
    }
  }

  /** The jump with its accelerator chain, the fall on a loss, then `SpinReady`. */
  private async playJump(move: JumperMovePayload): Promise<void> {
    const { scene } = this.stage;
    scene.slots = move.slots;
    if (!(await this.stage.jump(jumpWaypoints(move), JUMP_MS))) return;
    if (move.status === 'lose' && !(await this.stage.fallDown(FALL_MS))) return;

    scene.showRound(move, this.captionAfterJump(move));
    this.stage.redraw();
    this.bridge.notifySpinReady();
  }

  private captionAfterJump(move: JumperMovePayload): string {
    if (move.status === 'lose') return `Fell at step ${collisionStepOf(move)}`;
    if (move.status === 'win') return `Top reached: ${move.winAmount}`;

    const chain = move.visitedSteps.map((visited) => visited.accelerator).join(' → ');
    return chain === '' ? `Landed on ${move.landingStep}` : `${chain} → ${move.landingStep}`;
  }

  private restart(request: RestartRequest): void {
    const result = [request.reason, request.amount].filter((part) => part !== '').join(' ');
    this.stage.scene.reset(result === '' ? IDLE_CAPTION : `${IDLE_CAPTION} · last: ${result}`);
    this.stage.place(START_STEP);
  }
}
