/**
 * PauseModal.ts — In-run pause overlay triggered by the M key.
 *
 * Mobile fix: emits modal:open / modal:close so CombatHUD and
 * MobileChrome suppress their pointer-events while the overlay is up.
 */

import { bus } from '../bridge/GameEventBus';

export class PauseModal {
  private root:   HTMLElement;
  private active = false;

  constructor() {
    this.root = document.getElementById('modal-root')!;

    bus.on('pause:open', () => {
      if (this.active) return;
      this.open();
    });
  }

  // ── Open / close ────────────────────────────────────────────────────────────

  private open(): void {
    this.active = true;
    bus.emit({ type: 'modal:open', payload: {} });

    const dim = document.createElement('div');
    dim.className = 'modal-dim';

    const panel = document.createElement('div');
    panel.className = 'pause-panel';

    panel.append(
      this.buildTitle(),
      this.buildButtons(),
    );

    dim.appendChild(panel);
    this.root.appendChild(dim);
    requestAnimationFrame(() => dim.classList.add('is-visible'));

    // M or Escape also closes (resume)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M' || e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        this.close();
        bus.emit({ type: 'pause:resume', payload: {} });
      }
    };
    document.addEventListener('keydown', onKey);

    (dim as HTMLElement & { _onKey?: (e: KeyboardEvent) => void })._onKey = onKey;
  }

  private close(): void {
    this.active = false;
    bus.emit({ type: 'modal:close', payload: {} });

    const dim = this.root.querySelector('.pause-panel')?.closest('.modal-dim') as
      (HTMLElement & { _onKey?: (e: KeyboardEvent) => void }) | null;
    if (dim) {
      if (dim._onKey) document.removeEventListener('keydown', dim._onKey);
      dim.classList.remove('is-visible');
      dim.addEventListener('transitionend', () => dim.remove(), { once: true });
    }
  }

  // ── Sections ────────────────────────────────────────────────────────────────

  private buildTitle(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'pause-title-wrap';

    const title = document.createElement('div');
    title.className   = 'pause-title';
    title.textContent = 'PAUSED';

    const hint = document.createElement('div');
    hint.className   = 'pause-hint';
    hint.textContent = 'Press M or Esc to resume';

    wrap.append(title, hint);
    return wrap;
  }

  private buildButtons(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'pause-buttons';

    const resume = document.createElement('button');
    resume.className   = 'pause-btn pause-btn--resume';
    resume.textContent = 'RESUME';
    resume.addEventListener('click', () => {
      this.close();
      bus.emit({ type: 'pause:resume', payload: {} });
    });

    const restart = document.createElement('button');
    restart.className   = 'pause-btn pause-btn--restart';
    restart.textContent = 'RESTART RUN';
    restart.addEventListener('click', () => {
      this.close();
      bus.emit({ type: 'pause:restart', payload: {} });
    });

    const quit = document.createElement('button');
    quit.className   = 'pause-btn pause-btn--quit';
    quit.textContent = 'QUIT TO MENU';
    quit.addEventListener('click', () => {
      this.close();
      bus.emit({ type: 'pause:quit', payload: {} });
    });

    const abandon = document.createElement('button');
    abandon.className   = 'pause-btn pause-btn--abandon';
    abandon.textContent = 'ABANDON RUN';
    abandon.addEventListener('click', () => {
      this.close();
      bus.emit({ type: 'pause:quit', payload: {} });
    });

    wrap.append(resume, restart, quit, abandon);
    return wrap;
  }
}