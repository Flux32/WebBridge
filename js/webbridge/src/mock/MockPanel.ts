/**
 * Отладочная панель мока — веб-аналог MockDebugIMGUI из C#-пакета: круглая
 * перетаскиваемая кнопка, а под ней строки-степперы «< значение >».
 *
 * Состав повторяет редакторную панель, кроме шанса бонуса. Бонус в Crush есть
 * и C#-мост его обслуживает целиком, но JS-мост пока не умеет покупку и
 * триггер (см. CrushBridge), поэтому контрол некуда было бы вести. Строку
 * добавить сюда, когда бонус доедет.
 *
 * Панель ничего не знает про игру — она двигает только MockHost, поэтому
 * достаётся любой игре на Phaser вместе с моком.
 */
import type { MockHost } from './MockHost';

/**
 * Произвольное действие в панели. Нужно для того, что панель сделать не может,
 * — например собрать билд: страница не запускает сборку сама, за неё это делает
 * эндпоинт dev-сервера, а игра приносит сюда вызов.
 */
export interface MockPanelAction {
  label: string;
  run(): void | Promise<void>;
}

const LOSE_CHANCE_STEP = 0.05;
const BUTTON_SIZE = 44;

export class MockPanel {
  private readonly root: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly rows = new Map<string, HTMLSpanElement>();

  private isOpen = false;
  private dragOffset: { x: number; y: number } | null = null;
  private wasDragged = false;

  public constructor(
    private readonly host: MockHost,
    private readonly actions: MockPanelAction[] = [],
  ) {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed', 'left:12px', 'top:12px', 'z-index:2147483647',
      'font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace', 'color:#e8e8e8',
      'user-select:none', '-webkit-user-select:none', 'touch-action:none',
    ].join(';');

    this.root.appendChild(this.createLauncher());
    this.panel = this.createPanel();
    this.root.appendChild(this.panel);
  }

  public mount(target: HTMLElement = document.body): () => void {
    target.appendChild(this.root);
    this.refresh();
    return () => this.root.remove();
  }

  // Кнопка и открывает панель, и таскает её: перетаскивание отменяет клик,
  // иначе панель дёргалась бы открытием на каждом перетаскивании.
  private createLauncher(): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = 'M';
    button.title = 'Mock debug';
    button.style.cssText = [
      `width:${BUTTON_SIZE}px`, `height:${BUTTON_SIZE}px`, 'border-radius:50%',
      'border:1px solid #4a4a4a', 'background:#1c1c1caa', 'color:#e8e8e8',
      'font:600 16px/1 ui-monospace,monospace', 'cursor:grab', 'backdrop-filter:blur(4px)',
    ].join(';');

    button.addEventListener('pointerdown', (event) => {
      this.wasDragged = false;
      this.dragOffset = {
        x: event.clientX - this.root.offsetLeft,
        y: event.clientY - this.root.offsetTop,
      };
      button.setPointerCapture(event.pointerId);
    });

    button.addEventListener('pointermove', (event) => {
      if (!this.dragOffset) return;

      this.wasDragged = true;
      const x = Math.max(0, Math.min(window.innerWidth - BUTTON_SIZE, event.clientX - this.dragOffset.x));
      const y = Math.max(0, Math.min(window.innerHeight - BUTTON_SIZE, event.clientY - this.dragOffset.y));
      this.root.style.left = `${x}px`;
      this.root.style.top = `${y}px`;
    });

    button.addEventListener('pointerup', () => {
      this.dragOffset = null;
      if (this.wasDragged) return;

      this.isOpen = !this.isOpen;
      this.panel.style.display = this.isOpen ? 'block' : 'none';
      this.refresh();
    });

    return button;
  }

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'display:none', 'margin-top:8px', 'padding:10px', 'min-width:210px',
      'border:1px solid #4a4a4a', 'border-radius:8px', 'background:#141414ee',
      'backdrop-filter:blur(4px)',
    ].join(';');

    panel.appendChild(this.createStepper('Difficulty', () => this.cycleDifficulty(-1), () => this.cycleDifficulty(1)));
    panel.appendChild(this.createStepper(
      'Lose %',
      () => { this.host.loseChance -= LOSE_CHANCE_STEP; this.refresh(); },
      () => { this.host.loseChance += LOSE_CHANCE_STEP; this.refresh(); },
    ));

    panel.appendChild(this.createActions());
    if (this.actions.length > 0) panel.appendChild(this.createCustomActions());
    return panel;
  }

  private createStepper(label: string, onPrev: () => void, onNext: () => void): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';

    const caption = document.createElement('span');
    caption.textContent = label;
    caption.style.cssText = 'flex:1;opacity:.7';

    const value = document.createElement('span');
    value.style.cssText = 'min-width:64px;text-align:center;font-weight:600';
    this.rows.set(label, value);

    row.append(caption, this.createButton('<', onPrev), value, this.createButton('>', onNext));
    return row;
  }

  private createActions(): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-top:8px';

    const step = this.createButton('Step', () => this.host.step());
    const cashout = this.createButton('Cashout', () => this.host.cashout());
    const restart = this.createButton('Restart', () => this.host.restart());
    [step, cashout, restart].forEach((button) => { button.style.flex = '1'; });

    row.append(step, cashout, restart);
    return row;
  }

  // Действия игры: пока идёт долгая работа, кнопка блокируется и показывает
  // многоточие — иначе непонятно, началось ли что-нибудь.
  private createCustomActions(): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-top:6px';

    this.actions.forEach((action) => {
      const button = this.createButton(action.label, async () => {
        button.disabled = true;
        button.textContent = `${action.label} …`;
        try {
          await action.run();
          button.textContent = `${action.label} ✓`;
        } catch {
          button.textContent = `${action.label} ✗`;
        }
        setTimeout(() => {
          button.disabled = false;
          button.textContent = action.label;
        }, 1500);
      });
      button.style.flex = '1';
      row.appendChild(button);
    });

    return row;
  }

  private createButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = [
      'padding:3px 8px', 'border:1px solid #4a4a4a', 'border-radius:5px',
      'background:#2a2a2a', 'color:#e8e8e8', 'cursor:pointer', 'font:inherit',
    ].join(';');
    button.addEventListener('click', onClick);
    return button;
  }

  private cycleDifficulty(direction: number): void {
    const names = this.host.difficultyNames;
    const next = (names.indexOf(this.host.difficulty) + direction + names.length) % names.length;
    this.host.setDifficulty(names[next]!);
    this.refresh();
  }

  private refresh(): void {
    this.rows.get('Difficulty')!.textContent = this.host.difficulty;
    this.rows.get('Lose %')!.textContent = `${Math.round(this.host.loseChance * 100)}%`;
  }
}
