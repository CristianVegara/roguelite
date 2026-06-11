import Phaser from 'phaser';
import { CombatStats } from '../combat/CombatStats';
import { RulesEngine }  from '../combat/RulesEngine';
import { Player }       from '../entities/Player';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';

/**
 * StatsPanel — real-time build statistics overlay.
 *
 * Toggle with Tab key. Shows a compact summary by default; expanded view
 * shows historical combat stats (total damage, healing, highest hit).
 *
 * CHANGES:
 *   - FIX: Added panelScale compensation for CSS-scaled canvas on mobile.
 *     Identical approach to BuildPanel and GameScene.floaterScale.
 *     All px() calls replace the former hardcoded font-size strings.
 *   - FIX: Keyboard shortcut hints added to header: [Tab] + [E] expand
 */
export class StatsPanel {
  private readonly scene: Phaser.Scene;
  private readonly stats: CombatStats;
  private readonly engine: RulesEngine;
  private readonly player: Player;

  private container!: Phaser.GameObjects.Container;
  private bgGfx!:     Phaser.GameObjects.Graphics;
  private lines: Phaser.GameObjects.Text[] = [];
  private header!:   Phaser.GameObjects.Text;
  private hint!:     Phaser.GameObjects.Text;
  private closeBtn!: Phaser.GameObjects.Text;
  private expanded = false;
  private visible  = false;

  private readonly PANEL_W      = 192;
  private readonly MIN_PANEL_W  = 228;
  private readonly DEFAULT_X    = GAME_WIDTH - 192 - 8;
  private readonly DEFAULT_Y    = 170;
  private readonly LINE_H       = 18;
  private readonly COLUMN_W     = 106;
  private readonly COLUMN_GAP   = 18;

  private currentPanelW = this.PANEL_W;
  private currentPanelH = 200;
  private followPlayer   = true;

  // Drag state
  private dragging    = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private panelX      = 0;
  private panelY      = 0;

  /**
   * FIX: Scale compensation — see BuildPanel for full rationale.
   * Range [1.0, 1.6], clamped so desktop is always 1.0.
   */
  private readonly panelScale: number;

  constructor(scene: Phaser.Scene, player: Player, stats: CombatStats, engine: RulesEngine) {
    this.scene  = scene;
    this.player = player;
    this.stats  = stats;
    this.engine = engine;
    this.panelX = this.DEFAULT_X;
    this.panelY = this.DEFAULT_Y;

    // FIX: compute once at construction
    const ds = scene.scale.displayScale.x;
    this.panelScale = Math.min(1.6, Math.max(1, 1 / ds));

    this.build();
    this.bindKey();
  }

  // ---------------------------------------------------------------------------
  // Scale helper
  // ---------------------------------------------------------------------------

  /** Returns a scaled font size string for Phaser text styles. */
  private px(base: number): string {
    return `${Math.round(base * this.panelScale)}px`;
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  private build(): void {
    this.container = this.scene.add.container(this.panelX, this.panelY);
    this.container.setVisible(false);
    this.container.setDepth(100);

    this.bgGfx = this.scene.add.graphics();
    this.bgGfx.fillStyle(0x000000, 0.80);
    this.bgGfx.fillRoundedRect(0, 0, this.PANEL_W, 200, 6);
    this.bgGfx.lineStyle(1, 0x2a2a4a);
    this.bgGfx.strokeRoundedRect(0, 0, this.PANEL_W, 200, 6);
    this.container.add(this.bgGfx);

    // FIX: px() applied — was hardcoded '12px'
    this.header = this.addText(this.PANEL_W / 2, 8, 'BUILD STATS', {
      fontSize: this.px(12), color: '#ffd700',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(this.header);

    // FIX: px() applied — was hardcoded '16px'
    this.closeBtn = this.addText(this.PANEL_W - 6, 6, '×', {
      fontSize: this.px(16), color: '#555577', fontFamily: 'monospace',
    }).setOrigin(1, 0)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerover',  function(this: Phaser.GameObjects.Text) { this.setColor('#e0e0e0'); })
      .on('pointerout',   function(this: Phaser.GameObjects.Text) { this.setColor('#555577'); })
      .on('pointerdown',  () => { this.visible = false; this.container.setVisible(false); });
    this.container.add(this.closeBtn);

    // FIX: px() applied — was hardcoded '9px'
    this.hint = this.addText(this.PANEL_W / 2, 24, '[Tab] toggle  [E] expand', {
      fontSize: this.px(9), color: '#333355', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(this.hint);

    const dragZone = this.scene.add.zone(0, 0, this.PANEL_W, 28)
      .setOrigin(0, 0)
      .setInteractive({ cursor: 'grab', draggable: false });
    this.container.add(dragZone);

    dragZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.followPlayer = false;
      this.dragging    = true;
      this.dragOffsetX = ptr.x - this.panelX;
      this.dragOffsetY = ptr.y - this.panelY;
    });

    dragZone.on('pointerup', () => { this.dragging = false; });

    let lastClick = 0;
    dragZone.on('pointerdown', () => {
      const now = Date.now();
      if (now - lastClick < 350) this.resetPosition();
      lastClick = now;
    });

    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.dragging || !ptr.isDown) return;
      this.moveTo(ptr.x - this.dragOffsetX, ptr.y - this.dragOffsetY);
    });
    this.scene.input.on('pointerup', () => { this.dragging = false; });

    // FIX: px() applied to all stat line text — was hardcoded '11px'
    for (let i = 0; i < 18; i++) {
      const t = this.addText(0, 0, '', {
        fontSize: this.px(11), color: '#9999bb', fontFamily: 'monospace',
      }).setOrigin(0, 0);
      this.lines.push(t);
      this.container.add(t);
    }
  }

