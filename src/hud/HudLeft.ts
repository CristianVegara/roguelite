/**
 * HudLeft — top bar (floor, class badge, speed buttons) + player HP panel + bottom bar.
 *
 * Subscribes to:
 *   floor, playerHp, playerMaxHp, playerLevel, playerXp,
 *   gold, gameSpeed, className, classId
 */

import { runState } from '../bridge/RunStateStore';
import { bus }      from '../bridge/GameEventBus';


export class HudLeft {
  private floorLabel!: HTMLElement;
  private classBadge!: HTMLElement;
  private speedBtns:   HTMLElement[] = [];

  private hpFill!:  HTMLElement;
  private hpValue!: HTMLElement;

  private goldText!:  HTMLElement;
  private relicText!: HTMLElement;
  private xpFill!:    HTMLElement;
  private xpLevel!:   HTMLElement;

  private subs: Array<() => void> = [];

  constructor(frame: HTMLElement) {
    // Top bar
    const topbar = this.buildTopBar();
    frame.appendChild(topbar);

    // Player HP panel (left)
    const hpPanel = this.buildPlayerHpPanel();
    frame.appendChild(hpPanel);

    // Bottom bar
    const botbar = this.buildBottomBar();
    frame.appendChild(botbar);

    this.subscribe();
  }

  destroy(): void {
    this.subs.forEach(off => off());
  }

  // ── DOM builders ────────────────────────────────────────────────────────

  private buildTopBar(): HTMLElement {
    const bar = el('div', 'hud-topbar');

    // Floor label
    this.floorLabel = el('div', 'hud-floor-label');
    this.floorLabel.textContent = 'Floor 1';
    bar.appendChild(this.floorLabel);

    // Class badge
    this.classBadge = el('div', 'hud-class-badge');
    bar.appendChild(this.classBadge);

    // Speed buttons
    const speedWrap = el('div', 'hud-speed-btns');
    const speeds: Array<1 | 1.5 | 2> = [1, 1.5, 2];
    const labels = ['1×', '1.5×', '2×'];
    speeds.forEach((speed, i) => {
      const btn = el('div', 'hud-speed-btn');
      btn.textContent = labels[i];
      btn.dataset['speed'] = String(speed);
      btn.addEventListener('click', () => {
        bus.emit({ type: 'speed:change', payload: { speed } });
      });
      this.speedBtns.push(btn);
      speedWrap.appendChild(btn);
    });
    bar.appendChild(speedWrap);

    return bar;
  }

  private buildPlayerHpPanel(): HTMLElement {
    const panel = el('div', 'hud-hp-panel hud-hp-panel--player');

    // Accent bar (player blue)
    const accent = el('div', 'hud-hp-accent');
    accent.style.background = '#4fc3f7';

    // Name label
    const name = el('div', 'hud-hp-name');
    name.textContent = 'PLAYER';
    name.style.color = '#4fc3f7';

    // Value
    this.hpValue = el('div', 'hud-hp-value');

    // Bar track + fill
    const track = el('div', 'hud-hp-track');
    this.hpFill  = el('div', 'hud-hp-fill');
    this.hpFill.style.background = '#2ecc71';
    track.appendChild(this.hpFill);

    panel.append(accent, name, this.hpValue, track);
    return panel;
  }

  private buildBottomBar(): HTMLElement {
    const bar = el('div', 'hud-botbar');

    this.goldText = el('div', 'hud-gold');
    this.goldText.textContent = '★ 0';

    const goldLabel = el('div', 'hud-gold-label');
    goldLabel.textContent = 'GOLD';

    const kbHints = el('div', 'hud-kb-hints');

    const buildBtn = el('button', 'hud-action-btn');
    buildBtn.textContent = 'BUILD';
    buildBtn.title = 'Toggle build overview (B)';
    buildBtn.addEventListener('click', () => bus.emit({ type: 'hud:toggle-build', payload: {} }));

    const statsBtn = el('button', 'hud-action-btn');
    statsBtn.textContent = 'STATS';
    statsBtn.title = 'Toggle stats panel (Tab)';
    statsBtn.addEventListener('click', () => bus.emit({ type: 'hud:toggle-stats', payload: {} }));

    kbHints.append(buildBtn, statsBtn);

    this.relicText = el('div', 'hud-relic-text');
    this.relicText.textContent = 'RELICS: none';

    const xpTrack = el('div', 'hud-xp-track');
    this.xpFill   = el('div', 'hud-xp-fill');
    this.xpFill.style.width = '0%';
    xpTrack.appendChild(this.xpFill);

    this.xpLevel = el('div', 'hud-xp-level');
    this.xpLevel.textContent = 'Lv 0';

    bar.append(goldLabel, this.goldText, kbHints, this.relicText, xpTrack, this.xpLevel);
    return bar;
  }

  // ── Subscriptions ────────────────────────────────────────────────────────

  private subscribe(): void {
    // Floor
    this.subs.push(
      runState.subscribe(s => s.floor, (floor) => {
        this.floorLabel.textContent = `Floor ${floor}`;
      }),
    );

    // Class badge
    this.subs.push(
      runState.subscribe(s => s.className, (name) => {
        this.classBadge.textContent = name ? `${name.toUpperCase()}` : '';
        this.classBadge.style.display = name ? 'flex' : 'none';
      }),
    );

    // Player HP
    this.subs.push(
      runState.subscribe(s => `${s.playerHp}|${s.playerMaxHp}`, () => {
        const s = runState.get();
        this.updatePlayerHp(s.playerHp, s.playerMaxHp);
      }),
    );

    // Gold
    this.subs.push(
      runState.subscribe(s => s.gold, (gold) => {
        this.goldText.textContent = `★ ${gold}`;
      }),
    );

    // Speed — update active button highlight
    this.subs.push(
      runState.subscribe(s => s.gameSpeed, (speed) => {
        this.speedBtns.forEach(btn => {
          const btnSpeed = Number(btn.dataset['speed']);
          btn.classList.toggle('is-active', btnSpeed === speed);
        });
      }),
    );

    // XP
    this.subs.push(
      runState.subscribe(s => `${s.playerXp}|${s.playerLevel}`, () => {
        const s = runState.get();
        const pct = Math.min(100, s.playerXp);
        this.xpFill.style.width = `${pct}%`;
        this.xpLevel.textContent = `Lv ${s.playerLevel}`;
      }),
    );

    // Relic count → update relic text via secondary subscription
    this.subs.push(
      runState.subscribe(s => s.relicCount, (count) => {
        this.relicText.textContent = count === 0 ? 'RELICS: none' : `RELICS: ${count}`;
        this.relicText.style.color = count > 0 ? '#ffd700' : '#444466';
      }),
    );
  }

  private updatePlayerHp(hp: number, maxHp: number): void {
    this.hpValue.textContent = `${hp} / ${maxHp}`;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.hpFill.style.width = `${Math.max(0, Math.floor(ratio * 100))}%`;
    const col = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    this.hpFill.style.background = col;
  }
}

// Tiny helper — avoids repeated document.createElement boilerplate
function el(tag: string, classes: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = classes;
  return e;
}
