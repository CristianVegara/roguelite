import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConfig';
import {
  metaService,
  UPGRADE_INFO,
  META_MAX_LEVEL,
  UpgradeKey,
} from '../meta/MetaService';

export interface MetaSceneData {
  floor: number;
  earned: number;
}

// Layout constants
const ROW_LEFT   = 40;
const ROW_WIDTH  = 400;
const ROW_H      = 68;
const ROW_Y      = [284, 364, 444];   // vertical centre of each row
const BTN_CX     = 408;               // buy button centre-x
const BTN_W      = 62;
const BTN_H      = 30;
const LEVEL_CX   = 318;               // level text centre-x

/**
 * MetaScene — between-run upgrade shop.
 *
 * Receives run summary data (floor, earned) from GameScene.
 * Reads/writes meta state through the metaService singleton.
 * On "START NEW RUN" → scene.start('GameScene').
 *
 * Dynamic UI (currency, level text, button state) is refreshed by a
 * single refreshDynamicUI() call after every purchase — no full rebuild.
 */
export class MetaScene extends Phaser.Scene {
  private floorReached = 0;
  private earnedThisRun = 0;

  // Dynamic UI refs updated on each purchase
  private currencyDisplay!: Phaser.GameObjects.Text;
  private rowRefs!: RowRefs[];

  constructor() {
    super({ key: 'MetaScene' });
  }

  init(data: MetaSceneData): void {
    this.floorReached = data.floor;
    this.earnedThisRun = data.earned;
  }

  create(): void {
    this.drawBackground();
    this.buildRunSummary();
    this.buildUpgradeSection();
    this.buildStartButton();
  }

