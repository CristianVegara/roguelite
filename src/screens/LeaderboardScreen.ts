/**
 * LeaderboardScreen.ts — Personal run history leaderboard (M12).
 *
 * Registered with the router under 'leaderboard'.
 * Reads from ServiceLocator.history.getRecentRuns().
 * Filters: Mode, Class, Sort. Persisted to localStorage.
 * Clicking a row opens BuildInspectorModal.
 */

import { ServiceLocator }   from '../services/ServiceLocator';
import { RunResultDTO }      from '../services/types';
import { MODES_REGISTRY }    from '../modes/GameModeConfig';
import { router }            from '../router/Router';
import { openBuildInspector } from '../modals/BuildInspectorModal';

const STORAGE_KEY = 'lb_filters_v1';

interface Filters {
  modeId:  string;   // '' = all
  classId: string;   // '' = all
  sort:    'floor' | 'score' | 'kills' | 'date';
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createLeaderboardScreen(): HTMLElement {
  return new LeaderboardScreen().el;
}

// ---------------------------------------------------------------------------
// LeaderboardScreen class
// ---------------------------------------------------------------------------

class LeaderboardScreen {
  readonly el: HTMLElement;

  private filters: Filters;
  private tableBody!: HTMLElement;
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
    );

    return root;
  }

  // ── Header ──────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const hdr = el('div', 'lb-header');

    const back = el('button', 'lb-back-btn');
    back.textContent = '← BACK';
    back.addEventListener('click', () => router.back());

    const title = el('div', 'lb-title');
    title.textContent = 'LEADERBOARD';

    const count = el('div', 'lb-count');
    count.textContent = `${this.allRuns.length} runs recorded`;

    hdr.append(back, title, count);
    return hdr;
  }

  // ── Filter bar ──────────────────────────────────────────────────────────────

  private buildFilterBar(): HTMLElement {
    const bar = el('div', 'lb-filter-bar');

    // Mode filter
    const modeSelect = this.buildSelect(
      'Mode',
      [{ value: '', label: 'All Modes' }, ...MODES_REGISTRY.map(m => ({ value: m.id, label: m.name }))],
      this.filters.modeId,
      (v) => { this.filters.modeId = v; this.saveFilters(); this.refresh(); },
    );

    // Class filter
    const allClasses = [...new Set(this.allRuns.map(r => r.class_id))].sort();
    const classSelect = this.buildSelect(
      'Class',
      [{ value: '', label: 'All Classes' }, ...allClasses.map(c => ({ value: c, label: humanise(c) }))],
      this.filters.classId,
      (v) => { this.filters.classId = v; this.saveFilters(); this.refresh(); },
    );

    // Sort
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
    label: string,
    options: Array<{ value: string; label: string }>,
    current: string,
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

  // ── Table ────────────────────────────────────────────────────────────────────

  private buildTable(): HTMLElement {
    const wrap = el('div', 'lb-table-wrap');

    // Header row
    const hdr = el('div', 'lb-row lb-row-hdr');
    ['#', 'DATE', 'CLASS', 'MODE', 'FLOOR', 'SCORE', 'BUILD', 'KILLS', 'TIME'].forEach(col => {
      const c = el('span'); c.textContent = col; hdr.appendChild(c);
    });
    wrap.appendChild(hdr);

    this.tableBody = el('div', 'lb-table-body');
    wrap.appendChild(this.tableBody);

    this.refresh();
    return wrap;
  }

  private refresh(): void {
    let runs = [...this.allRuns];

    // Filter
    if (this.filters.modeId)  runs = runs.filter(r => r.mode_id  === this.filters.modeId);
    if (this.filters.classId) runs = runs.filter(r => r.class_id === this.filters.classId);

    // Sort
    const sort = this.filters.sort;
    runs.sort((a, b) => {
      if (sort === 'floor') return b.floor_reached - a.floor_reached;
      if (sort === 'score') return b.score - a.score;
      if (sort === 'kills') return b.kills - a.kills;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

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
      const dateStr = new Date(run.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

      const rank    = el('span', 'lb-rank');     rank.textContent    = `${i + 1}`;
      const date    = el('span', 'lb-date');     date.textContent    = dateStr;
      const cls     = el('span', 'lb-cls');      cls.textContent     = humanise(run.class_id);
      const mode    = el('span', 'lb-mode');     mode.textContent    = modeCfg ? `${modeCfg.icon} ${modeCfg.name}` : run.mode_id;
      const floor   = el('span', 'lb-floor');    floor.textContent   = `${run.floor_reached}`;
      const score   = el('span', 'lb-score');    score.textContent   = `${run.score}`;
      const build   = el('span', 'lb-build');    build.textContent   = run.build_archetype;
      const kills   = el('span', 'lb-kills');    kills.textContent   = `${run.kills}`;
      const time    = el('span', 'lb-time');     time.textContent    = formatDuration(run.duration_ms);

      row.append(rank, date, cls, mode, floor, score, build, kills, time);
      row.addEventListener('click', () => openBuildInspector(run));
      this.tableBody.appendChild(row);
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
  if (!id || id === 'unknown') return '—';
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
