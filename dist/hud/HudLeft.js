/**
 * HudLeft — top bar (floor, class badge, speed buttons) + player HP panel + bottom bar.
 *
 * CHANGES:
 *   - buildBottomBar(): restructured from 7 absolute-positioned elements into
 *     two flex zones (resources left / actions right) matching new hud.css layout.
 *     XP bar is now a 3px full-width strip at the top edge of the bar.
 *     Level badge moves into the gold row alongside the gold value.
 *   - Removed standalone hud-gold-label (label implicit in new layout).
 *   - BUILD/STATS buttons now toggle .is-active so CSS reflects open-panel state.
 */
import { runState } from '../bridge/RunStateStore';
import { bus } from '../bridge/GameEventBus';
export class HudLeft {
    constructor(frame) {
        this.speedBtns = [];
        this.buildPanelOpen = false;
        this.statsPanelOpen = false;
        this.subs = [];
        frame.appendChild(this.buildTopBar());
        frame.appendChild(this.buildPlayerHpPanel());
        frame.appendChild(this.buildBottomBar());
        this.subscribe();
    }
    destroy() {
        this.subs.forEach(off => off());
    }
    // ── DOM builders ─────────────────────────────────────────────────────────
    buildTopBar() {
        const bar = el('div', 'hud-topbar');
        this.floorLabel = el('div', 'hud-floor-label');
        this.floorLabel.textContent = 'Floor 1';
        bar.appendChild(this.floorLabel);
        this.classBadge = el('div', 'hud-class-badge');
        bar.appendChild(this.classBadge);
        const speedWrap = el('div', 'hud-speed-btns');
        const speeds = [1, 1.5, 2];
        const labels = ['1x', '1.5x', '2x'];
        speeds.forEach((speed, i) => {
            const btn = el('div', 'hud-speed-btn');
            btn.textContent = labels[i];
            btn.dataset['speed'] = String(speed);
            btn.addEventListener('click', () => bus.emit({ type: 'speed:change', payload: { speed } }));
            this.speedBtns.push(btn);
            speedWrap.appendChild(btn);
        });
        bar.appendChild(speedWrap);
        return bar;
    }
    buildPlayerHpPanel() {
        const panel = el('div', 'hud-hp-panel hud-hp-panel--player');
        const accent = el('div', 'hud-hp-accent');
        accent.style.background = '#4fc3f7';
        const name = el('div', 'hud-hp-name');
        name.textContent = '\u2190 YOU';
        name.style.color = '#4fc3f7';
        this.hpValue = el('div', 'hud-hp-value');
        const track = el('div', 'hud-hp-track');
        this.hpFill = el('div', 'hud-hp-fill');
        this.hpFill.style.background = '#2ecc71';
        track.appendChild(this.hpFill);
        panel.append(accent, name, this.hpValue, track);
        return panel;
    }
    buildBottomBar() {
        const bar = el('div', 'hud-botbar');
        // XP strip — 3px full-width bar at the top edge of the bottom bar
        const xpTrack = el('div', 'hud-xp-track');
        this.xpFill = el('div', 'hud-xp-fill');
        this.xpFill.style.width = '0%';
        xpTrack.appendChild(this.xpFill);
        bar.appendChild(xpTrack);
        // Left zone: resource readouts
        const resources = el('div', 'hud-botbar-resources');
        const goldRow = el('div', 'hud-botbar-gold-row');
        this.xpLevel = el('div', 'hud-xp-level');
        this.xpLevel.textContent = 'Lv 0';
        this.goldText = el('div', 'hud-gold');
        this.goldText.textContent = '★ 0';
        goldRow.append(this.xpLevel, this.goldText);
        this.relicText = el('div', 'hud-relic-text');
        this.relicText.textContent = 'RELICS: none';
        resources.append(goldRow, this.relicText);
        bar.appendChild(resources);
        // Vertical divider between zones
        bar.appendChild(el('div', 'hud-botbar-divider'));
        // Right zone: action buttons
        const kbHints = el('div', 'hud-kb-hints');
        // FIX: pause button added to desktop HUD — was missing, only M key worked
        const pauseBtn = el('button', 'hud-action-btn hud-action-btn--pause');
        pauseBtn.textContent = '\u23f8';
        pauseBtn.title = 'Pause (M)';
        pauseBtn.addEventListener('click', () => {
            bus.emit({ type: 'pause:open', payload: {} });
        });
        this.buildBtn = el('button', 'hud-action-btn');
        this.buildBtn.textContent = 'BUILD';
        this.buildBtn.title = 'Toggle build overview (B)';
        this.buildBtn.addEventListener('click', () => {
            bus.emit({ type: 'hud:toggle-build', payload: {} });
            this.buildPanelOpen = !this.buildPanelOpen;
            this.buildBtn.classList.toggle('is-active', this.buildPanelOpen);
        });
        this.statsBtn = el('button', 'hud-action-btn');
        this.statsBtn.textContent = 'STATS';
        this.statsBtn.title = 'Toggle stats panel (Tab)';
        this.statsBtn.addEventListener('click', () => {
            bus.emit({ type: 'hud:toggle-stats', payload: {} });
            this.statsPanelOpen = !this.statsPanelOpen;
            this.statsBtn.classList.toggle('is-active', this.statsPanelOpen);
        });
        kbHints.append(pauseBtn, this.buildBtn, this.statsBtn);
        bar.appendChild(kbHints);
        return bar;
    }
    // ── Subscriptions ────────────────────────────────────────────────────────
    subscribe() {
        this.subs.push(runState.subscribe(s => s.floor, (floor) => {
            this.floorLabel.textContent = `Floor ${floor}`;
        }));
        this.subs.push(runState.subscribe(s => s.className, (name) => {
            this.classBadge.textContent = name ? name.toUpperCase() : '';
            this.classBadge.style.display = name ? 'flex' : 'none';
        }));
        this.subs.push(runState.subscribe(s => `${s.playerHp}|${s.playerMaxHp}`, () => {
            const s = runState.get();
            this.updatePlayerHp(s.playerHp, s.playerMaxHp);
        }));
        this.subs.push(runState.subscribe(s => s.gold, (gold) => {
            this.goldText.textContent = `★ ${gold}`;
        }));
        this.subs.push(runState.subscribe(s => s.gameSpeed, (speed) => {
            this.speedBtns.forEach(btn => {
                btn.classList.toggle('is-active', Number(btn.dataset['speed']) === speed);
            });
        }));
        this.subs.push(runState.subscribe(s => `${s.playerXp}|${s.playerLevel}`, () => {
            const s = runState.get();
            this.xpFill.style.width = `${Math.min(100, s.playerXp)}%`;
            this.xpLevel.textContent = `Lv ${s.playerLevel}`;
        }));
        this.subs.push(runState.subscribe(s => s.relicCount, (count) => {
            this.relicText.textContent = count === 0 ? 'RELICS: none' : `RELICS: ${count}`;
            this.relicText.style.color = count > 0 ? '#ffd700' : '#444466';
        }));
        // Reset active states when run ends
        this.subs.push(runState.subscribe(s => s.isRunActive, (active) => {
            if (!active) {
                this.buildPanelOpen = false;
                this.statsPanelOpen = false;
                this.buildBtn.classList.remove('is-active');
                this.statsBtn.classList.remove('is-active');
            }
        }));
    }
    updatePlayerHp(hp, maxHp) {
        this.hpValue.textContent = `${hp} / ${maxHp}`;
        const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
        this.hpFill.style.width = `${Math.max(0, Math.floor(ratio * 100))}%`;
        this.hpFill.style.background = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    }
}
function el(tag, classes) {
    const e = document.createElement(tag);
    e.className = classes;
    return e;
}
