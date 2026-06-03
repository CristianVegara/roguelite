/**
 * GameOverModal.ts — HTML replacement for showGameOverOverlay().
 *
 * Self-managing: instantiated once from main.ts.
 * Opens on bus 'run:ended'.
 *
 * Buttons:
 *   Play Again   → startRun({ same modeId + classId })
 *   Return to Hub → router.navigate('home')
 *
 * Mounts in #modal-root.
 */

import { bus }       from '../bridge/GameEventBus';
import { router }    from '../router/Router';
import { startRun }  from '../bridge/startRun';
import { ALL_RELICS }    from '../data/AllRelics';
import { metaService }   from '../meta/MetaService';
import { RunResultDTO } from '../services/types';
import { ModeId }       from '../modes/GameModeConfig';

export class GameOverModal {
  private root:   HTMLElement;
  private active = false;

  constructor() {
    this.root = document.getElementById('modal-root')!;

    bus.on('run:ended', (e) => {
      if (this.active) return;
      this.open(e.payload.result, e.payload.newTitles, e.payload.goldEarned);
    });
  }

  // ── Open / close ────────────────────────────────────────────────────────────

  private open(run: RunResultDTO, newTitles: string[], goldEarned: number): void {
    this.active = true;

    const dim = document.createElement('div');
    dim.className = 'modal-dim';

    const panel = document.createElement('div');
    panel.className = 'go-panel';

    panel.append(
      this.buildTitle(run),
      this.buildPrimaryStats(run),
      this.buildCombatStats(run),
      this.buildRelics(run),
      this.buildEarned(goldEarned),
      ...newTitles.length > 0 ? [this.buildTitleUnlock(newTitles[0])] : [],
      this.buildButtons(run),
    );

    dim.appendChild(panel);
    this.root.appendChild(dim);
    requestAnimationFrame(() => dim.classList.add('is-visible'));
  }

  private close(): void {
    this.active = false;
    const dim = this.root.querySelector('.modal-dim');
    if (dim) {
      dim.classList.remove('is-visible');
      dim.addEventListener('transitionend', () => dim.remove(), { once: true });
    }
  }

  // ── Sections ────────────────────────────────────────────────────────────────

  private buildTitle(run: RunResultDTO): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'go-title-wrap';

    const title = document.createElement('div');
    title.className   = 'go-title';
    title.textContent = run.won ? 'VICTORY' : 'GAME OVER';
    if (run.won) title.classList.add('is-victory');

    const identity = document.createElement('div');
    identity.className   = 'go-identity';
    identity.textContent = `${run.class_id.toUpperCase()}  ·  ${run.build_archetype}`;

    wrap.append(title, identity);
    return wrap;
  }

  private buildPrimaryStats(run: RunResultDTO): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'go-primary';

    const isBossRush   = run.mode_id === 'boss_rush';
    const primaryLabel = isBossRush ? 'BOSSES CLEARED' : 'FLOOR';
    const primaryValue = isBossRush ? `${run.bosses_killed ?? 0}` : `${run.floor_reached}`;
    const bestValue    = `${metaService.highestFloor}`;

    const current = this.statBlock(primaryLabel, primaryValue, false);
    const best    = this.statBlock('BEST', bestValue, true);

    wrap.append(current, best);
    return wrap;
  }

  private buildCombatStats(run: RunResultDTO): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'go-stat-grid';

    const stats: Array<[string, string]> = [
      ['KILLS',    `${run.kills}`],
      ['BOSSES',   `${run.bosses_killed ?? 0}`],
      ['TOP HIT',  `${run.highest_hit}`],
      ['HEALED',   `${run.healing_done}`],
      ['DAMAGE',   `${run.damage_dealt}`],
      ['TIME',     formatDuration(run.duration_ms)],
    ];

    stats.forEach(([label, value]) => {
      const cell  = document.createElement('div');
      cell.className = 'go-stat-cell';
      const valEl = document.createElement('div');
      valEl.className   = 'go-stat-val';
      valEl.textContent = value;
      const lblEl = document.createElement('div');
      lblEl.className   = 'go-stat-lbl';
      lblEl.textContent = label;
      cell.append(valEl, lblEl);
      grid.appendChild(cell);
    });

    return grid;
  }

  private buildRelics(run: RunResultDTO): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'go-relics';

    if (!run.relics_owned || run.relics_owned.length === 0) {
      const empty = document.createElement('span');
      empty.className   = 'go-relics-empty';
      empty.textContent = 'No relics found';
      wrap.appendChild(empty);
      return wrap;
    }

    run.relics_owned.forEach(id => {
      const def  = ALL_RELICS.find(r => r.id === id);
      const chip = document.createElement('span');
      chip.className   = 'go-relic-chip';
      chip.textContent = `◈ ${def ? def.name : id}`;
      wrap.appendChild(chip);
    });

    return wrap;
  }

  private buildEarned(goldEarned: number): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'go-earned';

    const label = document.createElement('span');
    label.className   = 'go-earned-label';
    label.textContent = 'EARNED';

    const val = document.createElement('span');
    val.className   = 'go-earned-val';
    val.textContent = `+${goldEarned} ★`;

    wrap.append(label, val);
    return wrap;
  }

  private buildTitleUnlock(titleName: string): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'go-title-unlock';

    const text = document.createElement('span');
    text.textContent = `✦ Title unlocked: ${titleName}`;
    banner.appendChild(text);
    return banner;
  }

  private buildButtons(run: RunResultDTO): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'go-buttons';

    const playAgain = document.createElement('button');
    playAgain.className   = 'go-btn go-btn-primary';
    playAgain.textContent = 'PLAY AGAIN';
    playAgain.addEventListener('click', () => {
      this.close();
      startRun({ modeId: run.mode_id as ModeId, classId: run.class_id });
    });

    const toHub = document.createElement('button');
    toHub.className   = 'go-btn go-btn-secondary';
    toHub.textContent = 'RETURN TO HUB';
    toHub.addEventListener('click', () => {
      this.close();
      router.navigate('home');
    });

    wrap.append(playAgain, toHub);
    return wrap;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private statBlock(label: string, value: string, dim: boolean): HTMLElement {
    const block = document.createElement('div');
    block.className = 'go-stat-block';
    if (dim) block.classList.add('is-dim');

    const valEl = document.createElement('div');
    valEl.className   = 'go-block-val';
    valEl.textContent = value;

    const lblEl = document.createElement('div');
    lblEl.className   = 'go-block-lbl';
    lblEl.textContent = label;

    block.append(valEl, lblEl);
    return block;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
