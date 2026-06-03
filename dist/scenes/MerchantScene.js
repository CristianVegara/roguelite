import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConfig';
import { pickRunUpgrades } from '../data/AllUpgrades';
import { RARITY_COLOR, RARITY_LABEL, TIER_LABEL } from '../data/UpgradeDefinition';
// Card geometry
const CARD_W = 130;
const CARD_H = 220;
const CARD_Y = 330;
const CARD_CENTERS_X = [90, 240, 390];
/**
 * MerchantScene — launched on top of (paused) GameScene on merchant floors.
 *
 * Shows 3 upgrades available for purchase with gold.
 * Player can buy any number of items, then clicks LEAVE.
 */
export class MerchantScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MerchantScene' });
        this.rerollCost = 15; // increases each reroll
        this.rerollCount = 0;
    }
    init(data) {
        this.playerStats = data.playerStats;
        this.engine = data.engine;
        this.owned = data.ownedUpgrades;
        this.floor = data.floor;
    }
    create() {
        this.rerollCost = 15;
        this.rerollCount = 0;
        this.buildOffers();
        this.drawBackground();
        this.drawHeader();
        this.offers.forEach((offer, i) => this.createCard(offer, i));
        this.createTempBuffSection();
        this.createRerollButton();
        this.createLeaveButton();
    }
    // ---------------------------------------------------------------------------
    // Offer generation
    // ---------------------------------------------------------------------------
    buildOffers() {
        const upgrades = pickRunUpgrades(3, this.floor, this.owned);
        this.offers = upgrades.map(upg => ({
            upg,
            cost: this.computeCost(upg),
            sold: false,
        }));
    }
    computeCost(upg) {
        const rarityBase = {
            common: 15, uncommon: 25, rare: 40, legendary: 60,
        };
        const base = rarityBase[upg.rarity] ?? 20;
        // Scale slightly with floor depth
        return base + Math.floor(this.floor * 0.5);
    }
    // ---------------------------------------------------------------------------
    // Layout
    // ---------------------------------------------------------------------------
    drawBackground() {
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.88);
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    drawHeader() {
        const title = this.add.text(GAME_WIDTH / 2, 70, '🛒  MERCHANT', {
            fontSize: '22px', color: '#f9ca24',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.tweens.add({
            targets: title, alpha: 0.7,
            duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        this.add.text(GAME_WIDTH / 2, 104, `Floor ${this.floor}  —  Spend wisely`, {
            fontSize: '11px', color: '#666644', fontFamily: 'monospace',
        }).setOrigin(0.5);
        // Gold display (updates on purchase)
        this.goldText = this.add.text(GAME_WIDTH / 2, 128, '', {
            fontSize: '14px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.refreshGoldText();
    }
    refreshGoldText() {
        this.goldText.setText(`Gold: ${this.engine.gold} ★`);
    }
    // ---------------------------------------------------------------------------
    // Reroll button
    // ---------------------------------------------------------------------------
    createRerollButton() {
        const cx = GAME_WIDTH / 2;
        const cy = CARD_Y + CARD_H / 2 + 18;
        const bg = this.add.graphics();
        const drawRerollBtn = () => {
            bg.clear();
            const canAfford = this.engine.gold >= this.rerollCost;
            bg.fillStyle(canAfford ? 0x0a1a28 : 0x120a0a);
            bg.fillRoundedRect(cx - 75, cy - 14, 150, 28, 5);
            bg.lineStyle(1, canAfford ? 0x4fc3f7 : 0x333355);
            bg.strokeRoundedRect(cx - 75, cy - 14, 150, 28, 5);
        };
        drawRerollBtn();
        this.rerollBtnLabel = this.add.text(cx, cy, `REROLL  ${this.rerollCost} ★`, {
            fontSize: '10px', color: '#4fc3f7', fontFamily: 'monospace',
        }).setOrigin(0.5);
        const zone = this.add.zone(cx, cy, 150, 28).setInteractive({ cursor: 'pointer' });
        zone.on('pointerover', () => {
            if (this.engine.gold >= this.rerollCost)
                this.rerollBtnLabel.setColor('#ffffff');
        });
        zone.on('pointerout', () => { this.rerollBtnLabel.setColor('#4fc3f7'); });
        zone.on('pointerdown', () => {
            if (this.engine.gold < this.rerollCost) {
                this.tweens.add({ targets: this.rerollBtnLabel, alpha: 0.2, duration: 80, yoyo: true, repeat: 2 });
                return;
            }
            this.engine.addGold(-this.rerollCost);
            this.rerollCount++;
            // Reroll cost increases: 15 → 25 → 40 → 60 …
            this.rerollCost = Math.min(100, Math.floor(15 * Math.pow(1.5, this.rerollCount)));
            this.buildOffers();
            // Destroy and recreate card objects.  Tag them with a name so they can be cleared.
            this.children.getAll()
                .filter(c => c.name === 'merchant_card')
                .forEach(c => c.destroy());
            this.offers.forEach((offer, i) => this.createCard(offer, i));
            this.rerollBtnLabel.setText(`REROLL  ${this.rerollCost} ★`);
            drawRerollBtn();
            this.refreshGoldText();
        });
    }
    // ---------------------------------------------------------------------------
    // Temporary buff section (3 cheap consumable buffs)
    // ---------------------------------------------------------------------------
    createTempBuffSection() {
        const buffs = [
            {
                label: 'War Ration',
                desc: 'Restore 25% max HP',
                cost: 20,
                apply: () => {
                    const heal = Math.floor(this.playerStats.maxHp * 0.25);
                    this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + heal);
                },
            },
            {
                label: 'Sharpening Stone',
                desc: '+10% damage (this floor)',
                cost: 25,
                apply: () => {
                    this.playerStats.damage = Math.ceil(this.playerStats.damage * 1.10);
                },
            },
            {
                label: 'Guard Totem',
                desc: '+20 armor (this floor)',
                cost: 25,
                apply: () => {
                    this.playerStats.armor += 20;
                },
            },
        ];
        const BUFF_Y = 162;
        const BUFF_W = (GAME_WIDTH - 24) / 3;
        this.add.text(8, BUFF_Y - 14, 'CONSUMABLES', {
            fontSize: '8px', color: '#333355', fontFamily: 'monospace', letterSpacing: 1,
        });
        buffs.forEach((buff, i) => {
            const bx = 8 + i * (BUFF_W + 4);
            const bg = this.add.graphics();
            const drawBuff = (sold, hover = false) => {
                bg.clear();
                const canAfford = !sold && this.engine.gold >= buff.cost;
                bg.fillStyle(sold ? 0x0a0a0a : hover ? 0x122010 : 0x0c0c1e);
                bg.fillRoundedRect(bx, BUFF_Y, BUFF_W, 52, 5);
                bg.lineStyle(1, sold ? 0x1a1a1a : canAfford ? 0x2ecc71 : 0x222240);
                bg.strokeRoundedRect(bx, BUFF_Y, BUFF_W, 52, 5);
            };
            drawBuff(false);
            this.add.text(bx + BUFF_W / 2, BUFF_Y + 12, buff.label, {
                fontSize: '9px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold',
                wordWrap: { width: BUFF_W - 8 }, align: 'center',
            }).setOrigin(0.5, 0);
            this.add.text(bx + BUFF_W / 2, BUFF_Y + 30, buff.desc, {
                fontSize: '8px', color: '#666688', fontFamily: 'monospace',
                wordWrap: { width: BUFF_W - 8 }, align: 'center',
            }).setOrigin(0.5, 0);
            const costLabel = this.add.text(bx + BUFF_W / 2, BUFF_Y + 44, `${buff.cost} ★`, {
                fontSize: '9px', color: '#ffd700', fontFamily: 'monospace',
            }).setOrigin(0.5, 0);
            let sold = false;
            const zone = this.add.zone(bx + BUFF_W / 2, BUFF_Y + 26, BUFF_W, 52)
                .setInteractive({ cursor: 'pointer' });
            zone.on('pointerover', () => { if (!sold)
                drawBuff(false, true); });
            zone.on('pointerout', () => { drawBuff(sold); });
            zone.on('pointerdown', () => {
                if (sold || this.engine.gold < buff.cost) {
                    this.tweens.add({ targets: costLabel, alpha: 0.1, duration: 80, yoyo: true, repeat: 2 });
                    return;
                }
                this.engine.addGold(-buff.cost);
                buff.apply();
                sold = true;
                costLabel.setText('USED').setColor('#333355');
                drawBuff(true);
                this.refreshGoldText();
            });
        });
    }
    createCard(offer, index) {
        const { upg, cost } = offer;
        const cx = CARD_CENTERS_X[index];
        const cy = CARD_Y;
        const hw = CARD_W / 2;
        const hh = CARD_H / 2;
        const acc = upg.color;
        const rarC = RARITY_COLOR[upg.rarity];
        const container = this.add.container(cx, cy);
        container.setName('merchant_card');
        container.setSize(CARD_W, CARD_H).setInteractive({ cursor: 'pointer' });
        const bg = this.add.graphics();
        const accent = this.add.graphics();
        const soldBg = this.add.graphics();
        const soldLabel = this.add.text(0, 0, 'SOLD', {
            fontSize: '18px', color: '#333355',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setVisible(false);
        const drawDefault = () => {
            bg.clear();
            bg.fillStyle(offer.sold ? 0x0a0a14 : 0x10172e);
            bg.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            bg.lineStyle(1, offer.sold ? 0x1a1a2a : 0x252540);
            bg.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            accent.clear();
            if (!offer.sold) {
                accent.fillStyle(acc);
                accent.fillRect(-hw, -hh, CARD_W, 4);
            }
        };
        const drawHover = () => {
            if (offer.sold)
                return;
            const canAfford = this.engine.gold >= cost;
            bg.clear();
            bg.fillStyle(canAfford ? 0x1a2a14 : 0x2a1414);
            bg.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            bg.lineStyle(2, canAfford ? acc : 0xe74c3c);
            bg.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            accent.clear();
            accent.fillStyle(acc);
            accent.fillRect(-hw, -hh, CARD_W, 6);
        };
        drawDefault();
        // Rarity + tier badges
        const rarLabel = this.add.text(hw - 5, -hh + 10, RARITY_LABEL[upg.rarity], {
            fontSize: '7px', color: intToHex(rarC), fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        const tierLabel = this.add.text(-hw + 5, -hh + 10, TIER_LABEL[upg.tier], {
            fontSize: '7px', color: upg.tier === 'keystone' ? '#ffd700' : '#444466',
            fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        // Category
        this.add.text(0, -hh + 22, upg.category.toUpperCase(), {
            fontSize: '7px', color: intToHex(acc), fontFamily: 'monospace',
        }).setOrigin(0.5).setAlpha(0.4);
        // Name
        const nameLabel = this.add.text(0, -hh + 50, upg.name, {
            fontSize: '12px', color: intToHex(acc),
            fontFamily: 'monospace', fontStyle: 'bold',
            wordWrap: { width: CARD_W - 14 }, align: 'center',
        }).setOrigin(0.5);
        // Divider
        const div = this.add.graphics();
        div.lineStyle(1, 0x252540);
        div.lineBetween(-hw + 8, -hh + 70, hw - 8, -hh + 70);
        // Description
        const descLabel = this.add.text(0, 10, upg.description, {
            fontSize: '10px', color: '#8888aa',
            fontFamily: 'monospace',
            wordWrap: { width: CARD_W - 16 }, align: 'center',
        }).setOrigin(0.5);
        // Cost button
        const btnBg = this.add.graphics();
        const btnLabel = this.add.text(0, hh - 26, `${cost} ★  BUY`, {
            fontSize: '11px', color: '#ffd700',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        const drawBtn = () => {
            btnBg.clear();
            const canAfford = this.engine.gold >= cost;
            const fill = offer.sold ? 0x0a0a0a : canAfford ? 0x0d2a18 : 0x1a0a0a;
            const stroke = offer.sold ? 0x1a1a1a : canAfford ? 0x2ecc71 : 0x5a2222;
            btnBg.fillStyle(fill);
            btnBg.fillRoundedRect(-55, hh - 42, 110, 28, 5);
            btnBg.lineStyle(1, stroke);
            btnBg.strokeRoundedRect(-55, hh - 42, 110, 28, 5);
            btnLabel.setColor(offer.sold ? '#333355' : canAfford ? '#ffd700' : '#5a4422');
        };
        drawBtn();
        container.add([bg, accent, soldBg, soldLabel, rarLabel, tierLabel, nameLabel, div, descLabel, btnBg, btnLabel]);
        container.on('pointerover', drawHover);
        container.on('pointerout', drawDefault);
        container.on('pointerdown', () => {
            if (offer.sold)
                return;
            if (this.engine.gold < cost) {
                // Flash red: can't afford
                this.tweens.add({
                    targets: container, alpha: 0.5, duration: 80, yoyo: true, repeat: 2,
                });
                return;
            }
            // Purchase
            offer.sold = true;
            // Deduct gold (use negative addGold)
            this.engine.addGold(-cost);
            // Apply upgrade
            upg.apply(this.playerStats, this.engine);
            this.owned.set(upg.id, (this.owned.get(upg.id) ?? 0) + 1);
            this.engine.registerUpgrade(upg.id);
            // Update card visually
            soldBg.clear();
            soldBg.fillStyle(0x000000, 0.65);
            soldBg.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 8);
            soldLabel.setVisible(true);
            drawDefault();
            drawBtn();
            this.refreshGoldText();
        });
    }
    // ---------------------------------------------------------------------------
    // Leave button
    // ---------------------------------------------------------------------------
    createLeaveButton() {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT - 60;
        const bw = 140, bh = 44;
        const bg = this.add.graphics();
        const border = this.add.graphics();
        const drawDefault = () => {
            bg.clear();
            bg.fillStyle(0x0e1428);
            bg.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
            border.clear();
            border.lineStyle(2, 0x4fc3f7);
            border.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
        };
        const drawHover = () => {
            bg.clear();
            bg.fillStyle(0x162a50);
            bg.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
            border.clear();
            border.lineStyle(2, 0x7de8ff);
            border.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
        };
        drawDefault();
        this.add.text(cx, cy, 'LEAVE SHOP', {
            fontSize: '14px', color: '#4fc3f7', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ cursor: 'pointer' });
        zone.on('pointerover', drawHover);
        zone.on('pointerout', drawDefault);
        zone.on('pointerdown', () => {
            this.scene.resume('GameScene');
            this.scene.stop();
        });
    }
}
function intToHex(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}
