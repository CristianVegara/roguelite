import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConstants';
import { ALL_CLASSES, ClassDefinition } from '../data/ClassDefinition';
import { setRunConfig } from '../RunConfig';

// ---------------------------------------------------------------------------
// Layout constants  (all computed at module level from GameConstants, safe
// because GameConstants has no scene imports — no circular dependency)
// ---------------------------------------------------------------------------

const CARD_W  = 200;
const CARD_H  = 130;
const COL_GAP = 16;
const ROW_GAP = 14;

const GRID_COLS   = 2;
const GRID_W      = CARD_W * GRID_COLS + COL_GAP;
const GRID_X      = (GAME_WIDTH - GRID_W) / 2;   // local x inside scroll container
const CONTENT_PAD = 10;                           // top/bottom padding inside content

// Visible scroll window (below header, above bottom hint)
const SCROLL_TOP    = 68;
const SCROLL_BOTTOM = GAME_HEIGHT - 26;
const VISIBLE_H     = SCROLL_BOTTOM - SCROLL_TOP;

// Full content height
const GRID_ROWS  = Math.ceil(ALL_CLASSES.length / GRID_COLS);
const CONTENT_H  = CONTENT_PAD + GRID_ROWS * (CARD_H + ROW_GAP) - ROW_GAP + CONTENT_PAD;
const MAX_SCROLL = Math.max(0, CONTENT_H - VISIBLE_H);

// Scrollbar geometry
const SB_X       = GAME_WIDTH - 8;                                    // centre x
const SB_W       = 5;
const SB_THUMB_H = Math.max(32, Math.round(VISIBLE_H * VISIBLE_H / CONTENT_H));
const SB_TRAVEL  = VISIBLE_H - SB_THUMB_H;                           // pixels thumb can slide

// ---------------------------------------------------------------------------

export class ClassScene extends Phaser.Scene {
  private scrollContainer!: Phaser.GameObjects.Container;
  private sbThumb!:         Phaser.GameObjects.Graphics;
  private scrollY           = 0;
  private sbDragging        = false;
  private sbDragOffset      = 0;   // ptr.y − thumb top edge at drag start

  constructor() { super({ key: 'ClassScene' }); }

