import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';
import { ServiceLocator } from '../services/ServiceLocator';
import { ALL_MILESTONES } from '../services/types';
/**
 * StatsScene — full career statistics page.
 *
 * Accessible from HomeScene via the PROFILE button.
 * Displays: career overview, per-class breakdown, recent runs, milestones.
 * Uses a simple vertically-scrollable container with mouse-wheel support.
 */
export class StatsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'StatsScene' });
        this.scrollY = 0;
        this.maxScroll = 0;
    }
    create() {
        this.scrollY = 0;
        this.cameras.main.fadeIn(250, 0, 0, 0);
        const profile = ServiceLocator.profile.getProfile();
        const runs = ServiceLocator.history.getRecentRuns(5);
        this.drawBackground();
        this.buildContent(profile, runs);
        this.buildBackButton();
        this.bindInput();
    }
    // ---------------------------------------------------------------------------
    // Background
    // ---------------------------------------------------------------------------
    drawBackground() {
        const g = this.add.graphics();
        g.fillStyle(0x080812);
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        // Header bar
        g.fillStyle(0x0c0c1e);
        g.fillRect(0, 0, GAME_WIDTH, 44);
        g.lineStyle(1, 0x1a1a30);
        g.lineBetween(0, 44, GAME_WIDTH, 44);
    }
    // ---------------------------------------------------------------------------
    // Header / back button
    // ---------------------------------------------------------------------------
    buildBackButton() {
        this.add.text(12, 22, '← BACK', {
            fontSize: '11px', color: '#555577', fontFamily: 'monospace',
        }).setOrigin(0, 0.5).setDepth(10)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerover', function () { this.setColor('#e0e0e0'); })
            .on('pointerout', function () { this.setColor('#555577'); })
            .on('pointerdown', () => this.scene.start('HomeScene'));
        this.add.text(GAME_WIDTH / 2, 22, 'YOUR PROFILE', {
            fontSize: '14px', color: '#e0e0e0',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.input.keyboard?.once('keydown-B', () => this.scene.start('HomeScene'));
        this.input.keyboard?.once('keydown-ESC', () => this.scene.start('HomeScene'));
        this.input.keyboard?.once('keydown-BACK', () => this.scene.start('HomeScene'));
    }
    // ---------------------------------------------------------------------------
    // Scrollable content
    // ---------------------------------------------------------------------------
    buildContent(profile, runs) {
        const SCROLL_TOP = 52;
        this.content = this.add.container(0, SCROLL_TOP);
        // Apply scroll mask
        const maskG = this.make.graphics({});
        maskG.fillRect(0, SCROLL_TOP, GAME_WIDTH, GAME_HEIGHT - SCROLL_TOP);
        this.content.setMask(maskG.createGeometryMask());
        let cursor = 0; // local y inside container
        if (!profile) {
            this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'No profile found.', {
                fontSize: '13px', color: '#555577', fontFamily: 'monospace',
            }).setOrigin(0.5);
            return;
        }
        cursor = this.addPlayerCard(profile, cursor);
        cursor = this.addCareerStats(profile, cursor);
        cursor = this.addClassStats(profile, cursor);
        cursor = this.addMilestones(profile, cursor);
        cursor = this.addRecentRuns(runs, cursor);
        // Bottom padding
        cursor += 20;
        const visibleH = GAME_HEIGHT - SCROLL_TOP;
        this.maxScroll = Math.max(0, cursor - visibleH);
    }
    // ── Player card ─────────────────────────────────────────────────────────────
    addPlayerCard(p, y) {
        const H = 68;
        const bg = this.add.graphics();
        bg.fillStyle(0x0c0c1e);
        bg.fillRect(8, y, GAME_WIDTH - 16, H);
        bg.lineStyle(1, 0x1a1a30);
        bg.strokeRect(8, y, GAME_WIDTH - 16, H);
        this.content.add(bg);
        // Avatar circle
        const av = this.add.graphics();
        av.fillStyle(0x1a1a3e);
        av.fillCircle(38, y + H / 2, 22);
        av.lineStyle(1, 0x252540);
        av.strokeCircle(38, y + H / 2, 22);
        this.content.add(av);
        const classIcon = this.favoriteClassIcon(p);
        this.content.add(this.add.text(38, y + H / 2, classIcon, {
            fontSize: '18px', fontFamily: 'monospace',
        }).setOrigin(0.5));
        // Name + title
        const titleStr = p.active_title
            ? `[${p.active_title}] `
            : '';
        this.content.add(this.add.text(70, y + 14, `${titleStr}${p.name}`, {
            fontSize: '14px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0));
        const joinDate = new Date(p.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        const streakStr = p.current_streak > 0
            ? `  🔥 ${p.current_streak}-day streak`
            : '';
        this.content.add(this.add.text(70, y + 33, `Joined ${joinDate}${streakStr}`, {
            fontSize: '10px', color: '#666688', fontFamily: 'monospace',
        }).setOrigin(0, 0));
        this.content.add(this.add.text(70, y + 50, `${p.total_runs} runs  ·  ${formatTime(p.total_play_ms)} total play time`, {
            fontSize: '9px', color: '#444466', fontFamily: 'monospace',
        }).setOrigin(0, 0));
        return y + H + 8;
    }
    // ── Career stat cards ────────────────────────────────────────────────────────
    addCareerStats(p, y) {
        this.content.add(this.sectionLabel('Career', y));
        y += 18;
        const stats = [
            ['BEST FLOOR', `${p.highest_floor}`],
            ['TOTAL RUNS', `${p.total_runs}`],
            ['WIN RATE', p.total_runs > 0 ? `${((p.wins / p.total_runs) * 100).toFixed(1)}%` : '—'],
            ['AVG FLOOR', p.total_runs > 0 ? `${(Object.values(p.floors_by_class).reduce((a, b) => a + b, 0) / p.total_runs).toFixed(1)}` : '—'],
            ['TOTAL KILLS', formatNum(p.total_kills)],
            ['BOSSES', `${p.total_bosses_killed}`],
            ['DAMAGE', formatNum(p.total_damage_dealt)],
            ['HEALING', formatNum(p.total_healing_done)],
        ];
        const CARD_W = (GAME_WIDTH - 24) / 4;
        const CARD_H = 50;
        const ROWS = 2;
        const COLS = 4;
        for (let i = 0; i < stats.length; i++) {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const cx = 8 + col * (CARD_W + 2);
            const cy = y + row * (CARD_H + 4);
            const [label, value] = stats[i];
            const bg = this.add.graphics();
            bg.fillStyle(0x0c0c1e);
            bg.fillRoundedRect(cx, cy, CARD_W, CARD_H, 4);
            bg.lineStyle(1, 0x1a1a30);
            bg.strokeRoundedRect(cx, cy, CARD_W, CARD_H, 4);
            this.content.add(bg);
            this.content.add(this.add.text(cx + CARD_W / 2, cy + 10, label, {
                fontSize: '8px', color: '#444466', fontFamily: 'monospace',
            }).setOrigin(0.5, 0));
            this.content.add(this.add.text(cx + CARD_W / 2, cy + 24, value, {
                fontSize: '15px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0.5, 0));
        }
        return y + ROWS * (CARD_H + 4) + 10;
    }
    // ── Class stats ──────────────────────────────────────────────────────────────
    addClassStats(p, y) {
        this.content.add(this.sectionLabel('Build History', y));
        y += 18;
        // Favorite class
        const favClass = p.favorite_class ?? 'none';
        const favRuns = p.runs_by_class[favClass] ?? 0;
        // Best class by avg floor
        let bestClass = '—';
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
            ['Most played class', `${humaniseClass(favClass)}  (${favRuns} runs)`],
            ['Best class', `${humaniseClass(bestClass)}  (avg fl. ${bestAvg.toFixed(0)})`],
        ];
        rows.forEach(([label, value]) => {
            const bg = this.add.graphics();
            bg.fillStyle(0x0c0c1e);
            bg.fillRect(8, y, GAME_WIDTH - 16, 26);
            bg.lineStyle(1, 0x1a1a30);
            bg.strokeRect(8, y, GAME_WIDTH - 16, 26);
            this.content.add(bg);
            this.content.add(this.add.text(16, y + 13, label, {
                fontSize: '10px', color: '#555577', fontFamily: 'monospace',
            }).setOrigin(0, 0.5));
            this.content.add(this.add.text(GAME_WIDTH - 16, y + 13, value, {
                fontSize: '10px', color: '#e0e0e0', fontFamily: 'monospace',
            }).setOrigin(1, 0.5));
            y += 30;
        });
        return y + 6;
    }
    // ── Milestones ───────────────────────────────────────────────────────────────
    addMilestones(p, y) {
        this.content.add(this.sectionLabel('Titles', y));
        y += 18;
        const CHIP_H = 28;
        const CHIP_W = (GAME_WIDTH - 24) / 2;
        ALL_MILESTONES.forEach((m, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx = 8 + col * (CHIP_W + 4);
            const cy = y + row * (CHIP_H + 4);
            const earned = p.unlocked_titles.includes(m.id);
            const bg = this.add.graphics();
            bg.fillStyle(earned ? 0x0e1a0e : 0x0c0c1e);
            bg.fillRoundedRect(cx, cy, CHIP_W, CHIP_H, 4);
            bg.lineStyle(1, earned ? 0x1a3a1a : 0x1a1a30);
            bg.strokeRoundedRect(cx, cy, CHIP_W, CHIP_H, 4);
            this.content.add(bg);
            this.content.add(this.add.text(cx + 8, cy + CHIP_H / 2, earned ? '✓' : '○', {
                fontSize: '10px', color: earned ? '#2ecc71' : '#333355', fontFamily: 'monospace',
            }).setOrigin(0, 0.5));
            this.content.add(this.add.text(cx + 22, cy + CHIP_H / 2, m.title, {
                fontSize: '10px', color: earned ? '#e0e0e0' : '#444466',
                fontFamily: 'monospace', fontStyle: earned ? 'bold' : 'normal',
            }).setOrigin(0, 0.5));
        });
        const rows = Math.ceil(ALL_MILESTONES.length / 2);
        return y + rows * (CHIP_H + 4) + 10;
    }
    // ── Recent runs ──────────────────────────────────────────────────────────────
    addRecentRuns(runs, y) {
        this.content.add(this.sectionLabel('Recent Runs', y));
        y += 18;
        if (runs.length === 0) {
            this.content.add(this.add.text(GAME_WIDTH / 2, y + 10, 'No runs recorded yet.', {
                fontSize: '11px', color: '#333355', fontFamily: 'monospace',
            }).setOrigin(0.5, 0));
            return y + 30;
        }
        const ROW_H = 32;
        runs.forEach(run => {
            const dateStr = new Date(run.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
            const dur = formatTime(run.duration_ms);
            const bg = this.add.graphics();
            bg.fillStyle(0x0c0c1e);
            bg.fillRect(8, y, GAME_WIDTH - 16, ROW_H);
            bg.lineStyle(1, 0x1a1a30);
            bg.strokeRect(8, y, GAME_WIDTH - 16, ROW_H);
            this.content.add(bg);
            // Date
            this.content.add(this.add.text(16, y + ROW_H / 2, dateStr, {
                fontSize: '9px', color: '#444466', fontFamily: 'monospace',
            }).setOrigin(0, 0.5));
            // Class
            this.content.add(this.add.text(72, y + ROW_H / 2, humaniseClass(run.class_id), {
                fontSize: '10px', color: '#9999bb', fontFamily: 'monospace',
            }).setOrigin(0, 0.5));
            // Floor
            this.content.add(this.add.text(192, y + ROW_H / 2, `Fl. ${run.floor_reached}`, {
                fontSize: '11px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0, 0.5));
            // Build
            this.content.add(this.add.text(252, y + ROW_H / 2, run.build_archetype, {
                fontSize: '9px', color: '#666688', fontFamily: 'monospace',
                wordWrap: { width: 110 },
            }).setOrigin(0, 0.5));
            // Duration
            this.content.add(this.add.text(GAME_WIDTH - 16, y + ROW_H / 2, dur, {
                fontSize: '9px', color: '#333355', fontFamily: 'monospace',
            }).setOrigin(1, 0.5));
            y += ROW_H + 2;
        });
        return y + 6;
    }
    // ---------------------------------------------------------------------------
    // Scroll input
    // ---------------------------------------------------------------------------
    bindInput() {
        this.input.on('wheel', (_p, _go, _dx, deltaY) => {
            this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScroll);
            this.content.y = 52 - this.scrollY;
        });
    }
    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------
    sectionLabel(text, y) {
        return this.add.text(8, y, text.toUpperCase(), {
            fontSize: '9px', color: '#333355',
            fontFamily: 'monospace', letterSpacing: 1,
        }).setOrigin(0, 0);
    }
    favoriteClassIcon(p) {
        const icons = {
            necromancer: '💀', assassin: '🗡', paladin: '🛡',
            pyromancer: '🔥', plague_doctor: '🧪', berserker: '⚔',
            archmage: '⚡', warlock: '📜',
        };
        return icons[p.favorite_class ?? ''] ?? '?';
    }
}
// ---------------------------------------------------------------------------
// Module-level formatting helpers
// ---------------------------------------------------------------------------
function formatNum(n) {
    if (n >= 1000000)
        return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
}
function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0)
        return `${h}h ${m % 60}m`;
    if (m > 0)
        return `${m}m ${s % 60}s`;
    return `${s}s`;
}
function humaniseClass(id) {
    if (!id || id === '—' || id === 'none' || id === 'unknown')
        return '—';
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
}
