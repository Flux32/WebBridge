/**
 * The dev page's twist host — the bridge package has no mock host for twist. It answers like the shell:
 * `ApplySpinResult` with the raw play reply, a part cash out as a bare `ApplyGameState`, a full cash out
 * and the end of a bought series as `RestartRound`. A move is busy until the game reports `SpinReady`
 * (or `BonusEnded` for a series), the way the shell's bet bar stays locked: a silent game sticks here.
 */
import type { EngineCommand, EngineEvent, WebGameBridge, WebHostBridge } from '@omega/webbridge-protocol';
import { TwistMockSession } from './twistMockSession';

/** The shell's transition screen and the free-spins icon intro, before it lets the series spin. */
const INTRO_MS = 1200;
/** The win window between the end of a series and the restart. */
const SERIES_WIN_MS = 900;
const SERIES_LENGTH = 6;

export class TwistMockHost implements WebHostBridge {
  private game: WebGameBridge | null = null;
  private readonly session = new TwistMockSession();
  private isBusy = false;
  private seriesWin = '';

  public attach(game: WebGameBridge): void {
    this.game = game;
  }

  public ready(): void {}

  public setProgress(): void {}

  public emit(event: EngineEvent): void {
    switch (event.type) {
      case 'RequestGameConfig':
        return this.send({ type: 'ApplyGameConfig', payload: '{}' });
      case 'RequestGameState':
        return this.send({ type: 'ApplyGameState', payload: JSON.stringify(this.session.state()) });
      case 'RequestWhiteLabel':
        return this.send({ type: 'ApplyWhiteLabel', payload: false });
      case 'RequestFastGame':
        return this.send({ type: 'SetFastGame', payload: false });
      case 'RequestPlay':
        return this.isBusy ? this.send({ type: 'DisabledPlayPressed' }) : this.spin();
      case 'SpinReady':
        return this.onSpinReady();
      case 'BonusEnded':
        return void window.setTimeout(() => this.send({ type: 'RestartRound', payload: `bonus|$${this.seriesWin}` }), SERIES_WIN_MS);
      default:
        return;
    }
  }

  public spin(): void {
    if (this.isBusy) return;
    this.isBusy = true;
    this.send({ type: 'ApplySpinResult', payload: JSON.stringify(this.session.spin()) });
  }

  public cashOut(): void {
    if (this.isBusy || !this.session.isLive) return;
    this.isBusy = true;
    const amount = this.session.cashoutAmount;
    this.session.close();
    this.send({ type: 'RestartRound', payload: `cashout|$${amount}` });
  }

  public partCashOut(): void {
    if (this.isBusy || !this.session.isLive) return;
    const state = this.session.partCashout();
    if (state !== null) this.send({ type: 'ApplyGameState', payload: JSON.stringify(state) });
  }

  public buyBonus(): void {
    if (this.isBusy || this.session.isLive) return;
    this.isBusy = true;
    const { totalRounds, spins, winAmount } = this.session.bonusSeries(SERIES_LENGTH);
    this.seriesWin = winAmount;
    this.send({ type: 'StartBonus', payload: { totalRounds, spins } });
    window.setTimeout(() => this.send({ type: 'FreeGamesIntroFinished' }), INTRO_MS);
  }

  /** Space — spin, C — cash out, P — part cash out, B — buy a series. */
  public bindKeys(target: EventTarget = window): () => void {
    const actions: Readonly<Record<string, () => void>> = {
      Space: () => this.spin(),
      KeyC: () => this.cashOut(),
      KeyP: () => this.partCashOut(),
      KeyB: () => this.buyBonus(),
    };
    const onKeyDown = (event: Event): void => {
      const action = actions[(event as KeyboardEvent).code];
      if (action === undefined) return;
      event.preventDefault();
      action();
    };
    target.addEventListener('keydown', onKeyDown);
    return () => target.removeEventListener('keydown', onKeyDown);
  }

  /** The bar unlocks; a sector filled to its bonus cell is paid by the host right after, as the shell does. */
  private onSpinReady(): void {
    this.isBusy = false;
    const sector = this.session.fullSector;
    if (sector !== null) this.send({ type: 'ApplyGameState', payload: JSON.stringify(this.session.collectBonus(sector)) });
  }

  private send(command: EngineCommand): void {
    this.game?.receive(command);
  }
}
