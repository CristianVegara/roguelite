/**
 * MobileChrome — fills the vertical dead-zone letterbox on narrow phones.
 *
 * CHANGES:
 *   - Enemy name truncation raised from 7 to 10 characters — boss names
 *     like "Bone Reaper" were cut to "Bone Re…" which is useless.
 *   - HP value format changed from "100/200" to "100 / 200" for readability.
 *   - Player HP format made consistent ("YOU" label stays, value spaced).
 *   - Mobile action buttons: BUILD/STATS track open state via .is-active,
 *     mirroring the desktop HudLeft.ts change.
 */

import { runState } from '../bridge/RunStateStore';
import { bus }      from '../bridge/GameEventBus';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';

// FIX: lowered from 40 to 20 — phones with 20–35 px of vertical letterbox
// were getting background bleed without any chrome UI to fill the gap.
const MIN_DEAD_ZONE = 20;

export class MobileChrome {
  private topBar:    HTMLElement;
  private bottomBar: HTMLElement;
  private hudRoot:   HTMLElement | null = null;

  private tbFloor!:         HTMLElement;
  private tbPlayerHpFill!:  HTMLElement;
  private tbPlayerHpValue!: HTMLElement;
  private tbEnemyLabel!:    HTMLElement;
  private tbEnemyHpFill!:   HTMLElement;
  private tbEnemyHpValue!:  HTMLElement;
  private tbModifier!:      HTMLElement;

  private bbGold!:     HTMLElement;
  private bbXpFill!:   HTMLElement;
  private bbLevel!:    HTMLElement;
  private bbSpeedBtns: HTMLElement[] = [];

  // FIX: track open state for BUILD/STATS active indicator
  private buildPanelOpen = false;
  private statsPanelOpen = false;
  private buildBtn!: HTMLElement;
  private statsBtn!: HTMLElement;

  private subs: Array<() => void> = [];
  private canvasObserver: ResizeObserver | null = null;
  private deadZone = 0;

  constructor() {
    this.topBar    = document.getElementById('mobile-top-bar')!;
    this.bottomBar = document.getElementById('mobile-bottom-bar')!;
    this.hudRoot   = document.getElementById('hud-root');
    this.buildTopBar();
    this.buildBottomBar();
    this.attachCanvasObserver();
    this.subscribe();
  }

  destroy(): void {
    this.subs.forEach(off => off());
    this.canvasObserver?.disconnect();
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  private buildTopBar(): void {
    const infoRow = el('div', 'mob-info-row');

    this.tbFloor = el('div', 'mob-floor');
    this.tbFloor.textContent = 'Floor 1';

    const playerWidget   = el('div', 'mob-hp-widget');
    const playerLabel    = el('div', 'mob-hp-label');
    playerLabel.textContent = 'YOU';
    playerLabel.style.color = '#4fc3f7';
    const playerTrack    = el('div', 'mob-hp-track');
    this.tbPlayerHpFill  = el('div', 'mob-hp-fill');
    this.tbPlayerHpFill.style.background = '#2ecc71';
    this.tbPlayerHpValue = el('div', 'mob-hp-value');
    playerTrack.appendChild(this.tbPlayerHpFill);
    playerWidget.append(playerLabel, playerTrack, this.tbPlayerHpValue);

    const enemyWidget   = el('div', 'mob-hp-widget');
    this.tbEnemyLabel   = el('div', 'mob-hp-label');
    this.tbEnemyLabel.textContent = 'ENEMY';
    this.tbEnemyLabel.style.color = '#ef5350';
    const enemyTrack    = el('div', 'mob-hp-track');
    this.tbEnemyHpFill  = el('div', 'mob-hp-fill');
    this.tbEnemyHpFill.style.background = '#e74c3c';
    this.tbEnemyHpValue = el('div', 'mob-hp-value');
    enemyTrack.appendChild(this.tbEnemyHpFill);
    enemyWidget.append(this.tbEnemyLabel, enemyTrack, this.tbEnemyHpValue);

    infoRow.append(this.tbFloor, playerWidget, enemyWidget);

    this.tbModifier = el('div', 'mob-modifier-pill');
    this.tbModifier.style.display = 'none';

    this.topBar.append(infoRow, this.tbModifier);
  }

  private buildBottomBar(): void {
    const metaRow   = el('div', 'mob-meta-row');
    this.bbGold     = el('div', 'mob-gold');
    this.bbGold.textContent = '★ 0';
    const xpTrack   = el('div', 'mob-xp-track');
    this.bbXpFill   = el('div', 'mob-xp-fill');
    this.bbXpFill.style.width = '0%';
    xpTrack.appendChild(this.bbXpFill);
    this.bbLevel    = el('div', 'mob-level');
    this.bbLevel.textContent = 'Lv 0';
    metaRow.append(this.bbGold, xpTrack, this.bbLevel);

    const actionRow = el('div', 'mob-action-row');

    const speeds: Array<1 | 1.5 | 2> = [1, 1.5, 2];
    speeds.forEach(speed => {
      const btn = el('div', 'mob-speed-btn');
      btn.textContent      = `${speed}×`;
      btn.dataset['speed'] = String(speed);
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', 'Set game speed to ' + speed + '×');
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        bus.emit({ type: 'speed:change', payload: { speed } });
      });
      this.bbSpeedBtns.push(btn);
      actionRow.appendChild(btn);
    });

