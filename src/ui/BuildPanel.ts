import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';
import { OwnedUpgrades }          from '../data/UpgradeDefinition';
import { ALL_UPGRADES }           from '../data/AllUpgrades';
import { ALL_RELICS }             from '../data/AllRelics';

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
  private readonly owned:  OwnedUpgrades;
  private readonly relics: Set<string>;

  private container!: Phaser.GameObjects.Container;
  private visible = false;

  private readonly PANEL_W  = 200;
  private readonly PANEL_X  = GAME_WIDTH - 200 - 4;   // 276
  // 130 = 2px gap below the HP panels (top:66 + height:58 = 124px).
  // Previously 50, which overlapped the top bar zone.
  private readonly PANEL_Y  = 130;
  private readonly MAX_H    = GAME_HEIGHT - 160;       // adjusted to match new top
  private readonly LINE_H   = 15;

  // Scrolling
  private scrollOffset = 0;
  private totalContentH = 0;

  constructor(scene: Phaser.Scene, owned: OwnedUpgrades, relics: Set<string>) {
    this.scene  = scene;
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
      // Only respond to touches/clicks inside the panel bounding box
      if (ptr.x < this.PANEL_X || ptr.x > this.PANEL_X + this.PANEL_W) return;
      if (ptr.y < this.PANEL_Y || ptr.y > this.PANEL_Y + this.MAX_H)   return;
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

    // Compute total content height
    const SECTION_H  = 18;
    const ENTRY_H    = this.LINE_H;
    this.totalContentH =
      SECTION_H + ownedEntries.length * ENTRY_H + 6 +
      SECTION_H + relicEntries.length * ENTRY_H + 6;

    const panelH = Math.min(this.MAX_H, this.totalContentH + 32);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.88);
    bg.fillRoundedRect(0, 0, this.PANEL_W, panelH, 6);
    bg.lineStyle(1, 0x2a2a4a);
    bg.strokeRoundedRect(0, 0, this.PANEL_W, panelH, 6);
    this.container.add(bg);

    // Close button [×]
    const closeBtn = this.scene.add.text(this.PANEL_W - 8, 8, '×', {
      fontSize: '14px', color: '#555577', fontFamily: 'monospace',
    }).setOrigin(1, 0)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerover',  function(this: Phaser.GameObjects.Text) { this.setColor('#e0e0e0'); })
      .on('pointerout',   function(this: Phaser.GameObjects.Text) { this.setColor('#555577'); })
      .on('pointerdown',  () => { this.visible = false; this.container.setVisible(false); });
    this.container.add(closeBtn);

    // Header
    const header = this.scene.add.text(this.PANEL_W / 2, 8, 'BUILD  [B]', {
      fontSize: '10px', color: '#ffd700',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(header);

    // Content clip mask
    const maskG = this.scene.make.graphics({});
    maskG.fillRect(
      this.PANEL_X, this.PANEL_Y + 24,
      this.PANEL_W, panelH - 28,
    );
    const mask = maskG.createGeometryMask();

    const contentContainer = this.scene.add.container(0, 24 - this.scrollOffset);
    contentContainer.setMask(mask);
    this.container.add(contentContainer);

    let y = 0;

    // ── Upgrades section ─────────────────────────────────────────────────
    const upgLabel = this.scene.add.text(6, y, 'UPGRADES', {
      fontSize: '8px', color: '#333355',
      fontFamily: 'monospace', letterSpacing: 1,
    });
    contentContainer.add(upgLabel);
    y += 16;

    if (ownedEntries.length === 0) {
      contentContainer.add(
        this.scene.add.text(8, y, 'none yet', {
          fontSize: '9px', color: '#2a2a4a', fontFamily: 'monospace',
        }),
      );
      y += this.LINE_H;
    } else {
      const tierColors: Record<string, number> = {
        starter: 0x555577, synergy: 0x2ecc71,
        transformation: 0x3498db, keystone: 0xffd700,
      };

      for (const [id, stacks] of ownedEntries) {
        const def = ALL_UPGRADES.find(u => u.id === id);
        if (!def) continue;

        const col = `#${def.color.toString(16).padStart(6, '0')}`;

        // ── Name (truncated to leave room for dot zone) ───────────────────
        const maxChars  = def.maxStacks > 1 ? 16 : 20;
        const label     = def.name.length > maxChars
          ? def.name.slice(0, maxChars - 1) + '…'
          : def.name;
        const nameText  = this.scene.add.text(8, y, label, {
          fontSize: '9px', color: col, fontFamily: 'monospace',
        });
        contentContainer.add(nameText);

        // ── Stack dots (only for stackable upgrades) ──────────────────────
        // Layout: filled dots for owned stacks, dim outline dots for remaining
        // capacity. Max 8 shown. Rightmost dot at x = PANEL_W - 18 (leaves
        // room for the tier dot at PANEL_W - 10). Dots step 8px left each.
        if (def.maxStacks > 1) {
          const maxDots  = Math.min(def.maxStacks, 8);
          const dotStep  = 8;
          const dotCY    = y + 5;  // vertical centre of row
          const dotR     = 2.5;
          const rightEdge = this.PANEL_W - 18;

          const dotsG = this.scene.add.graphics();

          for (let i = 0; i < maxDots; i++) {
            const dotX = rightEdge - (maxDots - 1 - i) * dotStep;
            const owned = i < stacks;
            if (owned) {
              // Filled dot in upgrade colour
              dotsG.fillStyle(def.color, 1);
              dotsG.fillCircle(dotX, dotCY, dotR);
            } else {
              // Hollow outline dot in a dark-muted colour
              dotsG.lineStyle(1, 0x2a2a5a, 0.9);
              dotsG.strokeCircle(dotX, dotCY, dotR);
            }
          }
          contentContainer.add(dotsG);
        }

        // ── Tier dot (far right) ──────────────────────────────────────────
        const tierDot = this.scene.add.graphics();
        tierDot.fillStyle(tierColors[def.tier] ?? 0x555577);
        tierDot.fillCircle(this.PANEL_W - 10, y + 5, 3);
        contentContainer.add(tierDot);

        y += this.LINE_H;
      }
    }

    y += 4;

    // ── Relics section ───────────────────────────────────────────────────
    const relicLabel = this.scene.add.text(6, y, 'RELICS', {
      fontSize: '8px', color: '#333355',
      fontFamily: 'monospace', letterSpacing: 1,
    });
    contentContainer.add(relicLabel);
    y += 16;

    if (relicEntries.length === 0) {
      contentContainer.add(
        this.scene.add.text(8, y, 'none yet', {
          fontSize: '9px', color: '#2a2a4a', fontFamily: 'monospace',
        }),
      );
    } else {
      for (const id of relicEntries) {
        const def = ALL_RELICS.find(r => r.id === id);
        const name = def ? def.name : id;
        contentContainer.add(
          this.scene.add.text(8, y, `◈ ${name}`, {
            fontSize: '9px', color: '#ffd700', fontFamily: 'monospace',
          }),
        );
        y += this.LINE_H;
      }
    }

    // Scroll hint if content overflows
    const overflows = this.totalContentH + 32 > this.MAX_H;
    if (overflows) {
      const hint = this.scene.add.text(this.PANEL_W / 2, panelH - 12, '↑↓ scroll', {
        fontSize: '7px', color: '#2a2a4a', fontFamily: 'monospace',
      }).setOrigin(0.5, 1);
      this.container.add(hint);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.container.destroy();
  }
}
