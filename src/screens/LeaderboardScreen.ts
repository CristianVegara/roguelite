/**
 * LeaderboardScreen.ts — Personal run history leaderboard.
 *
 * CHANGES:
 *   - Desktop table: reduced from 9 columns to 7 (dropped score + time;
 *     both still visible in BuildInspector on row click).
 *   - Mobile: buildCardList() generates .lb-card elements as a compact
 *     alternative to the table. CSS shows one and hides the other.
 *   - Header count text replaced with personal-best context string.
 *   - lb-row-data: cursor:pointer now set in CSS (leaderboard.css fix).
 *   - Filter persistence unchanged.
 */

import { ServiceLocator }    from '../services/ServiceLocator';
import { RunResultDTO }       from '../services/types';
import { MODES_REGISTRY }     from '../modes/GameModeConfig';
import { router }             from '../router/Router';
import { openBuildInspector } from '../modals/BuildInspectorModal';

const STORAGE_KEY = 'lb_filters_v1';

interface Filters {
  modeId:  string;
  classId: string;
  sort:    'floor' | 'score' | 'kills' | 'date';
}

export function createLeaderboardScreen(): HTMLElement {
  return new LeaderboardScreen().el;
}

class LeaderboardScreen {
  readonly el: HTMLElement;

  private filters: Filters;
  private tableBody!:  HTMLElement;
  private cardList!:   HTMLElement;
  private allRuns: RunResultDTO[];

  constructor() {
    this.filters = this.loadFilters();
    this.allRuns = ServiceLocator.history.getRecentRuns(200);
    this.el = this.build();
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  private build(): HTMLElement {
    const root = el('div', 'lb-screen');

    root.append(
      this.buildHeader(),
      this.buildFilterBar(),
      this.buildTable(),
      this.buildCardList(),   // mobile alternative, hidden by CSS on desktop
    );

    return root;
  }

  // ── Header ──────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const hdr = el('div', 'lb-header');

    const back = el('button', 'lb-back-btn');
    back.textContent = '\u2190 BACK';
    back.addEventListener('click', () => router.back());

    const title = el('div', 'lb-title');
    title.textContent = 'RUN HISTORY';

    // FIX: show personal best context instead of raw run count
    const count = el('div', 'lb-count');
    const bestRun = this.allRuns
      .filter(r => r.mode_id === 'classic')
      .sort((a, b) => b.floor_reached - a.floor_reached)[0];
    count.textContent = bestRun
      ? 'Best: Floor ' + bestRun.floor_reached
      : this.allRuns.length + ' runs';

    hdr.append(back, title, count);
    return hdr;
  }

  // ── Filter bar ──────────────────────────────────────────────────────────────

  private buildFilterBar(): HTMLElement {
    const bar = el('div', 'lb-filter-bar');

    const modeSelect = this.buildSelect(
      'Mode',
      [{ value: '', label: 'All Modes' }, ...MODES_REGISTRY.map(m => ({ value: m.id, label: m.name }))],
      this.filters.modeId,
      (v) => { this.filters.modeId = v; this.saveFilters(); this.refresh(); },
    );

    const allClasses  = [...new Set(this.allRuns.map(r => r.class_id))].sort();
    const classSelect = this.buildSelect(
      'Class',
      [{ value: '', label: 'All Classes' },
       ...allClasses.map(c => ({ value: c, label: humanise(c) }))],
      this.filters.classId,
      (v) => { this.filters.classId = v; this.saveFilters(); this.refresh(); },
    );

    const sortSelect = this.buildSelect(
      'Sort',
      [
        { value: 'floor', label: 'Floor (desc)' },
        { value: 'score', label: 'Score (desc)' },
        { value: 'kills', label: 'Kills (desc)' },
        { value: 'date',  label: 'Date (newest)' },
      ],
      this.filters.sort,
      (v) => { this.filters.sort = v as Filters['sort']; this.saveFilters(); this.refresh(); },
    );

    bar.append(modeSelect, classSelect, sortSelect);
    return bar;
  }

  private buildSelect(
    label:    string,
    options:  Array<{ value: string; label: string }>,
    current:  string,
    onChange: (v: string) => void,
  ): HTMLElement {
    const wrap = el('div', 'lb-filter-wrap');

    const lbl = el('label', 'lb-filter-label');
    lbl.textContent = label;

    const sel = document.createElement('select');
    sel.className = 'lb-select';

    options.forEach(opt => {
      const o = document.createElement('option');
      o.value       = opt.value;
      o.textContent = opt.label;
      if (opt.value === current) o.selected = true;
      sel.appendChild(o);
    });

    sel.addEventListener('change', () => onChange(sel.value));
    wrap.append(lbl, sel);
    return wrap;
  }

  // ── Desktop table ────────────────────────────────────────────────────────────

