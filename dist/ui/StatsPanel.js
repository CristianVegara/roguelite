import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';
/**
 * StatsPanel — real-time build statistics overlay.
 *
 * Toggle with Tab key.  Shows a compact summary by default; expanded view
 * shows historical combat stats (total damage, healing, highest hit).
 *
 * BUG #5 fixes:
 *   - Draggable with position clamped to viewport at all times.
 *   - Visible × close button.
 *   - Double-click header resets to default position.
 *   - Default position calculated to keep panel fully on-screen.
 */
export class StatsPanel {
    constructor(scene, stats, engine) {
        this.lines = [];
        this.expanded = false;
        this.visible = false;
        this.PANEL_W = 148;
        this.DEFAULT_X = GAME_WIDTH - 148 - 4; // 328
        this.DEFAULT_Y = 50;
        this.LINE_H = 14;
        // Drag state
        this.dragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.panelX = 0;
        this.panelY = 0;
        this.scene = scene;
        this.stats = stats;
        this.engine = engine;
        this.panelX = this.DEFAULT_X;
        this.panelY = this.DEFAULT_Y;
        this.build();
        this.bindKey();
    }
    // ---------------------------------------------------------------------------
    // Build
    // ---------------------------------------------------------------------------
    build() {
        this.container = this.scene.add.container(this.panelX, this.panelY);
        this.container.setVisible(false);
        this.container.setDepth(100);
        // Background (resized dynamically in update)
        this.bgGfx = this.scene.add.graphics();
        this.bgGfx.fillStyle(0x000000, 0.80);
        this.bgGfx.fillRoundedRect(0, 0, this.PANEL_W, 200, 6);
        this.bgGfx.lineStyle(1, 0x2a2a4a);
        this.bgGfx.strokeRoundedRect(0, 0, this.PANEL_W, 200, 6);
        this.container.add(this.bgGfx);
        // Header text + drag handle
        const header = this.scene.add.text(this.PANEL_W / 2, 8, 'BUILD STATS', {
            fontSize: '10px', color: '#ffd700',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5, 0);
        this.container.add(header);
        // Close button (×)
        const closeBtn = this.scene.add.text(this.PANEL_W - 6, 6, '×', {
            fontSize: '14px', color: '#555577', fontFamily: 'monospace',
        }).setOrigin(1, 0)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerover', function () { this.setColor('#e0e0e0'); })
            .on('pointerout', function () { this.setColor('#555577'); })
            .on('pointerdown', () => { this.visible = false; this.container.setVisible(false); });
        this.container.add(closeBtn);
        // Hint
        const hint = this.scene.add.text(this.PANEL_W / 2, 20, '[Tab] toggle  [E] expand', {
            fontSize: '7px', color: '#333355', fontFamily: 'monospace',
        }).setOrigin(0.5, 0);
        this.container.add(hint);
        // Drag zone over the header row
        const dragZone = this.scene.add.zone(0, 0, this.PANEL_W, 28)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'grab', draggable: false });
        this.container.add(dragZone);
        dragZone.on('pointerdown', (ptr) => {
            this.dragging = true;
            this.dragOffsetX = ptr.x - this.panelX;
            this.dragOffsetY = ptr.y - this.panelY;
        });
        // Double-click header → reset position
        dragZone.on('pointerup', () => { this.dragging = false; });
        let lastClick = 0;
        dragZone.on('pointerdown', () => {
            const now = Date.now();
            if (now - lastClick < 350) {
                this.resetPosition();
            }
            lastClick = now;
        });
        this.scene.input.on('pointermove', (ptr) => {
            if (!this.dragging || !ptr.isDown)
                return;
            this.moveTo(ptr.x - this.dragOffsetX, ptr.y - this.dragOffsetY);
        });
        this.scene.input.on('pointerup', () => { this.dragging = false; });
        // Stat lines (18 = 12 compact + 5 historical + 1 buffer)
        for (let i = 0; i < 18; i++) {
            const t = this.scene.add.text(6, 32 + i * this.LINE_H, '', {
                fontSize: '9px', color: '#9999bb', fontFamily: 'monospace',
            }).setOrigin(0, 0);
            this.lines.push(t);
            this.container.add(t);
        }
    }
    bindKey() {
        this.scene.input.keyboard?.on('keydown-TAB', () => {
            this.visible = !this.visible;
            this.container.setVisible(this.visible);
        });
        this.scene.input.keyboard?.on('keydown-E', () => {
            if (!this.visible)
                return;
            this.expanded = !this.expanded;
        });
    }
    // ---------------------------------------------------------------------------
    // Position helpers
    // ---------------------------------------------------------------------------
    moveTo(x, y) {
        // Clamp so panel always stays fully on-screen
        const clampedX = Phaser.Math.Clamp(x, 0, GAME_WIDTH - this.PANEL_W);
        const clampedY = Phaser.Math.Clamp(y, 0, GAME_HEIGHT - 40);
        this.panelX = clampedX;
        this.panelY = clampedY;
        this.container.setPosition(clampedX, clampedY);
    }
    resetPosition() {
        this.moveTo(this.DEFAULT_X, this.DEFAULT_Y);
    }
    // ---------------------------------------------------------------------------
    // Update (called each frame by GameScene while visible)
    // ---------------------------------------------------------------------------
    update() {
        if (!this.visible)
            return;
        const s = this.stats;
        const e = this.engine;
        // Derived stats
        const dps = this.calcDPS(s);
        const poisonDPS = this.calcPoisonDPS(s);
        const burnDPS = this.calcBurnDPS(s);
        const effectiveHP = Math.floor(s.hp * (1 + (s.armor ?? 0) / 100));
        const critPct = Math.round((s.critChance ?? 0) * 100);
        const critMult = ((s.critMultiplier ?? 2.0)).toFixed(1);
        const ls = Math.round((s.lifesteal ?? 0) * 100);
        const reflect = Math.round((s.reflectPercent ?? 0) * 100);
        const shield = s.shield ?? 0;
        const compact = [
            ['ATK SPD', `${s.attackSpeed.toFixed(2)}/s`],
            ['DAMAGE', `${s.damage}`],
            ['DPS', `~${dps}`],
            ['CRIT', `${critPct}%  ×${critMult}`],
            ['ARMOR', `${Math.floor(e.effectiveArmor())}`],
            ['EFF HP', `${effectiveHP}`],
            ['LIFESTEAL', ls > 0 ? `${ls}%` : '—'],
            ['REFLECT', reflect > 0 ? `${reflect}%` : '—'],
            ['PSN DPS', poisonDPS > 0 ? `~${poisonDPS}` : '—'],
            ['BURN DPS', burnDPS > 0 ? `~${burnDPS}` : '—'],
            ['SHIELD', shield > 0 ? `${shield}` : '—'],
            ['GOLD', `${e.gold}`],
        ];
        const historical = [
            ['TTL DMG', `${e.totalDamageDealt}`],
            ['TTL HEAL', `${e.totalHealingDone}`],
            ['TOP HIT', `${e.highestDamageHit}`],
            ['BOSSES', `${e.bossesKilled}`],
            ['UPGRADES', `${e.upgradeCount()}`],
        ];
        const rows = this.expanded ? [...compact, ...historical] : compact;
        // Resize background height dynamically
        const bgH = 32 + rows.length * this.LINE_H + 8;
        this.bgGfx.clear();
        this.bgGfx.fillStyle(0x000000, 0.80);
        this.bgGfx.fillRoundedRect(0, 0, this.PANEL_W, bgH, 6);
        this.bgGfx.lineStyle(1, 0x2a2a4a);
        this.bgGfx.strokeRoundedRect(0, 0, this.PANEL_W, bgH, 6);
        // Clamp Y so dynamic resize never pushes panel off bottom
        const maxY = GAME_HEIGHT - bgH - 4;
        if (this.panelY > maxY) {
            this.moveTo(this.panelX, maxY);
        }
        rows.forEach(([label, value], i) => {
            if (i >= this.lines.length)
                return;
            const color = this.colorForLabel(label);
            this.lines[i]
                .setText(`${label.padEnd(9)} ${value}`)
                .setColor(color)
                .setVisible(true);
        });
        // Hide unused lines
        for (let i = rows.length; i < this.lines.length; i++) { // hide unused
            this.lines[i].setVisible(false);
        }
    }
    // ---------------------------------------------------------------------------
    // Derived calculations
    // ---------------------------------------------------------------------------
    calcDPS(s) {
        const crit = s.critChance ?? 0;
        const mult = s.critMultiplier ?? 2.0;
        const avgHit = s.damage * (1 - crit + crit * mult);
        return Math.floor(avgHit * s.attackSpeed);
    }
    calcPoisonDPS(s) {
        const chance = s.poisonChance ?? 0;
        if (chance === 0)
            return 0;
        const stacks = s.poisonStacks ?? 1;
        const dmgPerStk = s.poisonDamage ?? 2;
        const tickRate = s.poisonTickRate ?? 2;
        return Math.floor(stacks * dmgPerStk * tickRate * chance);
    }
    calcBurnDPS(s) {
        const chance = s.burnChance ?? 0;
        if (chance === 0)
            return 0;
        const dmg = s.burnDamage ?? 5;
        const duration = s.burnDuration ?? 3;
        const tickRate = 2; // 2 ticks/sec fixed
        return Math.floor(dmg * tickRate * chance * (duration / 3));
    }
    colorForLabel(label) {
        if (label === 'DPS')
            return '#e74c3c';
        if (label === 'CRIT')
            return '#f1c40f';
        if (label === 'EFF HP')
            return '#3498db';
        if (label === 'LIFESTEAL')
            return '#2ecc71';
        if (label === 'PSN DPS')
            return '#9b59b6';
        if (label === 'BURN DPS')
            return '#e67e22';
        if (label === 'TOP HIT')
            return '#ffd700';
        if (label === 'REFLECT')
            return '#95a5a6';
        if (label === 'SHIELD')
            return '#5dade2';
        if (label === 'GOLD')
            return '#ffd700';
        if (label === 'TTL DMG')
            return '#e74c3c';
        if (label === 'TOP HIT')
            return '#ffd700';
        return '#9999bb';
    }
    // ---------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------
    destroy() {
        this.container.destroy();
    }
}