  toggle(): void {
    const wasVisible = this.visible;
    this.visible = !this.visible;
    if (this.visible && !wasVisible && this.followPlayer) {
      this.updatePosition();
      this.followPlayer = true;
    }
    this.container.setVisible(this.visible);
  }

  private bindKey(): void {
    this.scene.input.keyboard?.on('keydown-TAB', () => this.toggle());
    this.scene.input.keyboard?.on('keydown-E', () => {
      if (!this.visible) return;
      this.expanded = !this.expanded;
    });
  }

  // ---------------------------------------------------------------------------
  // Position helpers
  // ---------------------------------------------------------------------------

  private moveTo(x: number, y: number): void {
    const width    = this.currentPanelW;
    const height   = this.currentPanelH;
    const clampedX = Phaser.Math.Clamp(x, 0, GAME_WIDTH  - width);
    const clampedY = Phaser.Math.Clamp(y, 0, GAME_HEIGHT - height - 4);
    this.panelX = clampedX;
    this.panelY = clampedY;
    this.container.setPosition(clampedX, clampedY);
  }

  private updatePosition(): void {
    if (!this.followPlayer) return;
    const cam     = this.scene.cameras.main;
    const screenX = this.player.x - cam.worldView.x;
    const screenY = this.player.y - cam.worldView.y;
    const desiredX = screenX - this.currentPanelW / 2;
    const desiredY = screenY + 52;
    this.moveTo(desiredX, desiredY);
  }

  private resetPosition(): void {
    this.followPlayer = true;
    this.moveTo(this.DEFAULT_X, this.DEFAULT_Y);
  }