  // ---------------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------------

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0f0f1e);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle top border line
    g.lineStyle(1, 0x333366);
    g.lineBetween(0, 44, GAME_WIDTH, 44);
  }

  // ---------------------------------------------------------------------------
  // Run summary (top section)
  // ---------------------------------------------------------------------------

  private buildRunSummary(): void {
    // Title
    this.add.text(GAME_WIDTH / 2, 28, 'RUN ENDED', {
      fontSize: '18px',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Floor / earned row
    this.add.text(GAME_WIDTH / 2, 72, `Floor reached: ${this.floorReached}`, {
      fontSize: '13px',
      color: '#aaaacc',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    this.add.text(GAME_WIDTH / 2, 96, `Earned: +${this.earnedThisRun} ★`, {
      fontSize: '13px',
      color: '#ffd700',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    const best = metaService.highestFloor;
    const bestColor = this.floorReached >= best ? '#2ecc71' : '#555577';
    const bestLabel = this.floorReached >= best
      ? `Best run: Floor ${best}  ← new record!`
      : `Best run: Floor ${best}`;
    this.add.text(GAME_WIDTH / 2, 116, bestLabel, {
      fontSize: '11px',
      color: bestColor,
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    // Divider
    const div = this.add.graphics();
    div.lineStyle(1, 0x2a2a4a);
    div.lineBetween(ROW_LEFT, 138, ROW_LEFT + ROW_WIDTH, 138);

    // Total currency (big, prominent)
    this.add.text(GAME_WIDTH / 2, 158, 'CURRENCY', {
      fontSize: '10px',
      color: '#555577',
      fontFamily: 'monospace',
      letterSpacing: 3,
    }).setOrigin(0.5, 0.5);

    this.currencyDisplay = this.add.text(GAME_WIDTH / 2, 184, '', {
      fontSize: '28px',
      color: '#ffd700',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Section header
    const div2 = this.add.graphics();
    div2.lineStyle(1, 0x2a2a4a);
    div2.lineBetween(ROW_LEFT, 218, ROW_LEFT + ROW_WIDTH, 218);

    this.add.text(GAME_WIDTH / 2, 234, 'PERMANENT UPGRADES', {
      fontSize: '11px',
      color: '#555577',
      fontFamily: 'monospace',
      letterSpacing: 2,
    }).setOrigin(0.5, 0.5);
  }

  // ---------------------------------------------------------------------------
  // Upgrade rows
  // ---------------------------------------------------------------------------

  private buildUpgradeSection(): void {
    this.rowRefs = UPGRADE_INFO.map((info, i) =>
      this.buildUpgradeRow(info.key, info.label, info.bonusDesc, info.color, ROW_Y[i]),
    );
    this.refreshDynamicUI();
  }

  private buildUpgradeRow(
    key: UpgradeKey,
    label: string,
    bonusDesc: string,
    color: number,
    cy: number,
  ): RowRefs {
    const hh = ROW_H / 2;

    // Row background
    const rowBg = this.add.graphics();
    rowBg.fillStyle(0x12192e);
    rowBg.fillRoundedRect(ROW_LEFT, cy - hh, ROW_WIDTH, ROW_H, 6);
    rowBg.lineStyle(1, 0x1e2a44);
    rowBg.strokeRoundedRect(ROW_LEFT, cy - hh, ROW_WIDTH, ROW_H, 6);

    // Colour accent strip
    rowBg.fillStyle(color);
    rowBg.fillRect(ROW_LEFT, cy - hh, 4, ROW_H);

    // Static label + description
    this.add.text(ROW_LEFT + 20, cy - 10, label, {
      fontSize: '14px',
      color: intToHex(color),
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.add.text(ROW_LEFT + 20, cy + 12, bonusDesc, {
      fontSize: '10px',
      color: '#666688',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // Dynamic: level text
    const levelText = this.add.text(LEVEL_CX, cy, '', {
      fontSize: '11px',
      color: '#aaaacc',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    // Dynamic: buy button background
    const btnBg = this.add.graphics();

    // Dynamic: button label
    const btnText = this.add.text(BTN_CX, cy, '', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Dynamic: cost text (below button)
    const costText = this.add.text(BTN_CX, cy + 18, '', {
      fontSize: '10px',
      color: '#ffd700',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    // Hit zone for the button
    const zone = this.add
      .zone(BTN_CX, cy - 2, BTN_W + 12, BTN_H + 12)
      .setInteractive({ cursor: 'pointer' });

    zone.on('pointerdown', () => {
      if (metaService.purchase(key)) {
        this.refreshDynamicUI();
      }
    });

    return { levelText, btnBg, btnText, costText };
  }

  // ---------------------------------------------------------------------------
  // Dynamic UI refresh
  // ---------------------------------------------------------------------------

  /** Called once on create, then after every purchase. */
  private refreshDynamicUI(): void {
    this.currencyDisplay.setText(`${metaService.currency} ★`);

    UPGRADE_INFO.forEach((info, i) => {
      const key = info.key;
      const refs = this.rowRefs[i];
      const level = metaService.upgrades[key];
      const isMax = metaService.isMaxLevel(key);
      const canAfford = metaService.canAfford(key);
      const cost = metaService.costForUpgrade(key);
      const cy = ROW_Y[i];

      // Level counter
      refs.levelText.setText(`Lv ${level} / ${META_MAX_LEVEL}`);

      // Button
      refs.btnBg.clear();
      const btnColor = isMax ? 0x1a1a2e : canAfford ? 0x1e6e3a : 0x1a1a2e;
      const borderColor = isMax ? 0x333355 : canAfford ? 0x27ae60 : 0x333344;
      refs.btnBg.fillStyle(btnColor);
      refs.btnBg.fillRoundedRect(BTN_CX - BTN_W / 2, cy - 2 - BTN_H / 2, BTN_W, BTN_H, 5);
      refs.btnBg.lineStyle(1, borderColor);
      refs.btnBg.strokeRoundedRect(BTN_CX - BTN_W / 2, cy - 2 - BTN_H / 2, BTN_W, BTN_H, 5);

      refs.btnText.setText(isMax ? 'MAX' : 'BUY');
      refs.btnText.setColor(isMax ? '#444466' : canAfford ? '#ffffff' : '#555566');

      // Cost
      refs.costText.setText(isMax ? '' : `${cost} ★`);
      refs.costText.setColor(canAfford ? '#ffd700' : '#555566');
    });
  }

  // ---------------------------------------------------------------------------
  // Start button
  // ---------------------------------------------------------------------------

  private buildStartButton(): void {
    const cy = 530;
    const bw = 220, bh = 46;
    const cx = GAME_WIDTH / 2;

    const bg = this.add.graphics();

    const drawDefault = () => {
      bg.clear();
      bg.fillStyle(0x16213e);
      bg.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
      bg.lineStyle(2, 0x4fc3f7);
      bg.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
    };
    const drawHover = () => {
      bg.clear();
      bg.fillStyle(0x1a3060);
      bg.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
      bg.lineStyle(2, 0x7de8ff);
      bg.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
    };

    drawDefault();

    this.add.text(cx, cy, 'START NEW RUN', {
      fontSize: '15px',
      color: '#4fc3f7',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const zone = this.add
      .zone(cx, cy, bw, bh)
      .setInteractive({ cursor: 'pointer' });

    zone.on('pointerover', drawHover);
    zone.on('pointerout', drawDefault);
    zone.on('pointerdown', () => {
      this.tweens.add({
        targets: bg,
        alpha: 0.4,
        duration: 80,
        yoyo: true,
        onComplete: () => this.scene.start('GameScene'),
      });
    });

    // Keyboard shortcut: Enter or Space also starts
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('GameScene'));
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('GameScene'));
  }
}

// ---------------------------------------------------------------------------
// Local types & helpers
// ---------------------------------------------------------------------------

interface RowRefs {
  levelText: Phaser.GameObjects.Text;
  btnBg: Phaser.GameObjects.Graphics;
  btnText: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
}

function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
