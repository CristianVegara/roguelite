import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';
import { OwnedUpgrades }          from '../data/UpgradeDefinition';
import { ALL_UPGRADES }           from '../data/AllUpgrades';
import { ALL_RELICS }             from '../data/AllRelics';
import { Player }                 from '../entities/Player';

/**
 * BuildPanel — in-run build overview toggled with [B].
 *
 * Shows a scrollable list of:
 *   - owned upgrades (name, stacks, category colour)
 *   - owned relics
 *
 * Fixed to the right side of the screen, depth 110 (above StatsPanel).
 */
export class BuildPanel {
  private readonly scene:  Phaser.Scene;
  private readonly player: Player;
  private readonly owned:  OwnedUpgrades;
  private readonly relics: Set<string>;

  private container!: Phaser.GameObjects.Container;
  private visible = false;

  private readonly PANEL_W      = 200;
  private readonly PANEL_X      = GAME_WIDTH - 200 - 4;
  private readonly PANEL_Y      = 170;
  private readonly MAX_H        = GAME_HEIGHT - 160;
  private readonly LINE_H       = 15;
  private readonly COLUMN_W     = 150;
  private readonly COLUMN_GAP   = 8;
  private readonly MAX_ROWS     = 5;

  private currentPanelW = this.PANEL_W;
  private currentPanelH = 0;

  // Scrolling
  private scrollOffset = 0;
  private totalContentH = 0;

