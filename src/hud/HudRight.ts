/**
 * HudRight — enemy HP panel + status pips.
 *
 * Subscribes to:
 *   enemyHp, enemyMaxHp, enemyName, enemyPoisonStacks, enemyBurnStacks
 */

import { runState } from '../bridge/RunStateStore';

export class HudRight {
  private nameEl!:    HTMLElement;
  private hpValue!:   HTMLElement;
  private hpFill!:    HTMLElement;
  private poisonPip!: HTMLElement;
  private burnPip!:   HTMLElement;

  private subs: Array<() => void> = [];

  constructor(frame: HTMLElement) {
    const panel = this.buildEnemyHpPanel();
    frame.appendChild(panel);
    this.subscribe();
  }

  destroy(): void {
    this.subs.forEach(off => off());
  }

  private buildEnemyHpPanel(): HTMLElement {
    const panel = el('div', 'hud-hp-panel hud-hp-panel--enemy');

    // Accent bar (enemy red)
    const accent = el('div', 'hud-hp-accent');
    accent.style.background = '#ef5350';

    // Name
    this.nameEl = el('div', 'hud-hp-name');
    this.nameEl.textContent = 'ENEMY';
    this.nameEl.style.color = '#ef5350';

    // Value
    this.hpValue = el('div', 'hud-hp-value');

    // Bar track + fill
    const track = el('div', 'hud-hp-track');
    this.hpFill  = el('div', 'hud-hp-fill');
    this.hpFill.style.background = '#e74c3c';
    track.appendChild(this.hpFill);

    // Status pips
    const pips = el('div', 'hud-status-pips');
    this.poisonPip = el('span', 'hud-pip--poison');
    this.burnPip   = el('span', 'hud-pip--burn');
    pips.append(this.poisonPip, this.burnPip);

    panel.append(accent, this.nameEl, this.hpValue, track, pips);
    return panel;
  }

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

    // Status effects
    this.subs.push(
      runState.subscribe(s => s.enemyPoisonStacks, (stacks) => {
        if (stacks > 0) {
          this.poisonPip.textContent = `☠ ×${stacks}`;
          this.poisonPip.style.display = 'inline';
        } else {
          this.poisonPip.style.display = 'none';
        }
      }),
    );

    this.subs.push(
      runState.subscribe(s => s.enemyBurnStacks, (stacks) => {
        this.burnPip.textContent = stacks > 0 ? '🔥 BURN' : '';
        this.burnPip.style.display = stacks > 0 ? 'inline' : 'none';
      }),
    );
  }

  private updateEnemy(hp: number, maxHp: number, name: string, isBoss: boolean): void {
    const isSpecial = maxHp >= 999999;

    // Name colour: gold for boss, red for normal
    this.nameEl.textContent = name.length > 22 ? name.slice(0, 20) + '…' : name;
    this.nameEl.style.color = isBoss ? '#ffd700' : '#ef5350';

    if (isSpecial) {
      this.hpValue.textContent = '';
      this.hpFill.style.width  = '0%';
      return;
    }

    this.hpValue.textContent = `${hp} / ${maxHp}`;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.hpFill.style.width = `${Math.max(0, Math.floor(ratio * 100))}%`;

    const col = ratio > 0.5 ? '#e74c3c' : ratio > 0.25 ? '#e67e22' : '#ff6b6b';
    this.hpFill.style.background = col;
  }
}

function el(tag: string, classes: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = classes;
  return e;
}
