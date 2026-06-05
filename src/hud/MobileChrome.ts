/**
 * MobileChrome — fills the vertical dead-zone letterbox that appears on
 * narrow phones because the 480×640 canvas is width-constrained.
 *
 * Architecture:
 * - Two fixed-position panels: #mobile-top-bar and #mobile-bottom-bar.
 * - A ResizeObserver on the Phaser canvas drives the dead-zone calculation.
 *   When (viewport_height − canvas_CSS_height) / 2 >= MIN_DEAD_ZONE the
 *   panels become visible and their heights are set to fill the gap exactly.
 * - Panels are only shown during an active run (runState.isRunActive).
 * - All button clicks emit to GameEventBus — the same events that the
 *   keyboard shortcuts and scaled HUD buttons fire, so GameScene is unaware
 *   of where the trigger came from.
 * - Panels are in real screen pixels, so touch targets are always 36–44 px
 *   regardless of canvas scale.
 */

import { runState } from '../bridge/RunStateStore';
import { bus }      from '../bridge/GameEventBus';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';

/** Minimum dead-zone height (px) before panels appear. */
const MIN_DEAD_ZONE = 40;

export class MobileChrome {
  private topBar:    HTMLElement;
  private bottomBar: HTMLElement;
  private hudRoot:    HTMLElement | null = null;

  // ── Top bar elements ──────────────────────────────────────────────────────
  private tbFloor!:          HTMLElement;
  private tbPlayerHpFill!:   HTMLElement;
  private tbPlayerHpValue!:  HTMLElement;
  private tbEnemyLabel!:     HTMLElement;
  private tbEnemyHpFill!:    HTMLElement;
  private tbEnemyHpValue!:   HTMLElement;
  private tbModifier!:       HTMLElement;

  // ── Bottom bar elements ───────────────────────────────────────────────────
  private bbGold!:       HTMLElement;
  private bbXpFill!:     HTMLElement;
  private bbLevel!:      HTMLElement;
  private bbSpeedBtns:   HTMLElement[] = [];

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
    // Row 1 — floor + player HP + enemy HP
    const infoRow = el('div', 'mob-info-row');

    this.tbFloor = el('div', 'mob-floor');
    this.tbFloor.textContent = 'Floor 1';

    // Player HP widget
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

    // Enemy HP widget
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

    // Row 2 — modifier pill (hidden when no modifier)
    this.tbModifier = el('div', 'mob-modifier-pill');
    this.tbModifier.style.display = 'none';