  private buildTable(): HTMLElement {
    const wrap = el('div', 'lb-table-wrap');

    // FIX: 7 columns instead of 9 — score and time moved to BuildInspector
    const hdr = el('div', 'lb-row lb-row-hdr');
    ['#', 'DATE', 'CLASS', 'MODE', 'FLOOR', 'BUILD', 'KILLS'].forEach(col => {
      const c = el('span'); c.textContent = col; hdr.appendChild(c);
    });
    wrap.appendChild(hdr);

    this.tableBody = el('div', 'lb-table-body');
    wrap.appendChild(this.tableBody);

    return wrap;
  }

  // ── Mobile card list ─────────────────────────────────────────────────────────

  private buildCardList(): HTMLElement {
    this.cardList = el('div', 'lb-card-list');
    return this.cardList;
  }

  // ── Refresh (both table and card list) ────────────────────────────────────────

  private refresh(): void {
    let runs = [...this.allRuns];

    if (this.filters.modeId)  runs = runs.filter(r => r.mode_id  === this.filters.modeId);
    if (this.filters.classId) runs = runs.filter(r => r.class_id === this.filters.classId);

    const sort = this.filters.sort;
    runs.sort((a, b) => {
      if (sort === 'floor') return b.floor_reached - a.floor_reached;
      if (sort === 'score') return b.score - a.score;
      if (sort === 'kills') return b.kills - a.kills;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    this.refreshTable(runs);
    this.refreshCards(runs);
  }

  private refreshTable(runs: RunResultDTO[]): void {
    this.tableBody.innerHTML = '';

    if (runs.length === 0) {
      const empty = el('div', 'lb-empty');
      empty.textContent = 'No runs match these filters.';
      this.tableBody.appendChild(empty);
      return;
    }

    runs.forEach((run, i) => {
      const row = el('div', 'lb-row lb-row-data');
      if (i % 2 === 1) row.classList.add('is-alt');

      const modeCfg = MODES_REGISTRY.find(m => m.id === run.mode_id);
      const dateStr = new Date(run.date).toLocaleDateString('en-GB', {
        month: 'short', day: 'numeric',
      });

      // FIX: 7-column layout matches new lb-row grid in leaderboard.css
      const rank  = el('span', 'lb-rank');   rank.textContent  = String(i + 1);
      const date  = el('span', 'lb-date');   date.textContent  = dateStr;
      const cls   = el('span', 'lb-cls');    cls.textContent   = humanise(run.class_id);
      const mode  = el('span', 'lb-mode');
      mode.textContent = modeCfg ? modeCfg.icon + ' ' + modeCfg.name : run.mode_id;
      const floor = el('span', 'lb-floor');  floor.textContent = String(run.floor_reached);
      const build = el('span', 'lb-build');  build.textContent = run.build_archetype;
      const kills = el('span', 'lb-kills');  kills.textContent = String(run.kills);

      row.append(rank, date, cls, mode, floor, build, kills);
      row.addEventListener('click', () => openBuildInspector(run));
      this.tableBody.appendChild(row);
    });
  }

  private refreshCards(runs: RunResultDTO[]): void {
    this.cardList.innerHTML = '';

    if (runs.length === 0) {
      const empty = el('div', 'lb-empty');
      empty.textContent = 'No runs match these filters.';
      this.cardList.appendChild(empty);
      return;
    }

    runs.forEach((run, i) => {
      const modeCfg = MODES_REGISTRY.find(m => m.id === run.mode_id);
      const dateStr = new Date(run.date).toLocaleDateString('en-GB', {
        month: 'short', day: 'numeric',
      });

      // Mobile card: rank | primary (class + mode) | floor
      //              rank | meta (build archetype)  | date
      const card = el('div', 'lb-card');

      const rankEl   = el('div', 'lb-card-rank');
      rankEl.textContent = String(i + 1);

      const primaryEl = el('div', 'lb-card-primary');
      primaryEl.textContent =
        humanise(run.class_id) +
        (modeCfg ? ' \u00b7 ' + modeCfg.name : '');

      const floorEl  = el('div', 'lb-card-floor');
      floorEl.textContent = run.mode_id === 'boss_rush'
        ? (run.bosses_killed ?? 0) + ' bosses'
        : 'Fl. ' + run.floor_reached;

      const metaEl   = el('div', 'lb-card-meta');
      metaEl.textContent = run.build_archetype;

      const dateEl   = el('div', 'lb-card-date');
      dateEl.textContent = dateStr;

      card.append(rankEl, primaryEl, floorEl, metaEl, dateEl);
      card.addEventListener('click', () => openBuildInspector(run));
      this.cardList.appendChild(card);
    });
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  private loadFilters(): Filters {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Filters;
    } catch { /* ignore */ }
    return { modeId: '', classId: '', sort: 'floor' };
  }

  private saveFilters(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.filters)); }
    catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) className.split(' ').forEach(c => c && e.classList.add(c));
  return e;
}

function humanise(id: string): string {
  if (!id || id === 'unknown') return '\u2014';
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
}