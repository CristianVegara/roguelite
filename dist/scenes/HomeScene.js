import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';
import { metaService, UPGRADE_INFO, META_MAX_LEVEL, } from '../meta/MetaService';
import { ServiceLocator } from '../services/ServiceLocator';
import { MODES_REGISTRY } from '../modes/GameModeConfig';
import { ModeRunner } from '../modes/ModeRunner';
// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const HEADER_H = 52; // persistent header
const TABNAV_H = 36; // tab navigation bar
const CONTENT_Y = HEADER_H + TABNAV_H; // 88
const _CONTENT_H = GAME_HEIGHT - CONTENT_Y;
void _CONTENT_H; // reserved for future scroll bounds
const TABS = [
    { id: 'play', label: 'PLAY' },
    { id: 'ranks', label: 'RANKS' },
    { id: 'profile', label: 'PROFILE' },
    { id: 'settings', label: 'SETTINGS' },
];
// ---------------------------------------------------------------------------
// HomeScene
// ---------------------------------------------------------------------------
export class HomeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HomeScene' });
        this.tabContainers = new Map();
        this.tabNavBtns = [];
        this.tabNavUnderlines = [];
        // Play tab — upgrade shop refs
        this.upgradeRows = [];
        this.upgradeDrawerOpen = false;
    }
    // ---------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------
    create() {
        this.tabContainers.clear();
        this.tabNavBtns = [];
        this.tabNavUnderlines = [];
        this.upgradeRows = [];
        this.upgradeDrawerOpen = false;
        this.drawBackground();
        this.buildHeader();
        this.buildTabNav();
        // Build all tab content (hidden until activated)
        this.buildPlayTab();
        this.buildRanksTab();
        this.buildProfileTab();
        this.buildSettingsTab();
        this.showTab('play');
        this.cameras.main.fadeIn(300, 0, 0, 0);
    }
    // ---------------------------------------------------------------------------
    // Background
    // ---------------------------------------------------------------------------
    drawBackground() {
        const g = this.add.graphics();
        g.fillStyle(0x080812);
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        // Header surface
        g.fillStyle(0x0c0c1e);
        g.fillRect(0, 0, GAME_WIDTH, HEADER_H);
        g.lineStyle(1, 0x1a1a30);
        g.lineBetween(0, HEADER_H, GAME_WIDTH, HEADER_H);
        // Tab nav surface
        g.fillStyle(0x0a0a1a);
        g.fillRect(0, HEADER_H, GAME_WIDTH, TABNAV_H);
        g.lineStyle(1, 0x141428);
        g.lineBetween(0, CONTENT_Y, GAME_WIDTH, CONTENT_Y);
    }
    // ---------------------------------------------------------------------------
    // Persistent header
    // ---------------------------------------------------------------------------
    buildHeader() {
        // Game title
        this.add.text(14, HEADER_H / 2, 'THE SPIRE', {
            fontSize: '16px', color: '#c0c0d8',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        // Player name + streak (clickable → profile tab)
        const profile = ServiceLocator.profile.getProfile();
        const name = profile?.name ?? 'Player';
        const streak = (profile?.current_streak ?? 0) > 1
            ? `  🔥${profile.current_streak}`
            : '';
        this.add.text(GAME_WIDTH / 2, HEADER_H / 2, `${name}${streak}`, {
            fontSize: '11px', color: '#9999bb', fontFamily: 'monospace',
        }).setOrigin(0.5)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerover', function () { this.setColor('#e0e0e0'); })
            .on('pointerout', function () { this.setColor('#9999bb'); })
            .on('pointerdown', () => this.showTab('profile'));
        // Currency chip — top-right
        this.headerCurrencyText = this.add.text(GAME_WIDTH - 12, HEADER_H / 2, `★ ${metaService.currency}`, {
            fontSize: '13px', color: '#ffd700',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(1, 0.5);
    }
    // ---------------------------------------------------------------------------
    // Tab navigation
    // ---------------------------------------------------------------------------
    buildTabNav() {
        const tabW = GAME_WIDTH / TABS.length;
        TABS.forEach(({ id, label }, i) => {
            const cx = tabW * i + tabW / 2;
            const cy = HEADER_H + TABNAV_H / 2;
            const btn = this.add.text(cx, cy, label, {
                fontSize: '9px', color: '#444466',
                fontFamily: 'monospace', letterSpacing: 1,
            }).setOrigin(0.5)
                .setInteractive({ cursor: 'pointer' })
                .on('pointerdown', () => this.showTab(id));
            const underline = this.add.graphics();
            this.tabNavBtns.push(btn);
            this.tabNavUnderlines.push(underline);
        });
    }
    showTab(id) {
        // Content containers
        this.tabContainers.forEach((container, key) => {
            container.setVisible(key === id);
        });
        // Nav button colours + underlines
        TABS.forEach(({ id: tabId }, i) => {
            const active = tabId === id;
            this.tabNavBtns[i].setColor(active ? '#e0e0e0' : '#444466');
            const g = this.tabNavUnderlines[i];
            const tabW = GAME_WIDTH / TABS.length;
            const x = tabW * i + 8;
            g.clear();
            if (active) {
                g.fillStyle(0x4fc3f7);
                g.fillRect(x, HEADER_H + TABNAV_H - 2, tabW - 16, 2);
            }
        });
    }
    // ---------------------------------------------------------------------------
    // PLAY TAB
    // ---------------------------------------------------------------------------
    buildPlayTab() {
        const c = this.add.container(0, CONTENT_Y);
        this.tabContainers.set('play', c);
        let y = 10;
        // ── Mode cards ────────────────────────────────────────────────────────
        c.add(this.makeLabel(8, y, 'GAME MODES'));
        y += 18;
        const CARD_W = (GAME_WIDTH - 20) / 2; // 230
        const CARD_H = 100;
        const GAP = 6;
        MODES_REGISTRY.forEach((mode, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx = 4 + col * (CARD_W + GAP);
            const cy = y + row * (CARD_H + GAP);
            this.buildModeCard(c, mode, cx, cy, CARD_W, CARD_H);
        });
        const modeRows = Math.ceil(MODES_REGISTRY.length / 2);
        y += modeRows * (CARD_H + GAP) + 12;
        // ── Permanent upgrades drawer ─────────────────────────────────────────
        c.add(this.makeLabel(8, y, 'PERMANENT UPGRADES'));
        // Toggle button
        this.upgradeDrawerBtnLabel = this.add.text(GAME_WIDTH - 12, y + 3, '▸ expand', {
            fontSize: '9px', color: '#444466', fontFamily: 'monospace',
        }).setOrigin(1, 0)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.toggleUpgradeDrawer());
        c.add(this.upgradeDrawerBtnLabel);
        y += 18;
        // Drawer container (hidden by default)
        this.upgradeDrawerContainer = this.add.container(0, y);
        this.upgradeDrawerContainer.setVisible(false);
        c.add(this.upgradeDrawerContainer);
        this.buildUpgradeDrawer();
        // Last run preview (below drawer, at a fixed offset)
        const lastRun = metaService.lastRun;
        if (lastRun) {
            const previewY = y + (this.upgradeDrawerOpen ? UPGRADE_INFO.length * 52 + 12 : 0);
            const prev = this.buildLastRunPreview(lastRun.floor, previewY);
            c.add(prev);
        }
    }
    buildModeCard(parent, mode, x, y, w, h) {
        const bg = this.add.graphics();
        const accent = this.add.graphics();
        const drawDefault = () => {
            bg.clear();
            bg.fillStyle(0x0c0c1e);
            bg.fillRoundedRect(x, y, w, h, 6);
            bg.lineStyle(1, 0x1a1a30);
            bg.strokeRoundedRect(x, y, w, h, 6);
            accent.clear();
            accent.fillStyle(mode.color, 0.7);
            accent.fillRect(x, y, w, 3);
        };
        const drawHover = () => {
            bg.clear();
            bg.fillStyle(0x10172e);
            bg.fillRoundedRect(x, y, w, h, 6);
            bg.lineStyle(1, mode.color, 0.6);
            bg.strokeRoundedRect(x, y, w, h, 6);
            accent.clear();
            accent.fillStyle(mode.color);
            accent.fillRect(x, y, w, 4);
        };
        drawDefault();
        // Icon + name
        const iconT = this.add.text(x + 10, y + 14, mode.icon, {
            fontSize: '16px', fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        const nameT = this.add.text(x + 30, y + 10, mode.name.toUpperCase(), {
            fontSize: '10px', color: intToHex(mode.color),
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0);
        // Difficulty + tagline
        const diffColor = {
            normal: '#2ecc71', hard: '#f39c12', extreme: '#e74c3c',
        };
        const diffT = this.add.text(x + 30, y + 25, mode.difficulty.toUpperCase(), {
            fontSize: '8px', color: diffColor[mode.difficulty] ?? '#9999bb',
            fontFamily: 'monospace',
        }).setOrigin(0, 0);
        // Personal best — Boss Rush shows bosses killed, all others show floor reached
        const bestRun = this.getBestRunForMode(mode.id);
        const bestStr = bestRun
            ? mode.id === 'boss_rush'
                ? `Best: ${bestRun.bosses_killed} bosses`
                : `Best: Fl. ${bestRun.floor_reached}`
            : 'No runs yet';
        const bestT = this.add.text(x + 10, y + 44, bestStr, {
            fontSize: '9px', color: '#555577', fontFamily: 'monospace',
        }).setOrigin(0, 0);
        // PLAY button
        const btnY = y + h - 30;
        const btnW = w - 20;
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x0a0a18);
        btnBg.fillRoundedRect(x + 10, btnY, btnW, 22, 4);
        btnBg.lineStyle(1, 0x252540);
        btnBg.strokeRoundedRect(x + 10, btnY, btnW, 22, 4);
        const btnT = this.add.text(x + 10 + btnW / 2, btnY + 11, 'PLAY', {
            fontSize: '10px', color: '#666688',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        // Hover zone over entire card
        const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
            .setInteractive({ cursor: 'pointer' });
        zone.on('pointerover', () => {
            drawHover();
            btnBg.clear();
            btnBg.fillStyle(mode.color, 0.15);
            btnBg.fillRoundedRect(x + 10, btnY, btnW, 22, 4);
            btnBg.lineStyle(1, mode.color, 0.5);
            btnBg.strokeRoundedRect(x + 10, btnY, btnW, 22, 4);
            btnT.setColor(intToHex(mode.color));
        });
        zone.on('pointerout', () => {
            drawDefault();
            btnBg.clear();
            btnBg.fillStyle(0x0a0a18);
            btnBg.fillRoundedRect(x + 10, btnY, btnW, 22, 4);
            btnBg.lineStyle(1, 0x252540);
            btnBg.strokeRoundedRect(x + 10, btnY, btnW, 22, 4);
            btnT.setColor('#666688');
        });
        zone.on('pointerdown', () => {
            this.tweens.add({
                targets: zone, alpha: 0.6, duration: 60, yoyo: true,
                onComplete: () => ModeRunner.start(this, mode.id),
            });
        });
        parent.add([bg, accent, iconT, nameT, diffT, bestT, btnBg, btnT, zone]);
    }
    // ── Permanent upgrade drawer ─────────────────────────────────────────────
    buildUpgradeDrawer() {
        this.upgradeRows = UPGRADE_INFO.map((info, i) => {
            return this.buildUpgradeRow(info.key, info.label, info.color, i);
        });
    }
    buildUpgradeRow(key, label, color, index) {
        const ROW_H = 48;
        const y = index * (ROW_H + 4);
        const rowBg = this.add.graphics();
        rowBg.fillStyle(0x0c0c1e);
        rowBg.fillRoundedRect(4, y, GAME_WIDTH - 8, ROW_H, 4);
        rowBg.lineStyle(1, 0x1a1a30);
        rowBg.strokeRoundedRect(4, y, GAME_WIDTH - 8, ROW_H, 4);
        const labelT = this.add.text(14, y + 10, label, {
            fontSize: '11px', color: intToHex(color),
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0);
        // Dot level bar
        const dotsG = this.add.graphics();
        const dotY = y + 30;
        const drawDots = (level) => {
            dotsG.clear();
            for (let d = 0; d < META_MAX_LEVEL; d++) {
                dotsG.fillStyle(d < level ? color : 0x1a1a2e);
                dotsG.fillCircle(14 + d * 18, dotY, 5);
            }
        };
        const levelT = this.add.text(14 + META_MAX_LEVEL * 18 + 8, dotY, '', {
            fontSize: '9px', color: '#333355', fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        // BUY button
        const btnX = GAME_WIDTH - 100;
        const btnBg = this.add.graphics();
        const btnT = this.add.text(btnX + 42, y + ROW_H / 2, 'BUY', {
            fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        const costT = this.add.text(btnX + 42, y + ROW_H / 2 + 14, '', {
            fontSize: '9px', fontFamily: 'monospace',
        }).setOrigin(0.5);
        const zone = this.add.zone(btnX + 42, y + ROW_H / 2, 84, ROW_H - 8)
            .setInteractive({ cursor: 'pointer' });
        zone.on('pointerdown', () => {
            if (metaService.purchase(key)) {
                this.refreshUpgradeRow({ key, drawDots, levelT, btnBg, btnT, costT, btnX, rowY: y, rowH: ROW_H });
                this.headerCurrencyText.setText(`★ ${metaService.currency}`);
            }
        });
        const refs = { key, drawDots, levelT, btnBg, btnT, costT, btnX, rowY: y, rowH: ROW_H };
        this.upgradeDrawerContainer.add([rowBg, labelT, dotsG, levelT, btnBg, btnT, costT, zone]);
        this.refreshUpgradeRow(refs);
        return refs;
    }
    refreshUpgradeRow(row) {
        const { key, drawDots, levelT, btnBg, btnT, costT, btnX, rowY, rowH } = row;
        const level = metaService.upgrades[key];
        const isMax = metaService.isMaxLevel(key);
        const canAffd = metaService.canAfford(key);
        const cost = metaService.costForUpgrade(key);
        drawDots(level);
        levelT.setText(`${level}/${META_MAX_LEVEL}`);
        const fill = isMax ? 0x0c0c1a : canAffd ? 0x0d2a18 : 0x0c0c1a;
        const stroke = isMax ? 0x1e1e30 : canAffd ? 0x27ae60 : 0x1e1e30;
        btnBg.clear();
        btnBg.fillStyle(fill);
        btnBg.fillRoundedRect(btnX, rowY + 8, 84, rowH - 16, 4);
        btnBg.lineStyle(1, stroke);
        btnBg.strokeRoundedRect(btnX, rowY + 8, 84, rowH - 16, 4);
        btnT.setText(isMax ? 'MAX' : 'BUY');
        btnT.setColor(isMax ? '#333355' : canAffd ? '#ffffff' : '#444466');
        costT.setText(isMax ? '' : `${cost} ★`);
        costT.setColor(canAffd ? '#ffd700' : '#444466');
    }
    toggleUpgradeDrawer() {
        this.upgradeDrawerOpen = !this.upgradeDrawerOpen;
        this.upgradeDrawerContainer.setVisible(this.upgradeDrawerOpen);
        this.upgradeDrawerBtnLabel.setText(this.upgradeDrawerOpen ? '▾ collapse' : '▸ expand');
        // Refresh rows when opening
        if (this.upgradeDrawerOpen) {
            this.upgradeRows.forEach(r => this.refreshUpgradeRow(r));
        }
    }
    // ── Last run preview ──────────────────────────────────────────────────────
    buildLastRunPreview(floor, y) {
        const c = this.add.container(0, y);
        const bg = this.add.graphics();
        bg.fillStyle(0x0c0c1e);
        bg.fillRoundedRect(4, 0, GAME_WIDTH - 8, 38, 4);
        bg.lineStyle(1, 0x1a1a30);
        bg.strokeRoundedRect(4, 0, GAME_WIDTH - 8, 38, 4);
        c.add(bg);
        c.add(this.add.text(12, 8, 'LAST RUN', { fontSize: '8px', color: '#333355', fontFamily: 'monospace' }));
        c.add(this.add.text(12, 20, `Floor ${floor}`, { fontSize: '12px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold' }));
        const lastRun = metaService.lastRun;
        if (lastRun) {
            const detail = `${lastRun.kills} kills  ·  ${lastRun.bossesDefeated} bosses`;
            c.add(this.add.text(90, 22, detail, { fontSize: '9px', color: '#555577', fontFamily: 'monospace' }));
        }
        return c;
    }
    // ---------------------------------------------------------------------------
    // RANKS TAB — personal bests
    // ---------------------------------------------------------------------------
    buildRanksTab() {
        const c = this.add.container(0, CONTENT_Y);
        c.setVisible(false);
        this.tabContainers.set('ranks', c);
        let y = 12;
        c.add(this.makeLabel(8, y, 'PERSONAL BESTS'));
        y += 20;
        // Header row
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x0c0c1e);
        headerBg.fillRect(4, y, GAME_WIDTH - 8, 24);
        c.add(headerBg);
        c.add(this.makeRowText(8, y + 12, 'MODE', '#444466'));
        c.add(this.makeRowText(140, y + 12, 'STAT', '#444466'));
        c.add(this.makeRowText(200, y + 12, 'BUILD', '#444466'));
        c.add(this.makeRowText(340, y + 12, 'DATE', '#444466'));
        y += 28;
        const runs = ServiceLocator.history.getRecentRuns(50);
        const bestByMode = this.getBestRunsPerMode(runs);
        if (bestByMode.length === 0) {
            c.add(this.add.text(GAME_WIDTH / 2, y + 30, 'Complete a run to see your records.', {
                fontSize: '11px', color: '#333355', fontFamily: 'monospace',
            }).setOrigin(0.5, 0));
            return;
        }
        bestByMode.forEach(({ mode, run }, i) => {
            const rowY = y + i * 36;
            const rowBg = this.add.graphics();
            rowBg.fillStyle(0x0c0c1e);
            rowBg.fillRoundedRect(4, rowY, GAME_WIDTH - 8, 32, 4);
            rowBg.lineStyle(1, 0x1a1a30);
            rowBg.strokeRoundedRect(4, rowY, GAME_WIDTH - 8, 32, 4);
            // Left mode accent
            rowBg.fillStyle(mode.color, 0.5);
            rowBg.fillRect(4, rowY, 3, 32);
            const dateStr = new Date(run.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
            // Mode-aware stat: Boss Rush shows bosses_killed with "B" unit; others show floor_reached
            const statValue = mode.id === 'boss_rush'
                ? `${run.bosses_killed ?? 0} BO`
                : `${run.floor_reached} FL`;
            c.add(rowBg);
            c.add(this.makeRowText(14, rowY + 16, `${mode.icon}  ${mode.name}`, intToHex(mode.color)));
            c.add(this.makeRowText(140, rowY + 16, statValue, '#e0e0e0', true));
            c.add(this.makeRowText(200, rowY + 16, run.build_archetype, '#9999bb'));
            c.add(this.makeRowText(340, rowY + 16, dateStr, '#444466'));
        });
    }
    // ---------------------------------------------------------------------------
    // PROFILE TAB — mini card + full profile link
    // ---------------------------------------------------------------------------
    buildProfileTab() {
        const c = this.add.container(0, CONTENT_Y);
        c.setVisible(false);
        this.tabContainers.set('profile', c);
        const profile = ServiceLocator.profile.getProfile();
        let y = 12;
        if (!profile) {
            c.add(this.add.text(GAME_WIDTH / 2, 80, 'No profile found.', {
                fontSize: '13px', color: '#333355', fontFamily: 'monospace',
            }).setOrigin(0.5));
            return;
        }
        // Name + streak card
        const card = this.add.graphics();
        card.fillStyle(0x0c0c1e);
        card.fillRoundedRect(4, y, GAME_WIDTH - 8, 72, 6);
        card.lineStyle(1, 0x252540);
        card.strokeRoundedRect(4, y, GAME_WIDTH - 8, 72, 6);
        c.add(card);
        const streak = profile.current_streak > 1 ? `  🔥 ${profile.current_streak}-day streak` : '';
        c.add(this.add.text(16, y + 16, profile.name, {
            fontSize: '18px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold',
        }));
        c.add(this.add.text(16, y + 40, `${profile.total_runs} runs  ·  Best fl. ${profile.highest_floor}${streak}`, {
            fontSize: '10px', color: '#666688', fontFamily: 'monospace',
        }));
        if (profile.active_title) {
            c.add(this.add.text(GAME_WIDTH - 14, y + 16, `[${profile.active_title}]`, {
                fontSize: '9px', color: '#9b59b6', fontFamily: 'monospace',
            }).setOrigin(1, 0));
        }
        y += 82;
        // Quick stats grid
        const quickStats = [
            ['WINS', `${profile.wins}`],
            ['KILLS', `${profile.total_kills.toLocaleString()}`],
            ['BOSSES', `${profile.total_bosses_killed}`],
            ['STREAK', `${profile.best_streak} days`],
        ];
        const QW = (GAME_WIDTH - 20) / 4;
        quickStats.forEach(([label, val], i) => {
            const qx = 4 + i * (QW + 4);
            const qBg = this.add.graphics();
            qBg.fillStyle(0x0c0c1e);
            qBg.fillRoundedRect(qx, y, QW, 48, 4);
            qBg.lineStyle(1, 0x1a1a30);
            qBg.strokeRoundedRect(qx, y, QW, 48, 4);
            c.add(qBg);
            c.add(this.add.text(qx + QW / 2, y + 12, label, {
                fontSize: '8px', color: '#444466', fontFamily: 'monospace',
            }).setOrigin(0.5, 0));
            c.add(this.add.text(qx + QW / 2, y + 25, val, {
                fontSize: '13px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0.5, 0));
        });
        y += 58;
        // Milestones strip
        c.add(this.makeLabel(8, y, 'TITLES EARNED'));
        y += 18;
        const earned = profile.unlocked_titles;
        if (earned.length === 0) {
            c.add(this.add.text(8, y, 'Complete a run to earn your first title.', {
                fontSize: '10px', color: '#333355', fontFamily: 'monospace',
            }));
        }
        else {
            let chipX = 8;
            earned.slice(0, 6).forEach(id => {
                const chipW = id.length * 6 + 20;
                const chipBg = this.add.graphics();
                chipBg.fillStyle(0x0e1a0e);
                chipBg.fillRoundedRect(chipX, y, chipW, 22, 3);
                chipBg.lineStyle(1, 0x2ecc71, 0.4);
                chipBg.strokeRoundedRect(chipX, y, chipW, 22, 3);
                c.add(chipBg);
                c.add(this.add.text(chipX + chipW / 2, y + 11, id, {
                    fontSize: '9px', color: '#2ecc71', fontFamily: 'monospace',
                }).setOrigin(0.5));
                chipX += chipW + 6;
            });
        }
        y += 32;
        // Full profile button
        const fbW = GAME_WIDTH - 16;
        const fbBg = this.add.graphics();
        fbBg.fillStyle(0x0c0c1e);
        fbBg.fillRoundedRect(8, y, fbW, 36, 6);
        fbBg.lineStyle(1, 0x9b59b6, 0.5);
        fbBg.strokeRoundedRect(8, y, fbW, 36, 6);
        c.add(fbBg);
        c.add(this.add.text(GAME_WIDTH / 2, y + 18, 'FULL PROFILE & STATISTICS  →', {
            fontSize: '11px', color: '#9b59b6', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.scene.start('StatsScene')));
    }
    // ---------------------------------------------------------------------------
    // SETTINGS TAB
    // ---------------------------------------------------------------------------
    buildSettingsTab() {
        const c = this.add.container(0, CONTENT_Y);
        c.setVisible(false);
        this.tabContainers.set('settings', c);
        let y = 12;
        c.add(this.makeLabel(8, y, 'SETTINGS'));
        y += 20;
        // Rename
        const renameBg = this.add.graphics();
        renameBg.fillStyle(0x0c0c1e);
        renameBg.fillRoundedRect(4, y, GAME_WIDTH - 8, 48, 5);
        renameBg.lineStyle(1, 0x1a1a30);
        renameBg.strokeRoundedRect(4, y, GAME_WIDTH - 8, 48, 5);
        c.add(renameBg);
        c.add(this.add.text(14, y + 14, 'Change Name', { fontSize: '12px', color: '#e0e0e0', fontFamily: 'monospace' }));
        c.add(this.add.text(14, y + 30, 'Opens name entry to change your display name', { fontSize: '9px', color: '#444466', fontFamily: 'monospace' }));
        c.add(this.add.text(GAME_WIDTH - 14, y + 24, 'RENAME →', {
            fontSize: '10px', color: '#4fc3f7', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(1, 0.5)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => {
            ServiceLocator.profile.reset();
            this.scene.start('NameEntryScene');
        }));
        y += 58;
        // Reset save
        const resetBg = this.add.graphics();
        resetBg.fillStyle(0x0c0c1e);
        resetBg.fillRoundedRect(4, y, GAME_WIDTH - 8, 48, 5);
        resetBg.lineStyle(1, 0x1a1a30);
        resetBg.strokeRoundedRect(4, y, GAME_WIDTH - 8, 48, 5);
        c.add(resetBg);
        c.add(this.add.text(14, y + 14, 'Reset All Data', { fontSize: '12px', color: '#e74c3c', fontFamily: 'monospace' }));
        c.add(this.add.text(14, y + 30, 'Clears all progress, currency and statistics', { fontSize: '9px', color: '#444466', fontFamily: 'monospace' }));
        c.add(this.add.text(GAME_WIDTH - 14, y + 24, 'RESET →', {
            fontSize: '10px', color: '#e74c3c', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(1, 0.5)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.confirmReset()));
        y += 58;
        // Keybinds
        c.add(this.makeLabel(8, y, 'CONTROLS'));
        y += 18;
        const binds = [
            ['B', 'Build overview (during run)'],
            ['Tab', 'Stats panel (during run)'],
            ['R', 'Return to hub (after death)'],
            ['ESC / B', 'Back (menus)'],
        ];
        binds.forEach(([key, desc]) => {
            const bindBg = this.add.graphics();
            bindBg.fillStyle(0x0c0c1e);
            bindBg.fillRect(4, y, GAME_WIDTH - 8, 26);
            bindBg.lineStyle(1, 0x141428);
            bindBg.strokeRect(4, y, GAME_WIDTH - 8, 26);
            c.add(bindBg);
            c.add(this.add.text(14, y + 13, `[${key}]`, { fontSize: '9px', color: '#4fc3f7', fontFamily: 'monospace' }).setOrigin(0, 0.5));
            c.add(this.add.text(80, y + 13, desc, { fontSize: '9px', color: '#666688', fontFamily: 'monospace' }).setOrigin(0, 0.5));
            y += 30;
        });
    }
    confirmReset() {
        // Simple double-click confirm (second click within 3s resets)
        if (this['_resetPending']) {
            metaService.resetSave();
            ServiceLocator.profile.reset();
            ServiceLocator.history.clear();
            this.scene.start('NameEntryScene');
        }
        else {
            this['_resetPending'] = true;
            this.time.delayedCall(3000, () => {
                this['_resetPending'] = false;
            });
        }
    }
    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------
    getBestRunForMode(modeId) {
        const runs = ServiceLocator.history.getRecentRuns(50).filter(r => r.mode_id === modeId);
        if (modeId === 'boss_rush') {
            return runs.sort((a, b) => (b.bosses_killed ?? 0) - (a.bosses_killed ?? 0))[0] ?? null;
        }
        return runs.sort((a, b) => b.floor_reached - a.floor_reached)[0] ?? null;
    }
    getBestRunsPerMode(runs) {
        const best = new Map();
        runs.forEach(r => {
            const prev = best.get(r.mode_id);
            const isBetter = r.mode_id === 'boss_rush'
                ? !prev || (r.bosses_killed ?? 0) > (prev.bosses_killed ?? 0)
                : !prev || r.floor_reached > prev.floor_reached;
            if (isBetter)
                best.set(r.mode_id, r);
        });
        return MODES_REGISTRY
            .filter(m => best.has(m.id))
            .map(m => ({ mode: m, run: best.get(m.id) }));
    }
    makeLabel(x, y, text) {
        return this.add.text(x, y, text, {
            fontSize: '9px', color: '#444466', // slightly brighter: was #333355
            fontFamily: 'monospace', letterSpacing: 1,
        });
    }
    makeRowText(x, y, text, color, bold = false) {
        return this.add.text(x, y, text, {
            fontSize: '10px', color,
            fontFamily: 'monospace',
            fontStyle: bold ? 'bold' : 'normal',
        }).setOrigin(0, 0.5);
    }
}
// ---------------------------------------------------------------------------
// Module helpers
// ---------------------------------------------------------------------------
function intToHex(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}
