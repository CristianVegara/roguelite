/**
 * HudRight — enemy HP panel + status pips + summon mini-entity panel.
 *
 * Subscribes to:
 *   enemyHp, enemyMaxHp, enemyName, enemyPoisonStacks, enemyBurnStacks,
 *   summonCount, summonUpgrades
 */

import { runState } from '../bridge/RunStateStore';

// Human-readable labels for each summon upgrade ID.
const SUMMON_LABELS: Record<string, string> = {
  familiar:            'Familiar',
  pack_leader:         'Pack Leader',
  coordinated_strike:  'Coord. Strike',
  lich_form:           'Lich Form',
};

export class HudRight {
  private nameEl!:     HTMLElement;
  private hpValue!:    HTMLElement;
  private hpFill!:     HTMLElement;
  private poisonPip!:  HTMLElement;
  private burnPip!:    HTMLElement;

  // Summon mini-entity panel
  private summonPanel!:      HTMLElement;
  private summonCountBadge!: HTMLElement;
  private summonUpgradeList!: HTMLElement;

  private subs: Array<() => void> = [];

  constructor(frame: HTMLElement) {
    frame.appendChild(this.buildEnemyHpPanel());
    frame.appendChild(this.buildSummonPanel());
    this.subscribe();
  }

  destroy(): void {
    this.subs.forEach(off => off());
  }

  // ── DOM builders ──────────────────────────────────────────────────────────

  private buildEnemyHpPanel(): HTMLElement {
    const panel = el('div', 'hud-hp-panel hud-hp-panel--enemy');

    const accent = el('div', 'hud-hp-accent');
    accent.style.background = '#ef5350';

    this.nameEl = el('div', 'hud-hp-name');
    this.nameEl.textContent = 'ENEMY';
    this.nameEl.style.color = '#ef5350';

    this.hpValue = el('div', 'hud-hp-value');

    const track = el('div', 'hud-hp-track');
    this.hpFill  = el('div', 'hud-hp-fill');
    this.hpFill.style.background = '#e74c3c';
    track.appendChild(this.hpFill);

    const pips = el('div', 'hud-status-pips');
    this.poisonPip = el('span', 'hud-pip--poison');
    this.burnPip   = el('span', 'hud-pip--burn');
    pips.append(this.poisonPip, this.burnPip);

    panel.append(accent, this.nameEl, this.hpValue, track, pips);
    return panel;
  }

  /**
   * Summon mini-entity panel — shows below the enemy HP panel when the player
   * has at least one summon active.
   *
   * Layout:
   *   ┌─────────────────────────────┐
   *   │  👁  SUMMONS  ×N            │  ← header row
   *   │  • Familiar       ×1        │  ← one row per owned summon upgrade
   *   │  • Pack Leader    ×2        │
   *   └─────────────────────────────┘
   */
  private buildSummonPanel(): HTMLElement {
    this.summonPanel = el('div', 'hud-summon-panel');
    this.summonPanel.style.display = 'none';

    // Header
    const header = el('div', 'hud-summon-header');

    const icon = el('span', 'hud-summon-icon');
    icon.textContent = '👁';

    const title = el('span', 'hud-summon-title');
    title.textContent = 'SUMMONS';

    this.summonCountBadge = el('span', 'hud-summon-count');
    this.summonCountBadge.textContent = '×0';

    header.append(icon, title, this.summonCountBadge);

    // Upgrade list (populated dynamically)
    this.summonUpgradeList = el('div', 'hud-summon-upgrade-list');

    this.summonPanel.append(header, this.summonUpgradeList);
    return this.summonPanel;
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  private subscribe(): void {
    // Enemy HP + name
    this.subs.push(
      runState.subscribe(
        s => `${s.enemyHp}|${s.enemyMaxHp}|${s.enemyName}|${s.isBoss}`,
        () => {
          const s = runState.get();
          this.updateEnemy(s.enemyHp, s.enemyMaxHp, s.enemyName, s.isBoss);
        },
      ),
    );

    // Status pips
    this.subs.push(
      runState.subscribe(s => s.enemyPoisonStacks, (stacks) => {
        this.poisonPip.textContent  = stacks > 0 ? `☠ ×${stacks}` : '';
        this.poisonPip.style.display = stacks > 0 ? 'inline' : 'none';
      }),
    );

    this.subs.push(
      runState.subscribe(s => s.enemyBurnStacks, (stacks) => {
        this.burnPip.textContent   = stacks > 0 ? '🔥 BURN' : '';
        this.burnPip.style.display = stacks > 0 ? 'inline' : 'none';
      }),
    );

    // Summon count badge
    this.subs.push(
      runState.subscribe(s => s.summonCount, (count) => {
        this.summonPanel.style.display   = count > 0 ? 'block' : 'none';
        this.summonCountBadge.textContent = `×${count}`;
      }),
    );

    // Summon upgrades list — re-render whenever the owned map changes
    this.subs.push(
      runState.subscribe(
        s => JSON.stringify(s.summonUpgrades),
        () => {
          const upgrades = runState.get().summonUpgrades;
          this.rebuildSummonUpgradeList(upgrades);
        },
      ),
    );
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  private updateEnemy(hp: number, maxHp: number, name: string, isBoss: boolean): void {
    const isSpecial = maxHp >= 999999;

    this.nameEl.textContent = name.length > 22 ? name.slice(0, 20) + '…' : name;
    this.nameEl.style.color = isBoss ? '#ffd700' : '#ef5350';

    if (isSpecial) {
      this.hpValue.textContent = '';
      this.hpFill.style.width  = '0%';
      return;
    }

    this.hpValue.textContent = `${hp} / ${maxHp}`;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.hpFill.style.width    = `${Math.max(0, Math.floor(ratio * 100))}%`;
    this.hpFill.style.background = ratio > 0.5 ? '#e74c3c' : ratio > 0.25 ? '#e67e22' : '#ff6b6b';
  }

  /**
   * Clears and rebuilds the summon upgrade rows.
   * Each row: "• <name>  ×<stacks>"  with stack dots on the right.
   */
  private rebuildSummonUpgradeList(upgrades: Record<string, number>): void {
    this.summonUpgradeList.innerHTML = '';

    const entries = Object.entries(upgrades).filter(([, stacks]) => stacks > 0);
    if (entries.length === 0) return;

    for (const [id, stacks] of entries) {
      const row = el('div', 'hud-summon-upgrade-row');

      const nameSpan = el('span', 'hud-summon-upgrade-name');
      nameSpan.textContent = SUMMON_LABELS[id] ?? id;

      const dotsSpan = el('span', 'hud-summon-upgrade-dots');
      dotsSpan.textContent = '●'.repeat(stacks);

      row.append(nameSpan, dotsSpan);
      this.summonUpgradeList.appendChild(row);
    }
  }
}

function el(tag: string, classes: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = classes;
  return e;
}
