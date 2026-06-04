/**
 * StatsScreen.ts — HTML replacement for StatsScene.
 *
 * Registered with the router under 'stats'.
 * Data sources: ServiceLocator.profile, ServiceLocator.history.
 * No bus / Phaser interaction needed.
 */

import { ServiceLocator }                              from '../services/ServiceLocator';
import { PlayerProfileDTO, RunResultDTO, ALL_MILESTONES } from '../services/types';
import { router }                                      from '../router/Router';

// ---------------------------------------------------------------------------
// Factory — registered with the router
// ---------------------------------------------------------------------------

export function createStatsScreen(): HTMLElement {
  return new StatsScreen().el;
}

// ---------------------------------------------------------------------------
// StatsScreen class
// ---------------------------------------------------------------------------

class StatsScreen {
  readonly el: HTMLElement;

  constructor() {
    this.el = this.build();
  }

  private build(): HTMLElement {
    const root = el('div', 'stats-screen');

    const profile = ServiceLocator.profile.getProfile();
    const runs    = ServiceLocator.history.getRecentRuns(10);

    root.append(
      this.buildHeader(),
      this.buildContent(profile, runs),
    );

    return root;
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const hdr = el('div', 'st-header');

    const back = el('button', 'st-back-btn');
    back.textContent = '← BACK';
    back.addEventListener('click', () => router.back());

    const title = el('div', 'st-header-title');
    title.textContent = 'YOUR PROFILE';

    hdr.append(back, title);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
        document.removeEventListener('keydown', onKey);
        if (router.getCurrent()?.name !== 'combat') router.back();
      }
    };
    document.addEventListener('keydown', onKey);

    return hdr;
  }

  // ── Scrollable content ──────────────────────────────────────────────────────

  private buildContent(profile: PlayerProfileDTO | null, runs: RunResultDTO[]): HTMLElement {
    const content = el('div', 'st-content');

    if (!profile) {
      const empty = el('p', 'st-empty'); empty.textContent = 'No profile found.';
      content.appendChild(empty);
      return content;
    }

    content.append(
      this.buildPlayerCard(profile),
      this.buildCareerStats(profile),
      this.buildClassStats(profile),
      this.buildMilestones(profile),
      this.buildRecentRuns(runs),
    );

    return content;
  }

  // ── Player card ─────────────────────────────────────────────────────────────

  private buildPlayerCard(p: PlayerProfileDTO): HTMLElement {
    const card = el('div', 'st-player-card');

    const avatar = el('div', 'st-avatar');
    avatar.textContent = favoriteClassIcon(p);

    const info = el('div', 'st-player-info');

    const titleStr = p.active_title ? `[${p.active_title}] ` : '';
    const nameEl = el('div', 'st-player-name');
    nameEl.textContent = `${titleStr}${p.name}`;

    const joinDate = new Date(p.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const streakStr = p.current_streak > 0 ? `  🔥 ${p.current_streak}-day streak` : '';
    const subEl = el('div', 'st-player-sub');
    subEl.textContent = `Joined ${joinDate}${streakStr}`;

    const meta = el('div', 'st-player-meta');
    meta.textContent = `${p.total_runs} runs  ·  ${formatTime(p.total_play_ms)} total`;

    info.append(nameEl, subEl, meta);
    card.append(avatar, info);
    return card;
  }

  // ── Career stats grid ───────────────────────────────────────────────────────

  private buildCareerStats(p: PlayerProfileDTO): HTMLElement {
    const wrap = el('div', 'st-section');
    wrap.appendChild(sectionLabel('CAREER'));

    const grid = el('div', 'st-stat-grid');

    const avgFloor = p.total_runs > 0
      ? (Object.values(p.floors_by_class).reduce((a, b) => a + b, 0) / p.total_runs).toFixed(1)
      : '—';

    const stats: Array<[string, string]> = [
      ['BEST FLOOR',  `${p.highest_floor}`],
      ['TOTAL RUNS',  `${p.total_runs}`],
      ['WIN RATE',    p.total_runs > 0 ? `${((p.wins / p.total_runs) * 100).toFixed(1)}%` : '—'],
      ['AVG FLOOR',   avgFloor],
      ['TOTAL KILLS', formatNum(p.total_kills)],
      ['BOSSES',      `${p.total_bosses_killed}`],
      ['DAMAGE',      formatNum(p.total_damage_dealt)],
      ['HEALING',     formatNum(p.total_healing_done)],
    ];

    stats.forEach(([label, value]) => {
      const cell = el('div', 'st-stat-cell');
      const lbl  = el('div', 'st-stat-lbl'); lbl.textContent  = label;
      const val  = el('div', 'st-stat-val'); val.textContent  = value;
      cell.append(lbl, val);
      grid.appendChild(cell);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  // ── Class stats ─────────────────────────────────────────────────────────────

  private buildClassStats(p: PlayerProfileDTO): HTMLElement {
    const wrap = el('div', 'st-section');
    wrap.appendChild(sectionLabel('BUILD HISTORY'));

    const favClass = p.favorite_class ?? 'none';
    const favRuns  = p.runs_by_class[favClass] ?? 0;

    let bestClass = '—'; let bestAvg = 0;
    for (const [cls, total] of Object.entries(p.floors_by_class)) {
      const runs = p.runs_by_class[cls] ?? 1;
      const avg  = total / runs;
      if (avg > bestAvg) { bestAvg = avg; bestClass = cls; }
    }

    const rows: Array<[string, string]> = [
      ['Most played class', `${humaniseClass(favClass)}  (${favRuns} runs)`],
      ['Best class by avg floor', `${humaniseClass(bestClass)}  (avg fl. ${bestAvg.toFixed(0)})`],
    ];

    const list = el('div', 'st-row-list');
    rows.forEach(([label, value]) => {
      const row = el('div', 'st-row');
      const lbl = el('span', 'st-row-lbl'); lbl.textContent = label;
      const val = el('span', 'st-row-val'); val.textContent = value;
      row.append(lbl, val);
      list.appendChild(row);
    });

    wrap.appendChild(list);
    return wrap;
  }

  // ── Milestones ──────────────────────────────────────────────────────────────

  private buildMilestones(p: PlayerProfileDTO): HTMLElement {
    const wrap = el('div', 'st-section');
    wrap.appendChild(sectionLabel('TITLES'));

    const grid = el('div', 'st-milestone-grid');

    ALL_MILESTONES.forEach(m => {
      const earned = p.unlocked_titles.includes(m.id);
      const chip   = el('div', 'st-milestone-chip');
      if (earned) chip.classList.add('is-earned');

      const check = el('span', 'st-milestone-check'); check.textContent = earned ? '✓' : '○';
      const name  = el('span', 'st-milestone-name');  name.textContent  = m.title;

      chip.append(check, name);
      grid.appendChild(chip);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  // ── Recent runs ─────────────────────────────────────────────────────────────

  private buildRecentRuns(runs: RunResultDTO[]): HTMLElement {
    const wrap = el('div', 'st-section');
    wrap.appendChild(sectionLabel('RECENT RUNS'));

    if (runs.length === 0) {
      const empty = el('p', 'st-empty'); empty.textContent = 'No runs recorded yet.';
      wrap.appendChild(empty);
      return wrap;
    }

    const list = el('div', 'st-run-list');
    runs.forEach(run => {
      const dateStr = new Date(run.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

      const row = el('div', 'st-run-row');
      const date  = el('span', 'st-run-date');   date.textContent  = dateStr;
      const cls   = el('span', 'st-run-class');  cls.textContent   = humaniseClass(run.class_id);
      const floor = el('span', 'st-run-floor');  floor.textContent = `Fl. ${run.floor_reached}`;
      const build = el('span', 'st-run-build');  build.textContent = run.build_archetype;
      const dur   = el('span', 'st-run-dur');    dur.textContent   = formatTime(run.duration_ms);

      row.append(date, cls, floor, build, dur);
      list.appendChild(row);
    });

    wrap.appendChild(list);
    return wrap;
  }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) className.split(' ').forEach(c => c && e.classList.add(c));
  return e;
}

function sectionLabel(text: string): HTMLElement {
  const s = el('div', 'st-section-label'); s.textContent = text; return s;
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function humaniseClass(id: string): string {
  if (!id || id === '—' || id === 'none' || id === 'unknown') return '—';
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
}

function favoriteClassIcon(p: PlayerProfileDTO): string {
  const icons: Record<string, string> = {
    necromancer: '💀', assassin: '🗡', paladin: '🛡',
    pyromancer: '🔥', plague_doctor: '🧪', berserker: '⚔',
    archmage: '⚡', warlock: '📜',
  };
  return icons[p.favorite_class ?? ''] ?? '?';
}
