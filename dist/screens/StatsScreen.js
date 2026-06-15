/**
 * StatsScreen.ts — Full profile and statistics screen.
 *
 * CHANGES:
 *   - favoriteClassIcon(): fixed. Was a hardcoded map that silently returned
 *     '?' for unknown classes. Now uses ALL_CLASSES to look up the class's
 *     own .icon property, so new classes automatically get the right icon.
 *   - buildRunChart(): new section added above buildRecentRuns() showing
 *     last 10 runs as a proportional horizontal bar chart. Best floor = 100%.
 *     Bars are shaded from bright (most recent) to dim (oldest).
 *   - buildMilestones(): max 8 shown by default with a "Show all" toggle
 *     to avoid the grid growing unbounded.
 *   - buildContent(): run chart inserted between career stats and milestones.
 */
import { ServiceLocator } from '../services/ServiceLocator';
import { ALL_MILESTONES } from '../services/types';
import { ALL_CLASSES } from '../data/ClassDefinition';
import { router } from '../router/Router';
export function createStatsScreen() {
    return new StatsScreen().el;
}
class StatsScreen {
    constructor() {
        this.el = this.build();
    }
    build() {
        const root = el('div', 'stats-screen');
        const profile = ServiceLocator.profile.getProfile();
        const runs = ServiceLocator.history.getRecentRuns(10);
        root.append(this.buildHeader(), this.buildContent(profile, runs));
        return root;
    }
    // ── Header ─────────────────────────────────────────────────────────────────
    buildHeader() {
        const hdr = el('div', 'st-header');
        const back = el('button', 'st-back-btn');
        back.textContent = '\u2190 BACK';
        back.addEventListener('click', () => router.back());
        const title = el('div', 'st-header-title');
        title.textContent = 'YOUR PROFILE';
        hdr.append(back, title);
        const onKey = (e) => {
            if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
                document.removeEventListener('keydown', onKey);
                if (router.getCurrent()?.name !== 'combat')
                    router.back();
            }
        };
        document.addEventListener('keydown', onKey);
        return hdr;
    }
    // ── Scrollable content ──────────────────────────────────────────────────────
    buildContent(profile, runs) {
        const content = el('div', 'st-content');
        if (!profile) {
            const empty = el('p', 'st-empty');
            empty.textContent = 'No profile found.';
            content.appendChild(empty);
            return content;
        }
        content.append(this.buildPlayerCard(profile), this.buildCareerStats(profile), this.buildRunChart(runs), // FIX: chart added between stats and milestones
        this.buildClassStats(profile), this.buildMilestones(profile), this.buildRecentRuns(runs));
        return content;
    }
    // ── Player card ─────────────────────────────────────────────────────────────
    buildPlayerCard(p) {
        const card = el('div', 'st-player-card');
        const avatar = el('div', 'st-avatar');
        // FIX: use ALL_CLASSES to look up the class icon instead of a hardcoded
        // map. Falls back to '?' only when the class truly doesn't exist.
        avatar.textContent = favoriteClassIcon(p);
        const info = el('div', 'st-player-info');
        const titleStr = p.active_title ? '[' + p.active_title + '] ' : '';
        const nameEl = el('div', 'st-player-name');
        nameEl.textContent = titleStr + p.name;
        const joinDate = new Date(p.created_at).toLocaleDateString('en-GB', {
            month: 'short', year: 'numeric',
        });
        const streakStr = p.current_streak > 0
            ? '  \u{1F525} ' + p.current_streak + '-day streak' : '';
        const subEl = el('div', 'st-player-sub');
        subEl.textContent = 'Joined ' + joinDate + streakStr;
        const meta = el('div', 'st-player-meta');
        meta.textContent = p.total_runs + ' runs  \u00b7  ' + formatTime(p.total_play_ms) + ' total';
        info.append(nameEl, subEl, meta);
        card.append(avatar, info);
        return card;
    }
    // ── Career stats grid ───────────────────────────────────────────────────────
    buildCareerStats(p) {
        const wrap = el('div', 'st-section');
        wrap.appendChild(sectionLabel('CAREER'));
        const grid = el('div', 'st-stat-grid');
        const avgFloor = p.total_runs > 0
            ? (Object.values(p.floors_by_class).reduce((a, b) => a + b, 0) / p.total_runs).toFixed(1)
            : '\u2014';
        const stats = [
            ['BEST FLOOR', String(p.highest_floor)],
            ['TOTAL RUNS', String(p.total_runs)],
            ['WIN RATE', p.total_runs > 0
                    ? ((p.wins / p.total_runs) * 100).toFixed(1) + '%' : '\u2014'],
            ['AVG FLOOR', avgFloor],
            ['TOTAL KILLS', formatNum(p.total_kills)],
            ['BOSSES', String(p.total_bosses_killed)],
            ['DAMAGE', formatNum(p.total_damage_dealt)],
            ['HEALING', formatNum(p.total_healing_done)],
        ];
        stats.forEach(([label, value]) => {
            const cell = el('div', 'st-stat-cell');
            const lbl = el('div', 'st-stat-lbl');
            lbl.textContent = label;
            const val = el('div', 'st-stat-val');
            val.textContent = value;
            cell.append(lbl, val);
            grid.appendChild(cell);
        });
        wrap.appendChild(grid);
        return wrap;
    }
    // ── Run chart ───────────────────────────────────────────────────────────────
    /**
     * FIX: New section. Shows last 10 runs as proportional horizontal bars.
     * Best floor = full bar width = 100%. Bars fade from bright (run 1, newest)
     * to dim (run 10, oldest) so recent performance is visually prominent.
     */
    buildRunChart(runs) {
        const wrap = el('div', 'st-section');
        wrap.appendChild(sectionLabel('FLOOR HISTORY'));
        if (runs.length === 0) {
            const empty = el('p', 'st-empty');
            empty.textContent = 'No runs recorded yet.';
            wrap.appendChild(empty);
            return wrap;
        }
        const recent = runs.slice(0, 10);
        const bestFloor = Math.max(...recent.map(r => r.floor_reached), 1);
        const chart = el('div', 'st-run-chart');
        recent.forEach((run, i) => {
            const row = el('div', 'st-chart-row');
            const label = el('div', 'st-chart-label');
            label.textContent = String(i + 1);
            const barTrack = el('div', 'st-chart-track');
            const barFill = el('div', 'st-chart-fill');
            const pct = Math.round((run.floor_reached / bestFloor) * 100);
            barFill.style.width = pct + '%';
            // Fade older runs: most recent (i=0) → full opacity, oldest → 40%
            const opacity = 1 - (i / recent.length) * 0.6;
            barFill.style.opacity = opacity.toFixed(2);
            barTrack.appendChild(barFill);
            const value = el('div', 'st-chart-value');
            value.textContent = run.mode_id === 'boss_rush'
                ? (run.bosses_killed ?? 0) + ' bo'
                : 'Fl. ' + run.floor_reached;
            row.append(label, barTrack, value);
            chart.appendChild(row);
        });
        wrap.appendChild(chart);
        return wrap;
    }
    // ── Class stats ─────────────────────────────────────────────────────────────
    buildClassStats(p) {
        const wrap = el('div', 'st-section');
        wrap.appendChild(sectionLabel('BUILD HISTORY'));
        const favClass = p.favorite_class ?? 'none';
        const favRuns = p.runs_by_class[favClass] ?? 0;
        let bestClass = '\u2014';
        let bestAvg = 0;
        for (const [cls, total] of Object.entries(p.floors_by_class)) {
            const runs = p.runs_by_class[cls] ?? 1;
            const avg = total / runs;
            if (avg > bestAvg) {
                bestAvg = avg;
                bestClass = cls;
            }
        }
        const rows = [
            ['Most played class', humaniseClass(favClass) + '  (' + favRuns + ' runs)'],
            ['Best class by avg floor', humaniseClass(bestClass) + '  (avg fl. ' + bestAvg.toFixed(0) + ')'],
        ];
        const list = el('div', 'st-row-list');
        rows.forEach(([label, value]) => {
            const row = el('div', 'st-row');
            const lbl = el('span', 'st-row-lbl');
            lbl.textContent = label;
            const val = el('span', 'st-row-val');
            val.textContent = value;
            row.append(lbl, val);
            list.appendChild(row);
        });
        wrap.appendChild(list);
        return wrap;
    }
    // ── Milestones ──────────────────────────────────────────────────────────────
    buildMilestones(p) {
        const wrap = el('div', 'st-section');
        wrap.appendChild(sectionLabel('TITLES'));
        const grid = el('div', 'st-milestone-grid');
        const SHOW_MAX = 8;
        ALL_MILESTONES.forEach((m, i) => {
            const earned = p.unlocked_titles.includes(m.id);
            const chip = el('div', 'st-milestone-chip');
            if (earned)
                chip.classList.add('is-earned');
            // FIX: hide items beyond SHOW_MAX initially
            if (i >= SHOW_MAX)
                chip.classList.add('is-hidden-milestone');
            const check = el('span', 'st-milestone-check');
            check.textContent = earned ? '\u2713' : '\u25cb';
            const name = el('span', 'st-milestone-name');
            name.textContent = m.title;
            chip.append(check, name);
            grid.appendChild(chip);
        });
        wrap.appendChild(grid);
        // "Show all" toggle if there are hidden items
        if (ALL_MILESTONES.length > SHOW_MAX) {
            const remaining = ALL_MILESTONES.length - SHOW_MAX;
            const toggleBtn = el('button', 'st-show-more-btn');
            toggleBtn.textContent = 'Show ' + remaining + ' more';
            let expanded = false;
            toggleBtn.addEventListener('click', () => {
                expanded = !expanded;
                grid.querySelectorAll('.is-hidden-milestone').forEach(c => {
                    c.style.display = expanded ? '' : 'none';
                });
                toggleBtn.textContent = expanded
                    ? 'Show fewer'
                    : 'Show ' + remaining + ' more';
            });
            // Apply initial hidden state
            grid.querySelectorAll('.is-hidden-milestone').forEach(c => {
                c.style.display = 'none';
            });
            wrap.appendChild(toggleBtn);
        }
        return wrap;
    }
    // ── Recent runs ─────────────────────────────────────────────────────────────
    buildRecentRuns(runs) {
        const wrap = el('div', 'st-section');
        wrap.appendChild(sectionLabel('RECENT RUNS'));
        if (runs.length === 0) {
            const empty = el('p', 'st-empty');
            empty.textContent = 'No runs recorded yet.';
            wrap.appendChild(empty);
            return wrap;
        }
        const list = el('div', 'st-run-list');
        runs.forEach(run => {
            const dateStr = new Date(run.date).toLocaleDateString('en-GB', {
                month: 'short', day: 'numeric',
            });
            const row = el('div', 'st-run-row');
            const date = el('span', 'st-run-date');
            date.textContent = dateStr;
            const cls = el('span', 'st-run-class');
            cls.textContent = humaniseClass(run.class_id);
            const floor = el('span', 'st-run-floor');
            floor.textContent = 'Fl. ' + run.floor_reached;
            const build = el('span', 'st-run-build');
            build.textContent = run.build_archetype;
            const dur = el('span', 'st-run-dur');
            dur.textContent = formatTime(run.duration_ms);
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
function el(tag, className) {
    const e = document.createElement(tag);
    if (className)
        className.split(' ').forEach(c => c && e.classList.add(c));
    return e;
}
function sectionLabel(text) {
    const s = el('div', 'st-section-label');
    s.textContent = text;
    return s;
}
// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------
function formatNum(n) {
    if (n >= 1000000)
        return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)
        return (n / 1000).toFixed(1) + 'K';
    return String(n);
}
function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0)
        return h + 'h ' + (m % 60) + 'm';
    if (m > 0)
        return m + 'm ' + (s % 60) + 's';
    return s + 's';
}
function humaniseClass(id) {
    if (!id || id === '\u2014' || id === 'none' || id === 'unknown')
        return '\u2014';
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
}
/**
 * FIX: Was a hardcoded emoji map that returned '?' for any unrecognised class.
 * Now looks up the class definition's own .icon property via ALL_CLASSES.
 * New classes added to the game automatically get the right icon here.
 */
function favoriteClassIcon(p) {
    const id = p.favorite_class ?? '';
    const cls = ALL_CLASSES.find(c => c.id === id);
    return cls?.icon ?? '?';
}
