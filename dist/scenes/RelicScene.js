import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConfig';
import { RELIC_RARITY_COLOR, RELIC_RARITY_LABEL } from '../data/RelicDefinition';
// Card geometry — wider than upgrade cards to fit longer relic descriptions
const CARD_W = 148;
const CARD_H = 240;
const CARD_Y = 330;
/**
 * RelicScene — launched on top of (paused) GameScene at relic floors.
 *
 * Shows 3 relic cards. Player clicks one; the relic's onAcquire() fires,
 * the relic is stored in ownedRelics, and GameScene resumes.
 */
export class RelicScene extends Phaser.Scene {
    constructor() { super({ key: 'RelicScene' }); }
    init(data) {
        this.playerStats = data.playerStats;
        this.engine = data.engine;
        this.relics = data.relics;
        this.owned = data.ownedRelics;
        this.floor = data.floor;
    }
    create() {
        this.drawDim();
        this.drawHeader();
        const cardCount = this.relics.length;
        // Centre cards: compute X positions for 1-3 cards
        const spacing = CARD_W + 16;
        const totalW = spacing * cardCount - 16;
        const startX = GAME_WIDTH / 2 - totalW / 2 + CARD_W / 2;
        this.relics.forEach((relic, i) => this.createCard(relic, startX + i * spacing));
    }
    // ---------------------------------------------------------------------------
    // Layout
    // ---------------------------------------------------------------------------
    drawDim() {
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.88);
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    drawHeader() {
        // Animated glow title
        const title = this.add.text(GAME_WIDTH / 2, 82, '✦  RELIC FOUND  ✦', {
            fontSize: '20px', color: '#ffd700',
            fontFamily: 'monospace', fontStyle: 'bold',
            stroke: '#7d6000', strokeThickness: 3,
        }).setOrigin(0.5);
        this.tweens.add({
            targets: title, alpha: 0.6,
            duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        this.add.text(GAME_WIDTH / 2, 116, `Floor ${this.floor} — choose a relic`, {
            fontSize: '12px', color: '#666688', fontFamily: 'monospace',
        }).setOrigin(0.5);
    }
    createCard(relic, cx) {
        const cy = CARD_Y;
        const hw = CARD_W / 2;
        const hh = CARD_H / 2;
        const acc = relic.color;
        const rarC = RELIC_RARITY_COLOR[relic.rarity];
        const container = this.add.container(cx, cy);
        container.setSize(CARD_W, CARD_H).setInteractive({ cursor: 'pointer' });
        const bg = this.add.graphics();
        const accent = this.add.graphics();
        const drawDefault = () => {
            bg.clear();
            bg.fillStyle(0x0e1428);
            bg.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            bg.lineStyle(1, 0x252540);
            bg.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            accent.clear();
            accent.fillStyle(acc, 0.9);
            accent.fillRect(-hw, -hh, CARD_W, 5);
        };
        const drawHover = () => {
            bg.clear();
            bg.fillStyle(0x1a2040);
            bg.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            bg.lineStyle(2, acc);
            bg.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            accent.clear();
            accent.fillStyle(acc);
            accent.fillRect(-hw, -hh, CARD_W, 7);
        };
        drawDefault();
        // Rarity badge (top-right)
        const rarLabel = this.add.text(hw - 6, -hh + 11, RELIC_RARITY_LABEL[relic.rarity], {
            fontSize: '8px', color: intToHex(rarC), fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        // RELIC tag (top-left)
        const typeLabel = this.add.text(-hw + 6, -hh + 11, 'RELIC', {
            fontSize: '8px', color: intToHex(acc), fontFamily: 'monospace',
        }).setOrigin(0, 0.5).setAlpha(0.7);
        // Relic gem icon (uses category color as a coloured circle symbol)
        const gem = this.add.text(0, -hh + 44, '◈', {
            fontSize: '28px', color: intToHex(acc), fontFamily: 'monospace',
        }).setOrigin(0.5, 0.5);
        this.tweens.add({
            targets: gem, angle: 20,
            duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        // Name
        const nameLabel = this.add.text(0, -hh + 80, relic.name, {
            fontSize: '13px', color: intToHex(acc),
            fontFamily: 'monospace', fontStyle: 'bold',
            wordWrap: { width: CARD_W - 16 }, align: 'center',
        }).setOrigin(0.5, 0.5);
        // Divider
        const div = this.add.graphics();
        div.lineStyle(1, 0x252540);
        div.lineBetween(-hw + 10, -hh + 96, hw - 10, -hh + 96);
        // Description
        const descLabel = this.add.text(0, -hh + 140, relic.description, {
            fontSize: '10px', color: '#8888aa',
            fontFamily: 'monospace',
            wordWrap: { width: CARD_W - 18 }, align: 'center',
        }).setOrigin(0.5, 0.5);
        // Flavour text (italic, dim)
        const flavElems = [];
        if (relic.flavour) {
            const fl = this.add.text(0, hh - 22, relic.flavour, {
                fontSize: '9px', color: '#2a2a4a',
                fontFamily: 'monospace', fontStyle: 'italic',
                wordWrap: { width: CARD_W - 16 }, align: 'center',
            }).setOrigin(0.5, 0.5);
            flavElems.push(fl);
        }
        container.add([bg, accent, rarLabel, typeLabel, gem, nameLabel, div, descLabel, ...flavElems]);
        container.on('pointerover', drawHover);
        container.on('pointerout', drawDefault);
        container.on('pointerdown', () => {
            this.tweens.add({
                targets: container, scaleX: 0.88, scaleY: 0.88,
                duration: 70, yoyo: true, ease: 'Power2',
                onComplete: () => this.selectRelic(relic),
            });
        });
    }
    // ---------------------------------------------------------------------------
    // Selection
    // ---------------------------------------------------------------------------
    selectRelic(relic) {
        relic.onAcquire(this.playerStats, this.engine);
        this.engine.registerRelic(relic.id);
        this.engine.registerUpgrade(relic.id); // so hasUpgrade() checks work
        this.owned.add(relic.id);
        this.scene.resume('GameScene', { relicAcquired: relic.id });
        this.scene.stop();
    }
}
function intToHex(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}