    const pauseBtn = el('div', 'mob-icon-btn');
    pauseBtn.textContent = '⏸';
    pauseBtn.title = 'Pause';
    pauseBtn.setAttribute('role', 'button');
    pauseBtn.setAttribute('aria-label', 'Pause game');
    pauseBtn.addEventListener('click', () => {
      bus.emit({ type: 'pause:open', payload: {} });
    });

    // FIX: keep references for is-active toggling
    this.buildBtn = el('div', 'mob-icon-btn');
    this.buildBtn.textContent = 'BUILD';
    this.buildBtn.setAttribute('role', 'button');
    this.buildBtn.setAttribute('aria-label', 'Toggle build overview');
    this.buildBtn.setAttribute('aria-pressed', 'false');
    this.buildBtn.addEventListener('click', () => {
      bus.emit({ type: 'hud:toggle-build', payload: {} });
      this.buildPanelOpen = !this.buildPanelOpen;
      this.buildBtn.classList.toggle('is-active', this.buildPanelOpen);
      this.buildBtn.setAttribute('aria-pressed', String(this.buildPanelOpen));
    });

    this.statsBtn = el('div', 'mob-icon-btn');
    this.statsBtn.textContent = 'STATS';
    this.statsBtn.setAttribute('role', 'button');
    this.statsBtn.setAttribute('aria-label', 'Toggle stats panel');
    this.statsBtn.setAttribute('aria-pressed', 'false');
    this.statsBtn.addEventListener('click', () => {
      bus.emit({ type: 'hud:toggle-stats', payload: {} });
      this.statsPanelOpen = !this.statsPanelOpen;
      this.statsBtn.classList.toggle('is-active', this.statsPanelOpen);
      this.statsBtn.setAttribute('aria-pressed', String(this.statsPanelOpen));
    });