  constructor(scene: Phaser.Scene, player: Player, owned: OwnedUpgrades, relics: Set<string>) {
    this.scene  = scene;
    this.player = player;
    this.owned  = owned;
    this.relics = relics;
    this.build();
    this.bindKeys();
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  private build(): void {
    this.container = this.scene.add.container(this.PANEL_X, this.PANEL_Y);
    this.container.setVisible(false);
    this.container.setDepth(110);
  }

  /** Called by HUD button or keydown-B. */
  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.scrollOffset = 0;
      this.rebuild();
      this.updatePosition();
    }
    this.container.setVisible(this.visible);
  }

  private bindKeys(): void {
    this.scene.input.keyboard?.on('keydown-B', () => this.toggle());

    // Scroll with mouse wheel when visible
    this.scene.input.on('wheel',
      (_p: unknown, _go: unknown, _dx: number, deltaY: number) => {
        if (!this.visible) return;
        const maxScroll = Math.max(0, this.totalContentH - this.MAX_H + 16);
        this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + deltaY * 0.5, 0, maxScroll);
        this.rebuild();
      },
    );

    // Touch drag scroll — tracks a single pointer drag over the panel area
    let dragStartY    = 0;
    let dragStartOff  = 0;
    let isDragging    = false;

    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.visible) return;
      const bounds = this.container.getBounds();
      if (ptr.x < bounds.x || ptr.x > bounds.right) return;
      if (ptr.y < bounds.y || ptr.y > bounds.bottom) return;
      isDragging    = true;
      dragStartY    = ptr.y;
      dragStartOff  = this.scrollOffset;
    });

    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!isDragging || !this.visible) return;
      const delta    = dragStartY - ptr.y;
      const maxScroll = Math.max(0, this.totalContentH - this.MAX_H + 16);
      this.scrollOffset = Phaser.Math.Clamp(dragStartOff + delta, 0, maxScroll);
      this.rebuild();
    });

    this.scene.input.on('pointerup', () => { isDragging = false; });
  }

  // ---------------------------------------------------------------------------
  // Rebuild content (called on open + scroll)
  // ---------------------------------------------------------------------------

  rebuild(): void {
    this.container.removeAll(true);

    const ownedEntries = [...this.owned.entries()].filter(([, stacks]) => stacks > 0);
    const relicEntries = [...this.relics];

    const upgradeRows = Math.max(1, ownedEntries.length);
    const upgradeCols = Math.max(1, Math.ceil(upgradeRows / this.MAX_ROWS));
    const relicRows   = Math.max(1, relicEntries.length);
    const relicCols   = Math.max(1, Math.ceil(relicRows / this.MAX_ROWS));

    const upgradeSectionHeight = 16 + Math.min(upgradeRows, this.MAX_ROWS) * this.LINE_H + 4;
    const relicSectionHeight   = 16 + Math.min(relicRows, this.MAX_ROWS) * this.LINE_H + 4;
    const featureSectionWidth  = ownedEntries.length === 0 ? this.COLUMN_W : upgradeCols * this.COLUMN_W + (upgradeCols - 1) * this.COLUMN_GAP;
    const relicSectionWidth    = relicEntries.length === 0 ? this.COLUMN_W : relicCols * this.COLUMN_W + (relicCols - 1) * this.COLUMN_GAP;
    const sectionWidth         = Math.max(featureSectionWidth, relicSectionWidth);

    const totalContent = 32 + upgradeSectionHeight + relicSectionHeight + 8;
    this.totalContentH = totalContent;
    const panelW = Math.min(GAME_WIDTH - 8, 16 + sectionWidth);
    const panelH = Math.min(this.MAX_H, totalContent);
    this.currentPanelW = panelW;
    this.currentPanelH = panelH;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.88);
    bg.fillRoundedRect(0, 0, panelW, panelH, 6);
    bg.lineStyle(1, 0x2a2a4a);
    bg.strokeRoundedRect(0, 0, panelW, panelH, 6);
    this.container.add(bg);

    // Close button [×]
    const closeBtn = this.addText(panelW - 8, 8, '×', {
      fontSize: '14px', color: '#555577', fontFamily: 'monospace',
    }).setOrigin(1, 0)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerover',  function(this: Phaser.GameObjects.Text) { this.setColor('#e0e0e0'); })
      .on('pointerout',   function(this: Phaser.GameObjects.Text) { this.setColor('#555577'); })
      .on('pointerdown',  () => { this.visible = false; this.container.setVisible(false); });
    this.container.add(closeBtn);

    // Header
    const header = this.addText(panelW / 2, 8, 'BUILD  [B]', {
      fontSize: '10px', color: '#ffd700',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(header);

    const contentContainer = this.scene.add.container(0, 24);
    this.container.add(contentContainer);

    let sectionY = 0;

    // ── Upgrades section ─────────────────────────────────────────────────
    const upgLabel = this.addText(8, sectionY, 'UPGRADES', {
      fontSize: '8px', color: '#333355', fontFamily: 'monospace', letterSpacing: 1,
    });
    contentContainer.add(upgLabel);

    const upgradeBaseY = sectionY + 16;
    if (ownedEntries.length === 0) {
      contentContainer.add(
        this.addText(8, upgradeBaseY, 'none yet', {
          fontSize: '9px', color: '#2a2a4a', fontFamily: 'monospace',
        }),
      );
    } else {
      const tierColors: Record<string, number> = {
        starter: 0x555577, synergy: 0x2ecc71,
        transformation: 0x3498db, keystone: 0xffd700,
      };

      ownedEntries.forEach(([id, stacks], index) => {
        const def = ALL_UPGRADES.find(u => u.id === id);
        if (!def) return;

        const col = Math.floor(index / this.MAX_ROWS);
        const row = index % this.MAX_ROWS;
        const x = 8 + col * (this.COLUMN_W + this.COLUMN_GAP);
        const y = upgradeBaseY + row * this.LINE_H;

        const color = `#${def.color.toString(16).padStart(6, '0')}`;
        const maxChars  = def.maxStacks > 1 ? 16 : 20;
        const label     = def.name.length > maxChars
          ? def.name.slice(0, maxChars - 1) + '…'
          : def.name;

        contentContainer.add(this.scene.add.text(x, y, label, {
          fontSize: '9px', color, fontFamily: 'monospace',
        }));

        if (def.maxStacks > 1) {
          const maxDots = Math.min(def.maxStacks, 8);
          const dotStep = 8;
          const dotCY   = y + 5;
          const dotR    = 2.5;
          const rightEdge = x + this.COLUMN_W - 18;
          const dotsG = this.scene.add.graphics();

          for (let i = 0; i < maxDots; i++) {
            const dotX = rightEdge - (maxDots - 1 - i) * dotStep;
            if (i < stacks) {
              dotsG.fillStyle(def.color, 1);
              dotsG.fillCircle(dotX, dotCY, dotR);
            } else {
              dotsG.lineStyle(1, 0x2a2a5a, 0.9);
              dotsG.strokeCircle(dotX, dotCY, dotR);
            }
          }
          contentContainer.add(dotsG);
        }

        const tierDot = this.scene.add.graphics();
        tierDot.fillStyle(tierColors[def.tier] ?? 0x555577);
        tierDot.fillCircle(x + this.COLUMN_W - 10, y + 5, 3);
        contentContainer.add(tierDot);
      });
    }

    sectionY += upgradeSectionHeight;
    sectionY += 8;

    // ── Relics section ───────────────────────────────────────────────────
    const relicLabel = this.scene.add.text(8, sectionY, 'RELICS', {
      fontSize: '8px', color: '#333355', fontFamily: 'monospace', letterSpacing: 1,
    });
    contentContainer.add(relicLabel);

    const relicBaseY = sectionY + 16;
    if (relicEntries.length === 0) {
      contentContainer.add(
        this.scene.add.text(8, relicBaseY, 'none yet', {
          fontSize: '9px', color: '#2a2a4a', fontFamily: 'monospace',
        }),
      );
    } else {
      relicEntries.forEach((id, index) => {
        const def = ALL_RELICS.find(r => r.id === id);
        const name = def ? def.name : id;
        const col = Math.floor(index / this.MAX_ROWS);
        const row = index % this.MAX_ROWS;
        const x = 8 + col * (this.COLUMN_W + this.COLUMN_GAP);
        const y = relicBaseY + row * this.LINE_H;

        contentContainer.add(this.scene.add.text(x, y, `◈ ${name}`, {
          fontSize: '9px', color: '#ffd700', fontFamily: 'monospace',
        }));
      });
    }

    const overflows = totalContent > this.MAX_H;
    if (overflows) {
      const hint = this.addText(panelW / 2, panelH - 12, '↑↓ scroll', {
        fontSize: '7px', color: '#2a2a4a', fontFamily: 'monospace',
      }).setOrigin(0.5, 1);
      this.container.add(hint);
    }
  }

  private addText(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, text, style);
    if (typeof (t as any).setResolution === 'function') {
      (t as any).setResolution(window.devicePixelRatio || 1);
    }
    return t;
  }

  update(): void {
    if (!this.visible) return;
    this.updatePosition();
  }

  private updatePosition(): void {
    const cam = this.scene.cameras.main;
    const screenX = this.player.x - cam.worldView.x;
    const screenY = this.player.y - cam.worldView.y;
    const desiredX = screenX - this.currentPanelW / 2;
    const desiredY = screenY + 56;
    const clampedX = Phaser.Math.Clamp(desiredX, 0, GAME_WIDTH - this.currentPanelW);
    const clampedY = Phaser.Math.Clamp(desiredY, 0, GAME_HEIGHT - this.currentPanelH - 4);
    this.container.setPosition(clampedX, clampedY);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.container.destroy();
  }
}