  create(): void {
    this.scrollY    = 0;
    this.sbDragging = false;

    this.drawBackground();
    this.drawHeader();
    this.buildScrollContainer();
    this.buildScrollbar();
    this.bindInput();

    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------------

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(0x080812);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Header bar
    g.fillStyle(0x0e0e1e);
    g.fillRect(0, 0, GAME_WIDTH, 60);
    g.lineStyle(1, 0x252540);
    g.lineBetween(0, 60, GAME_WIDTH, 60);

    // Fade strips at scroll window edges so cut-off cards look intentional
    const topFade = this.add.graphics();
    topFade.fillGradientStyle(0x080812, 0x080812, 0x080812, 0x080812, 1, 1, 0, 0);
    topFade.fillRect(0, SCROLL_TOP, GAME_WIDTH, 14);
    topFade.setDepth(5);

    const botFade = this.add.graphics();
    botFade.fillGradientStyle(0x080812, 0x080812, 0x080812, 0x080812, 0, 0, 1, 1);
    botFade.fillRect(0, SCROLL_BOTTOM - 14, GAME_WIDTH, 14);
    botFade.setDepth(5);
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  private drawHeader(): void {
    // ── Back button (top-left) ──────────────────────────────────────────────
    const backBtn = this.add.text(12, 30, '← BACK', {
      fontSize: '11px', color: '#555577', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setDepth(6)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerover',  function(this: Phaser.GameObjects.Text) { this.setColor('#e0e0e0'); })
      .on('pointerout',   function(this: Phaser.GameObjects.Text) { this.setColor('#555577'); })
      .on('pointerdown',  () => this.cameras.main.fadeOut(180, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('HomeScene');
      }));
    void backBtn;

    // ESC / B → return to hub
    this.input.keyboard?.once('keydown-ESC', () => {
      this.cameras.main.fadeOut(180, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('HomeScene');
      });
    });
    this.input.keyboard?.once('keydown-B', () => {
      this.cameras.main.fadeOut(180, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('HomeScene');
      });
    });

    this.add.text(GAME_WIDTH / 2, 18, 'CHOOSE YOUR CLASS', {
      fontSize: '18px', color: '#c0c0d8',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.add.text(GAME_WIDTH / 2, 40, 'Your class shapes which upgrades you discover', {
      fontSize: '10px', color: '#333355', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // Bottom hint (always visible, outside scroll area)
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 12, '↕  scroll to see all classes   [ESC] back', {
      fontSize: '9px', color: '#1e1e3a', fontFamily: 'monospace',
    }).setOrigin(0.5, 1).setDepth(6);
  }

  // ---------------------------------------------------------------------------
  // Scrollable card container
  // ---------------------------------------------------------------------------

  private buildScrollContainer(): void {
    // Container's y-origin sits at SCROLL_TOP; scrolling shifts it upward
    this.scrollContainer = this.add.container(0, SCROLL_TOP);

    // GeometryMask: only render children within the visible scroll window
    const maskG = this.make.graphics({});
    maskG.fillRect(0, SCROLL_TOP, GAME_WIDTH, VISIBLE_H);
    this.scrollContainer.setMask(maskG.createGeometryMask());

    ALL_CLASSES.forEach((cls, i) => this.addCard(cls, i));
  }

  // ---------------------------------------------------------------------------
  // Individual class card  (positioned locally inside scrollContainer)
  // ---------------------------------------------------------------------------

  private addCard(cls: ClassDefinition, index: number): void {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);

    // Local position inside scrollContainer (top-left origin at scrollContainer.y)
    const cx = GRID_X + col * (CARD_W + COL_GAP) + CARD_W / 2;
    const cy = CONTENT_PAD + row * (CARD_H + ROW_GAP) + CARD_H / 2;
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;

    const card = this.add.container(cx, cy);
    card.setSize(CARD_W, CARD_H).setInteractive({ cursor: 'pointer' });

    const bg     = this.add.graphics();
    const accent = this.add.graphics();

    const drawDefault = (): void => {
      bg.clear();
      bg.fillStyle(0x0c0c1e);
      bg.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
      bg.lineStyle(1, 0x1a1a30);
      bg.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
      accent.clear();
      accent.fillStyle(cls.color, 0.8);
      accent.fillRect(-hw, -hh, CARD_W, 3);
    };

    const drawHover = (): void => {
      bg.clear();
      bg.fillStyle(0x141428);
      bg.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
      bg.lineStyle(2, cls.color);
      bg.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
      accent.clear();
      accent.fillStyle(cls.color);
      accent.fillRect(-hw, -hh, CARD_W, 5);
    };

    drawDefault();

    // Icon + class name
    const iconLabel = this.add.text(-hw + 12, -hh + 18, cls.icon, {
      fontSize: '22px', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    const nameLabel = this.add.text(-hw + 44, -hh + 13, cls.name.toUpperCase(), {
      fontSize: '13px', color: intToHex(cls.color),
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0);

    const flavLabel = this.add.text(-hw + 44, -hh + 31, cls.flavour, {
      fontSize: '8px', color: '#444466',
      fontFamily: 'monospace', fontStyle: 'italic',
      wordWrap: { width: CARD_W - 56 },
    }).setOrigin(0, 0);

    // Divider
    const div = this.add.graphics();
    div.lineStyle(1, 0x1a1a2e);
    div.lineBetween(-hw + 8, -hh + 50, hw - 8, -hh + 50);

    // Build-ecosystem description
    const descLabel = this.add.text(0, -hh + 80, cls.description, {
      fontSize: '10px', color: '#777799',
      fontFamily: 'monospace',
      wordWrap: { width: CARD_W - 20 }, align: 'center',
    }).setOrigin(0.5, 0.5);

    // Category boost tags (e.g. "summons ×3  poison ×2")
    const boostTags = Object.entries(cls.categoryWeights)
      .filter(([, w]) => (w ?? 0) >= 2)
      .map(([cat, w]) => `${cat} ×${w ?? 1}`)
      .join('  ');
    const tagsLabel = this.add.text(0, hh - 12, boostTags, {
      fontSize: '8px', color: intToHex(cls.color), fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5).setAlpha(0.55);

    card.add([bg, accent, iconLabel, nameLabel, flavLabel, div, descLabel, tagsLabel]);
    this.scrollContainer.add(card);

    card.on('pointerover', drawHover);
    card.on('pointerout',  drawDefault);
    card.on('pointerdown', () => {
      this.tweens.add({
        targets: card, scaleX: 0.93, scaleY: 0.93,
        duration: 75, yoyo: true, ease: 'Power2',
        onComplete: () => {
          setRunConfig({ classId: cls.id });
          this.cameras.main.fadeOut(200, 0, 0, 0, (_: unknown, progress: number) => {
            if (progress === 1) this.scene.start('GameScene');
          });
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Scrollbar (track + draggable thumb)
  // ---------------------------------------------------------------------------

  private buildScrollbar(): void {
    if (MAX_SCROLL <= 0) return;

    // Track
    const trackG = this.add.graphics().setDepth(6);
    trackG.fillStyle(0x111122);
    trackG.fillRoundedRect(SB_X - SB_W / 2, SCROLL_TOP + 2, SB_W, VISIBLE_H - 4, SB_W / 2);

    // Thumb (redrawn on every scroll)
    this.sbThumb = this.add.graphics().setDepth(7);
    this.redrawThumb();

    // Invisible zone over the full track — handles click-to-jump + drag
    const trackZone = this.add.zone(SB_X, SCROLL_TOP, SB_W + 12, VISIBLE_H)
      .setOrigin(0.5, 0)
      .setInteractive({ cursor: 'ns-resize' })
      .setDepth(8);

    trackZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.sbDragging   = true;
      // Compute where the thumb top would be at current scroll
      const thumbTopY   = SCROLL_TOP + (this.scrollY / MAX_SCROLL) * SB_TRAVEL;
      this.sbDragOffset = ptr.y - thumbTopY;
      // If click is outside the thumb, centre the thumb on the click first
      if (ptr.y < thumbTopY || ptr.y > thumbTopY + SB_THUMB_H) {
        this.sbDragOffset = SB_THUMB_H / 2;
        this.applyScroll((ptr.y - SCROLL_TOP - SB_THUMB_H / 2) / SB_TRAVEL * MAX_SCROLL);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Input binding (wheel + pointer drag for scrollbar)
  // ---------------------------------------------------------------------------

  private bindInput(): void {
    if (MAX_SCROLL <= 0) return;

    // Mouse / trackpad wheel
    this.input.on('wheel',
      (_p: unknown, _go: unknown, _dx: number, deltaY: number) => {
        this.applyScroll(this.scrollY + deltaY * 0.45);
      },
    );

    // Global pointer move: handle scrollbar drag
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.sbDragging || !ptr.isDown) return;
      const thumbTopY  = ptr.y - this.sbDragOffset;
      const rel        = thumbTopY - SCROLL_TOP;
      this.applyScroll((rel / SB_TRAVEL) * MAX_SCROLL);
    });

    // Release drag
    this.input.on('pointerup', () => { this.sbDragging = false; });
  }

  // ---------------------------------------------------------------------------
  // Scroll helpers
  // ---------------------------------------------------------------------------

  private applyScroll(y: number): void {
    this.scrollY              = Phaser.Math.Clamp(y, 0, MAX_SCROLL);
    this.scrollContainer.y    = SCROLL_TOP - this.scrollY;
    this.redrawThumb();
  }

  private redrawThumb(): void {
    if (!this.sbThumb) return;
    const thumbTopY = SCROLL_TOP + 2 +
      (MAX_SCROLL > 0 ? (this.scrollY / MAX_SCROLL) * SB_TRAVEL : 0);
    this.sbThumb.clear();
    this.sbThumb.fillStyle(0x3a3a60);
    this.sbThumb.fillRoundedRect(SB_X - SB_W / 2, thumbTopY, SB_W, SB_THUMB_H, SB_W / 2);
  }
}

// ---------------------------------------------------------------------------

function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