    actionRow.append(pauseBtn, this.buildBtn, this.statsBtn);
    this.bottomBar.append(metaRow, actionRow);
  }

  // ── Canvas observer ───────────────────────────────────────────────────────

  private attachCanvasObserver(): void {
    const attach = () => {
      const canvas = document.querySelector('#canvas-mount canvas') as HTMLElement | null;
      if (!canvas) { setTimeout(attach, 100); return; }
      this.canvasObserver = new ResizeObserver(() => this.updateLayout(canvas));
      this.canvasObserver.observe(canvas);
      this.updateLayout(canvas);
    };
    attach();
  }

  private updateLayout(canvas: HTMLElement): void {
    const rect    = canvas.getBoundingClientRect();
    const scale   = rect.width / GAME_WIDTH;
    const canvasH = GAME_HEIGHT * scale;
    this.deadZone = Math.max(0, Math.floor((window.innerHeight - canvasH) / 2));

    const active = this.deadZone >= MIN_DEAD_ZONE && runState.get().isRunActive;
    this.setActive(active);

    if (active) {
      this.topBar.style.height    = `${this.deadZone}px`;
      this.bottomBar.style.height = `${this.deadZone}px`;
    }
  }

  private setActive(active: boolean): void {
    this.topBar.classList.toggle('is-active',    active);
    this.bottomBar.classList.toggle('is-active', active);
    this.hudRoot?.classList.toggle('mobile-chrome-active', active);
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  private subscribe(): void {
    this.subs.push(
      bus.on('modal:open', () => {
        this.topBar.style.pointerEvents    = 'none';
        this.bottomBar.style.pointerEvents = 'none';
      }),
      bus.on('modal:close', () => {
        this.topBar.style.pointerEvents    = '';
        this.bottomBar.style.pointerEvents = '';
      }),
    );

    this.subs.push(
      runState.subscribe(s => s.isRunActive, () => {
        const canvas = document.querySelector('#canvas-mount canvas') as HTMLElement | null;
        if (canvas) this.updateLayout(canvas);
        // FIX: reset panel open states when run ends
        if (!runState.get().isRunActive) {
          this.buildPanelOpen = false;
          this.statsPanelOpen = false;
          this.buildBtn.classList.remove('is-active');
          this.statsBtn.classList.remove('is-active');
        }
      }),
    );

    this.subs.push(
      runState.subscribe(s => s.floor, floor => {
        this.tbFloor.textContent = `Floor ${floor}`;
      }),
    );

    this.subs.push(
      runState.subscribe(s => `${s.playerHp}|${s.playerMaxHp}`, () => {
        const { playerHp: hp, playerMaxHp: max } = runState.get();
        const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
        this.tbPlayerHpFill.style.width      = `${Math.floor(ratio * 100)}%`;
        this.tbPlayerHpFill.style.background =
          ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
        // FIX: spaced format "100 / 200" instead of "100/200"
        this.tbPlayerHpValue.textContent = `${hp} / ${max}`;
      }),
    );

    this.subs.push(
      runState.subscribe(
        s => `${s.enemyHp}|${s.enemyMaxHp}|${s.enemyName}|${s.isBoss}`,
        () => {
          const { enemyHp: hp, enemyMaxHp: max, enemyName, isBoss } = runState.get();
          const isSpecial = max >= 999999;
          const ratio = !isSpecial && max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;

          // FIX: truncation raised from 7 to 10 chars — boss names need room
          this.tbEnemyLabel.textContent = enemyName.length > 10
            ? enemyName.slice(0, 9) + '…' : enemyName || 'ENEMY';
          this.tbEnemyLabel.style.color       = isBoss ? '#ffd700' : '#ef5350';
          this.tbEnemyHpFill.style.width      = isSpecial ? '0%' : `${Math.floor(ratio * 100)}%`;
          this.tbEnemyHpFill.style.background =
            ratio > 0.5 ? '#e74c3c' : ratio > 0.25 ? '#e67e22' : '#ff6b6b';
          // FIX: spaced format "100 / 200" instead of "100/200"
          this.tbEnemyHpValue.textContent = isSpecial ? '' : `${hp} / ${max}`;
        },
      ),
    );

    this.subs.push(
      runState.subscribe(s => s.modifierName, name => {
        if (name) {
          this.tbModifier.textContent   = name;
          this.tbModifier.style.display = 'block';
        } else {
          this.tbModifier.style.display = 'none';
        }
      }),
    );

    this.subs.push(
      runState.subscribe(s => s.gold, gold => {
        this.bbGold.textContent = `★ ${gold}`;
      }),
    );

    this.subs.push(
      runState.subscribe(s => `${s.playerXp}|${s.playerLevel}`, () => {
        const { playerXp, playerLevel } = runState.get();
        this.bbXpFill.style.width  = `${Math.min(100, playerXp)}%`;
        this.bbLevel.textContent   = `Lv ${playerLevel}`;
      }),
    );

    this.subs.push(
      runState.subscribe(s => s.gameSpeed, speed => {
        this.bbSpeedBtns.forEach(btn => {
          const active = Number(btn.dataset['speed']) === speed;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-pressed', String(active));
        });
      }),
    );
  }
}

function el(tag: string, classes: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = classes;
  return e;
}