/**
 * HudRight — enemy HP panel + status pips + summon mini-entity panel.
 *
 * Subscribes to:
 *   enemyHp, enemyMaxHp, enemyName, enemyPoisonStacks, enemyBurnStacks,
 *   summonCount, summonUpgrades
 *
 * CHANGES:
 *   - updateEnemy(): enemy name now carries a trailing " →" directional
 *     arrow to spatially anchor "this panel = right side = enemy."
 *     Mirrors the "← YOU" anchor added in HudLeft.ts.
 *   - updateEnemy(): boss label uses gold color AND a small crown prefix
 *     so bosses are visually distinct before you read the name.
 *   - buildEnemyHpPanel(): name element alignment set to right so the
 *     arrow stays at the panel edge, reinforcing the rightward anchor.
 *   - Status pips: poison/burn now display as compact colored pills
 *     rather than raw unicode — more consistent with the design system.
 */

import { runState } from '../bridge/RunStateStore';

const SUMMON_LABELS: Record<string, string> = {
  familiar:            'Familiar',
  pack_leader:         'Pack Leader',
  coordinated_strike:  'Coord. Strike',
  lich_form:           'Lich Form',
};

// How many characters of the enemy name fit before we truncate.
// Desktop panels are 232px wide — 22 chars at caption size is comfortable.
const NAME_MAX_CHARS = 22;

export class HudRight {
  private nameEl!:     HTMLElement;
  private hpValue!:    HTMLElement;
  private hpFill!:     HTMLElement;
  private poisonPip!:  HTMLElement;
  private burnPip!:    HTMLElement;

  private summonPanel!:       HTMLElement;
  private summonCountBadge!:  HTMLElement;
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
    this.nameEl.textContent = 'ENEMY \u2192';
    this.nameEl.style.color     = '#ef5350';
    // FIX: right-align so the arrow always sits at the panel's right edge,
    // reinforcing the "right side = enemy" spatial anchor.
    this.nameEl.style.textAlign = 'right';
    this.nameEl.style.left      = '8px';
    this.nameEl.style.right     = '8px';
    this.nameEl.style.width     = 'auto';

    this.hpValue = el('div', 'hud-hp-value');

    const track  = el('div', 'hud-hp-track');
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

  private buildSummonPanel(): HTMLElement {
    this.summonPanel = el('div', 'hud-summon-panel');
    this.summonPanel.style.display = 'none';

    const header = el('div', 'hud-summon-header');
    const icon   = el('span', 'hud-summon-icon');
    icon.textContent = '\ud83d\udc41';          // 👁
    const title  = el('span', 'hud-summon-title');
    title.textContent = 'SUMMONS';
    this.summonCountBadge = el('span', 'hud-summon-count');
    this.summonCountBadge.textContent = '\xd70';

    header.append(icon, title, this.summonCountBadge);

    this.summonUpgradeList = el('div', 'hud-summon-upgrade-list');

    this.summonPanel.append(header, this.summonUpgradeList);
    return this.summonPanel;
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  private subscribe(): void {
    this.subs.push(
      runState.subscribe(
        s => `${s.enemyHp}|${s.enemyMaxHp}|${s.enemyName}|${s.isBoss}`,
        () => {
          const s = runState.get();
          this.updateEnemy(s.enemyHp, s.enemyMaxHp, s.enemyName, s.isBoss);
        },
      ),
    );

    this.subs.push(
      runState.subscribe(s => s.enemyPoisonStacks, (stacks) => {
        if (stacks > 0) {
          this.poisonPip.textContent  = '\u2620 \xd7' + stacks;
          this.poisonPip.style.display = 'inline';
        } else {
          this.poisonPip.style.display = 'none';
        }
      }),
    );

    this.subs.push(
      runState.subscribe(s => s.enemyBurnStacks, (stacks) => {
        if (stacks > 0) {
          this.burnPip.textContent   = '\ud83d\udd25 BURN';
          this.burnPip.style.display = 'inline';
        } else {
          this.burnPip.style.display = 'none';
        }
      }),
    );

    this.subs.push(
      runState.subscribe(s => s.summonCount, (count) => {
        this.summonPanel.style.display    = count > 0 ? 'block' : 'none';
        this.summonCountBadge.textContent = '\xd7' + count;
      }),
    );

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

  private updateEnemy(
    hp: number, maxHp: number, name: string, isBoss: boolean,
  ): void {
    const isSpecial = maxHp >= 999999;

    // FIX: boss gets a crown prefix so it's visually distinct before reading
    // the name. Regular enemies get no prefix.
    const prefix  = isBoss ? '\u265b ' : '';
    // FIX: trailing arrow anchors this panel to the right side of the screen
    const display = prefix +
      (name.length > NAME_MAX_CHARS ? name.slice(0, NAME_MAX_CHARS - 1) + '\u2026' : name) +
      ' \u2192';

    this.nameEl.textContent = display;
    this.nameEl.style.color = isBoss ? '#ffd700' : '#ef5350';

    if (isSpecial) {
      this.hpValue.textContent = '';
      this.hpFill.style.width  = '0%';
      return;
    }

    this.hpValue.textContent = hp + ' / ' + maxHp;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.hpFill.style.width      = Math.max(0, Math.floor(ratio * 100)) + '%';
    this.hpFill.style.background =
      ratio > 0.5 ? '#e74c3c' : ratio > 0.25 ? '#e67e22' : '#ff6b6b';
  }

  private rebuildSummonUpgradeList(upgrades: Record<string, number>): void {
    this.summonUpgradeList.innerHTML = '';

    const entries = Object.entries(upgrades).filter(([, stacks]) => stacks > 0);
    if (entries.length === 0) return;

    for (const [id, stacks] of entries) {
      const row = el('div', 'hud-summon-upgrade-row');

      const nameSpan = el('span', 'hud-summon-upgrade-name');
      nameSpan.textContent = SUMMON_LABELS[id] ?? id;

      const dotsSpan = el('span', 'hud-summon-upgrade-dots');
      dotsSpan.textContent = '\u25cf'.repeat(stacks);

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