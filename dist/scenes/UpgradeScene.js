import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConfig';
import { RARITY_COLOR, RARITY_LABEL, TIER_LABEL, } from '../data/UpgradeDefinition';
// Card geometry
const CARD_W = 136;
const CARD_H = 230;
const CARD_Y = 340;
const CARD_CENTERS_X = [96, 240, 384];
/**
 * UpgradeScene — launched on top of (paused) GameScene every 3 floors.
 *
 * Phase 1 changes vs original:
 *   - Uses UpgradeDefinition instead of Upgrade
 *   - Receives RulesEngine so apply() can register triggers
 *   - Cards show rarity badge, category label, tier tag, and stack count
 */
export class UpgradeScene extends Phaser.Scene {
    constructor() { super({ key: 'UpgradeScene' }); }
    init(data) {
        this.playerStats = data.playerStats;
        this.engine = data.engine;
        this.upgrades = data.upgrades;
        this.owned = data.ownedUpgrades;
        this.context = data.context ?? `Floor ${data.floor}`;
    }
    create() {
        this.drawDim();
        this.drawHeader();
        this.upgrades.forEach((upg, i) => this.createCard(upg, i));
    }
    // ---------------------------------------------------------------------------
    // Layout
    // ---------------------------------------------------------------------------
    drawDim() {
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.82);
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    drawHeader() {
        this.add.text(GAME_WIDTH / 2, 92, 'CHOOSE AN UPGRADE', {
            fontSize: '20px', color: '#e0e0e0',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add.text(GAME_WIDTH / 2, 124, this.context, {
            fontSize: '12px', color: '#555577', fontFamily: 'monospace',
        }).setOrigin(0.5);
    }
    createCard(upg, index) {
        const cx = CARD_CENTERS_X[index];
        const cy = CARD_Y;
        const hw = CARD_W / 2;
        const hh = CARD_H / 2;
        const acc = upg.color;
        const rarC = RARITY_COLOR[upg.rarity];
        const container = this.add.container(cx, cy);
        container.setSize(CARD_W, CARD_H).setInteractive({ cursor: 'pointer' });
        const bg = this.add.graphics();
        const accent = this.add.graphics();
        const drawDefault = () => {
            bg.clear();
            bg.fillStyle(0x10172e);
            bg.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            bg.lineStyle(1, 0x252540);
            bg.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            accent.clear();
            accent.fillStyle(acc);
            accent.fillRect(-hw, -hh, CARD_W, 4);
        };
        const drawHover = () => {
            bg.clear();
            bg.fillStyle(0x18224a);
            bg.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            bg.lineStyle(2, acc);
            bg.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            accent.clear();
            accent.fillStyle(acc);
            accent.fillRect(-hw, -hh, CARD_W, 6);
        };
        drawDefault();
        // Rarity badge (top-right corner)
        const rarLabel = this.add.text(hw - 6, -hh + 10, RARITY_LABEL[upg.rarity], {
            fontSize: '8px',
            color: intToHex(rarC),
            fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        // Tier tag (top-left)
        const tierLabel = this.add.text(-hw + 6, -hh + 10, TIER_LABEL[upg.tier], {
            fontSize: '8px',
            color: upg.tier === 'keystone' ? '#ffd700' : '#444466',
            fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        // Category (dim, just below accent)
        const catLabel = this.add.text(0, -hh + 22, upg.category.toUpperCase(), {
            fontSize: '8px',
            color: intToHex(acc),
            fontFamily: 'monospace',
        }).setOrigin(0.5, 0.5).setAlpha(0.45);
        // Upgrade name
        const nameLabel = this.add.text(0, -hh + 52, upg.name, {
            fontSize: '13px',
            color: intToHex(acc),
            fontFamily: 'monospace',
            fontStyle: 'bold',
            wordWrap: { width: CARD_W - 16 },
            align: 'center',
        }).setOrigin(0.5, 0.5);
        // Divider
        const div = this.add.graphics();
        div.lineStyle(1, 0x252540);
        div.lineBetween(-hw + 10, -hh + 74, hw - 10, -hh + 74);
        // Description — keep font smaller on long text to prevent overflow
        const descFontSize = upg.description.length > 80 ? '9px' : '10px';
        const descLabel = this.add.text(0, 18, upg.description, {
            fontSize: descFontSize,
            color: '#8888aa',
            fontFamily: 'monospace',
            wordWrap: { width: CARD_W - 18 },
            align: 'center',
        }).setOrigin(0.5, 0);
        // Stack count (if stackable)
        const currentStacks = this.owned.get(upg.id) ?? 0;
        const stackElems = [];
        if (upg.maxStacks > 1) {
            const stackText = this.add.text(0, hh - 20, `${currentStacks} / ${upg.maxStacks}`, {
                fontSize: '10px',
                color: currentStacks >= upg.maxStacks ? '#e74c3c' : '#555566',
                fontFamily: 'monospace',
            }).setOrigin(0.5, 0.5);
            stackElems.push(stackText);
        }
        // Flavour text
        const flavourElems = [];
        if (upg.flavour) {
            const fl = this.add.text(0, hh - 36, `"${upg.flavour}"`, {
                fontSize: '9px',
                color: '#333355',
                fontFamily: 'monospace',
                fontStyle: 'italic',
                wordWrap: { width: CARD_W - 16 },
                align: 'center',
            }).setOrigin(0.5, 0.5);
            flavourElems.push(fl);
        }
        container.add([bg, accent, rarLabel, tierLabel, catLabel, nameLabel, div, descLabel, ...stackElems, ...flavourElems]);
        container.on('pointerover', drawHover);
        container.on('pointerout', drawDefault);
        container.on('pointerdown', () => {
            this.tweens.add({
                targets: container,
                scaleX: 0.88, scaleY: 0.88,
                duration: 70, yoyo: true, ease: 'Power2',
                onComplete: () => this.selectUpgrade(upg),
            });
        });
    }
    // ---------------------------------------------------------------------------
    // Selection
    // ---------------------------------------------------------------------------
    selectUpgrade(upg) {
        // Apply the upgrade — mutates shared playerStats and registers engine triggers
        upg.apply(this.playerStats, this.engine);
        // Track stacks in the shared OwnedUpgrades map (GameScene reads this)
        this.owned.set(upg.id, (this.owned.get(upg.id) ?? 0) + 1);
        this.engine.registerUpgrade(upg.id);
        // Pass { upgraded: true } so GameScene can apply per-upgrade relic bonuses
        this.scene.resume('GameScene', { upgraded: true });
        this.scene.stop();
    }
}
function intToHex(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}