  private addText(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, text, style);
    if (typeof (t as any).setResolution === 'function') {
      (t as any).setResolution(window.devicePixelRatio || 1);
    }
    return t;
  }

  // ---------------------------------------------------------------------------
  // Update (called each frame by GameScene while visible)
  // ---------------------------------------------------------------------------

  update(): void {
    if (!this.visible) return;
    if (this.followPlayer && !this.dragging) this.updatePosition();
    const s = this.stats;
    const e = this.engine;

    const dps         = this.calcDPS(s);
    const poisonDPS   = this.calcPoisonDPS(s);
    const burnDPS     = this.calcBurnDPS(s);
    const effectiveHP = Math.floor(s.hp * (1 + (s.armor ?? 0) / 100));
    const critPct     = Math.round((s.critChance ?? 0) * 100);
    const critMult    = ((s.critMultiplier ?? 2.0)).toFixed(1);
    const ls          = Math.round((s.lifesteal ?? 0) * 100);
    const reflect     = Math.round((s.reflectPercent ?? 0) * 100);
    const shield      = s.shield ?? 0;
    const dmgMult     = Math.round(((s.damageMultiplier ?? 1.0) - 1.0) * 100);
    const psnChance   = Math.round((s.poisonChance ?? 0) * 100);
    const burnChance  = Math.round((s.burnChance ?? 0) * 100);

    const compact: [string, string][] = [
      ['ATK SPD',  `${s.attackSpeed.toFixed(2)}/s`],
      ['DAMAGE',   `${s.damage}${dmgMult !== 0 ? `  (${dmgMult > 0 ? '+' : ''}${dmgMult}%)` : ''}`],
      ['DPS',      `~${dps}`],
      ['CRIT',     `${critPct}%  ×${critMult}`],
      ['ARMOR',    `${Math.floor(e.effectiveArmor())}`],
      ['EFF HP',   `${effectiveHP}`],
      ['LIFESTEAL',ls > 0 ? `${ls}%` : '—'],
      ['REFLECT',  reflect > 0 ? `${reflect}%` : '—'],
      ['PSN DPS',  poisonDPS > 0 ? `~${poisonDPS}  (${psnChance}% chance)` : '—'],
      ['BURN DPS', burnDPS   > 0 ? `~${burnDPS}  (${burnChance}% chance)` : '—'],
      ['SHIELD',   shield > 0 ? `${shield}` : '—'],
      ['GOLD',     `${e.gold}`],
    ];

    const historical: [string, string][] = [
      ['TTL DMG',  `${e.totalDamageDealt}`],
      ['TTL HEAL', `${e.totalHealingDone}`],
      ['TOP HIT',  `${e.highestDamageHit}`],
      ['BOSSES',   `${e.bossesKilled}`],
      ['UPGRADES', `${e.upgradeCount()}`],
    ];

    const rows        = this.expanded ? [...compact, ...historical] : compact;
    const columnCount = Math.max(1, Math.ceil(rows.length / 5));
    const panelW      = Math.max(this.MIN_PANEL_W, 16 + columnCount * this.COLUMN_W + (columnCount - 1) * this.COLUMN_GAP);
    const bgH         = 32 + Math.min(rows.length, 5) * this.LINE_H + 8;
    this.currentPanelW = panelW;
    this.currentPanelH = bgH;

    this.bgGfx.clear();
    this.bgGfx.fillStyle(0x000000, 0.80);
    this.bgGfx.fillRoundedRect(0, 0, panelW, bgH, 6);
    this.bgGfx.lineStyle(1, 0x2a2a4a);
    this.bgGfx.strokeRoundedRect(0, 0, panelW, bgH, 6);

    this.header.setX(panelW / 2);
    this.closeBtn.setX(panelW - 6);
    this.hint.setX(panelW / 2);

    const maxY = GAME_HEIGHT - bgH - 4;
    if (this.panelY > maxY) this.moveTo(this.panelX, maxY);

    // FIX: Update each line's fontSize with px() in case scale changed
    // (e.g. window resize). setStyle is cheap when value is unchanged.
    rows.forEach(([label, value], i) => {
      if (i >= this.lines.length) return;
      const col   = Math.floor(i / 5);
      const row   = i % 5;
      const x     = 8 + col * (this.COLUMN_W + this.COLUMN_GAP);
      const y     = 36 + row * this.LINE_H;
      const color = this.colorForLabel(label);
      this.lines[i]
        .setPosition(x, y)
        .setText(`${label.padEnd(9)} ${value}`)
        .setColor(color)
        // FIX: ensure font size stays scaled even if the panel was built
        // before the scale observer fired
        .setFontSize(this.px(11))
        .setVisible(true);
    });
    for (let i = rows.length; i < this.lines.length; i++) {
      this.lines[i].setVisible(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived calculations
  // ---------------------------------------------------------------------------

  private calcDPS(s: CombatStats): number {
    const crit   = s.critChance ?? 0;
    const mult   = s.critMultiplier ?? 2.0;
    const avgHit = s.damage * (1 - crit + crit * mult);
    return Math.floor(avgHit * s.attackSpeed);
  }

  private calcPoisonDPS(s: CombatStats): number {
    const chance = s.poisonChance ?? 0;
    if (chance === 0) return 0;
    const stacks    = s.poisonStacks ?? 1;
    const dmgPerStk = s.poisonDamage ?? 2;
    const tickRate  = s.poisonTickRate ?? 2;
    return Math.floor(stacks * dmgPerStk * tickRate * chance);
  }

  private calcBurnDPS(s: CombatStats): number {
    const chance = s.burnChance ?? 0;
    if (chance === 0) return 0;
    const dmg      = s.burnDamage ?? 5;
    const duration = s.burnDuration ?? 3;
    const tickRate = 2;
    return Math.floor(dmg * tickRate * chance * (duration / 3));
  }

  private colorForLabel(label: string): string {
    if (label === 'DPS')      return '#e74c3c';
    if (label === 'CRIT')     return '#f1c40f';
    if (label === 'EFF HP')   return '#3498db';
    if (label === 'LIFESTEAL')return '#2ecc71';
    if (label === 'PSN DPS')  return '#9b59b6';
    if (label === 'BURN DPS') return '#e67e22';
    if (label === 'TOP HIT')  return '#ffd700';
    if (label === 'REFLECT')  return '#95a5a6';
    if (label === 'SHIELD')   return '#5dade2';
    if (label === 'GOLD')     return '#ffd700';
    if (label === 'TTL DMG')  return '#e74c3c';
    return '#9999bb';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.container.destroy();
  }
}