    this.topBar.append(infoRow, this.tbModifier);
  }

  private buildBottomBar(): void {
    // Row 1 — gold + XP bar + level
    const metaRow     = el('div', 'mob-meta-row');
    this.bbGold       = el('div', 'mob-gold');
    this.bbGold.textContent = '★ 0';
    const xpTrack     = el('div', 'mob-xp-track');
    this.bbXpFill     = el('div', 'mob-xp-fill');
    this.bbXpFill.style.width = '0%';
    xpTrack.appendChild(this.bbXpFill);
    this.bbLevel      = el('div', 'mob-level');
    this.bbLevel.textContent = 'Lv 0';
    metaRow.append(this.bbGold, xpTrack, this.bbLevel);

    // Row 2 — speed buttons + pause + build + stats
    const actionRow = el('div', 'mob-action-row');

    const speeds: Array<1 | 1.5 | 2> = [1, 1.5, 2];
    speeds.forEach(speed => {
      const btn = el('div', 'mob-speed-btn');
      btn.textContent  = `${speed}×`;
      btn.dataset['speed'] = String(speed);
      btn.addEventListener('click', () => {
        bus.emit({ type: 'speed:change', payload: { speed } });
      });
      this.bbSpeedBtns.push(btn);
      actionRow.appendChild(btn);
    });

    const pauseBtn = el('div', 'mob-icon-btn');
    pauseBtn.textContent = '⏸';
    pauseBtn.title = 'Pause';
    pauseBtn.addEventListener('click', () => {
      bus.emit({ type: 'pause:open', payload: {} });
    });

    const buildBtn = el('div', 'mob-icon-btn');
    buildBtn.textContent = 'BUILD';
    buildBtn.addEventListener('click', () => {
      bus.emit({ type: 'hud:toggle-build', payload: {} });
    });

    const statsBtn = el('div', 'mob-icon-btn');
    statsBtn.textContent = 'STATS';
    statsBtn.addEventListener('click', () => {
      bus.emit({ type: 'hud:toggle-stats', payload: {} });
    });

    actionRow.append(pauseBtn, buildBtn, statsBtn);
    this.bottomBar.append(metaRow, actionRow);
  }

  // ── Canvas observer ───────────────────────────────────────────────────────

  /**
   * Watches the Phaser canvas for size changes (same pattern as CombatHUD).
   * Calculates the dead-zone height and updates both panels accordingly.
   */
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
    // Scale the canvas uses (FIT mode — width-constrained on phones)
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

  // ── RunStateStore subscriptions ───────────────────────────────────────────

  private subscribe(): void {
    // Show / hide based on run activity (also re-evaluate dead zone)
    this.subs.push(
      runState.subscribe(s => s.isRunActive, () => {
        const canvas = document.querySelector('#canvas-mount canvas') as HTMLElement | null;
        if (canvas) this.updateLayout(canvas);
      }),
    );

    // Floor
    this.subs.push(
      runState.subscribe(s => s.floor, floor => {
        this.tbFloor.textContent = `Floor ${floor}`;
      }),
    );

    // Player HP
    this.subs.push(
      runState.subscribe(s => `${s.playerHp}|${s.playerMaxHp}`, () => {
        const { playerHp: hp, playerMaxHp: max } = runState.get();
        const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
        this.tbPlayerHpFill.style.width      = `${Math.floor(ratio * 100)}%`;
        this.tbPlayerHpFill.style.background =
          ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
        this.tbPlayerHpValue.textContent = `${hp}/${max}`;
      }),
    );

    // Enemy HP + name
    this.subs.push(
      runState.subscribe(
        s => `${s.enemyHp}|${s.enemyMaxHp}|${s.enemyName}|${s.isBoss}`,
        () => {
          const { enemyHp: hp, enemyMaxHp: max, enemyName, isBoss } = runState.get();
          const isSpecial = max >= 999999;
          const ratio = !isSpecial && max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
          this.tbEnemyLabel.textContent = enemyName.length > 8
            ? enemyName.slice(0, 7) + '…' : enemyName || 'ENEMY';
          this.tbEnemyLabel.style.color = isBoss ? '#ffd700' : '#ef5350';
          this.tbEnemyHpFill.style.width      = isSpecial ? '0%' : `${Math.floor(ratio * 100)}%`;
          this.tbEnemyHpFill.style.background =
            ratio > 0.5 ? '#e74c3c' : ratio > 0.25 ? '#e67e22' : '#ff6b6b';
          this.tbEnemyHpValue.textContent = isSpecial ? '' : `${hp}/${max}`;
        },
      ),
    );

    // Modifier pill
    this.subs.push(
      runState.subscribe(s => s.modifierName, name => {
        if (name) {
          this.tbModifier.textContent  = name;
          this.tbModifier.style.display = 'block';
        } else {
          this.tbModifier.style.display = 'none';
        }
      }),
    );

    // Gold
    this.subs.push(
      runState.subscribe(s => s.gold, gold => {
        this.bbGold.textContent = `★ ${gold}`;
      }),
    );

    // XP + level
    this.subs.push(
      runState.subscribe(s => `${s.playerXp}|${s.playerLevel}`, () => {
        const { playerXp, playerLevel } = runState.get();
        this.bbXpFill.style.width    = `${Math.min(100, playerXp)}%`;
        this.bbLevel.textContent     = `Lv ${playerLevel}`;
      }),
    );

    // Speed buttons active state
    this.subs.push(
      runState.subscribe(s => s.gameSpeed, speed => {
        this.bbSpeedBtns.forEach(btn => {
          btn.classList.toggle('is-active', Number(btn.dataset['speed']) === speed);
        });
      }),
    );
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function el(tag: string, classes: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = classes;
  return e;
}
