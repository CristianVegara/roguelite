import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/GameConfig';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { RulesEngine } from '../combat/RulesEngine';
import { FloorManager } from '../floors/FloorManager';
import { pickRunUpgrades, ALL_UPGRADES } from '../data/AllUpgrades';
import { pickRelics, ALL_RELICS } from '../data/AllRelics';
import { ServiceLocator } from '../services/ServiceLocator';
import { getModeById } from '../modes/GameModeConfig';
import { metaService, MetaService } from '../meta/MetaService';
import { StatsPanel } from '../ui/StatsPanel';
import { BuildPanel } from '../ui/BuildPanel';
import { findClass } from '../data/ClassDefinition';
import { getRunConfig } from '../RunConfig';
import { XPManager } from '../combat/XPManager';
const PLAYER_X = 130;
const ENEMY_X = 350;
const COMBAT_Y = 350;
// ── Layout zones ─────────────────────────────────────────────────────────────
const HEADER_H = 44; // top bar (floor label, class badge, speed buttons)
const MOD_STRIP_Y = HEADER_H;
const MOD_STRIP_H = 22;
const HP_PANEL_Y = MOD_STRIP_Y + MOD_STRIP_H; // 66
const HP_PANEL_H = 58;
const HP_PANEL_W = 232; // each of two side-by-side panels
const HP_L_X = 4; // left panel left edge
const HP_R_X = HP_L_X + HP_PANEL_W + 4; // right panel left edge (242)
const BOT_BAR_Y = GAME_HEIGHT - 52; // bottom info bar top edge (588)
export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.state = 'fighting';
        this.killCount = 0;
        this.bossKillCount = 0;
        // Pending flags set by XP events; consumed in onFloorClear
        this.pendingLevelUpUpgrade = false;
        this.pendingBossUpgrade = false;
        this.currentClass = null;
        this.runStartTime = 0; // Date.now() at run start, for duration tracking
        // Speed controls (×1, ×1.5, ×2)
        this.gameSpeed = 1;
        this.speedBtns = [];
    }
    // ---------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------
    create() {
        this.state = 'fighting';
        const cfg0 = getRunConfig();
        this.floorManager = new FloorManager({
            bossesOnly: cfg0.rules.bossesOnly,
            allFloorsModified: cfg0.rules.allFloorsModified,
            bossEveryNFloors: cfg0.rules.bossEveryNFloors,
            enemyHpMultiplier: cfg0.rules.enemyHpMultiplier,
            enemyDamageMultiplier: cfg0.rules.enemyDamageMultiplier,
            enemySpeedMultiplier: cfg0.rules.enemySpeedMultiplier,
        });
        this.owned = new Map();
        this.ownedRelics = new Set();
        this.pendingLevelUpUpgrade = false;
        this.pendingBossUpgrade = false;
        this.drawBackground();
        this.createEntities();
        // XP + leveling
        this.xpManager = new XPManager();
        this.xpManager.onLevelUp = () => { this.pendingLevelUpUpgrade = true; };
        // Apply chosen class (from ClassScene → RunConfig)
        const cfg = getRunConfig();
        this.currentClass = findClass(cfg.classId);
        if (this.currentClass) {
            this.currentClass.apply(this.player.stats, this.engine);
        }
        this.applyModeRules(); // must be after class + before HUD
        this.createHUD();
        this.createOverlay();
        this.statsPanel = new StatsPanel(this, this.player.stats, this.engine);
        this.buildPanel = new BuildPanel(this, this.owned, this.ownedRelics);
        void this.buildPanel; // panel is self-managing via B key binding
        this.engine.onFloorStart(this.floorManager.currentModifier);
        this.createSpeedButtons();
        this.runStartTime = Date.now();
    }
    update(_time, delta) {
        if (this.state !== 'fighting')
            return;
        const scaledDelta = delta * this.gameSpeed;
        // ── 1. Tick DoTs + modifier effects ─────────────────────────────────────
        const dot = this.engine.tickStatusEffects(scaledDelta, this.enemy);
        if (dot.poisonDamage > 0) {
            this.enemy.takeDamage(dot.poisonDamage);
            this.spawnFloater(this.enemy.x, this.enemy.y - 20, dot.poisonDamage, 'poison');
        }
        if (dot.burnDamage > 0) {
            this.enemy.takeDamage(dot.burnDamage);
            this.spawnFloater(this.enemy.x, this.enemy.y - 20, dot.burnDamage, dot.burnIsCrit ? 'crit' : 'burn');
        }
        if (dot.dotHeal > 0) {
            const gained = this.player.heal(dot.dotHeal);
            this.engine.trackHealing(gained);
            this.spawnFloater(this.player.x, this.player.y - 20, dot.dotHeal, 'heal');
        }
        // Regenerating modifier: enemy heals
        if (dot.enemyRegenHeal > 0 && !this.enemy.isDead()) {
            this.enemy.stats.hp = Math.min(this.enemy.stats.maxHp, this.enemy.stats.hp + dot.enemyRegenHeal);
        }
        if ((dot.poisonDamage > 0 || dot.burnDamage > 0) && this.enemy.isDead()) {
            this.handleEnemyKill();
            return;
        }
        // ── 2. Player attack ─────────────────────────────────────────────────────
        if (this.player.tickAttack(scaledDelta * this.engine.playerSpeedMultiplier)) {
            const result = this.engine.resolvePlayerAttack(this.enemy);
            this.applyAttackResult(result);
            if (this.enemy.isDead()) {
                const overkill = Math.max(0, result.damage - Math.max(0, this.enemy.stats.hp));
                this.engine.storeOverkill(overkill);
                this.handleEnemyKill();
                return;
            }
        }
        // ── 3. Enemy attack ──────────────────────────────────────────────────────
        if (!this.enemy.isDead() && this.enemy.tickAttack(scaledDelta)) {
            const defResult = this.engine.resolveEnemyAttack(this.enemy.stats.damage, this.enemy);
            this.applyDefenseResult(defResult);
            if (this.player.isDead()) {
                if (this.engine.checkPhoenix()) {
                    this.player.stats.hp = 1;
                    this.player.takeDamage(0);
                }
                else {
                    this.transition('player_dead');
                }
            }
        }
        this.refreshHpTexts();
        this.statsPanel.update();
        // ── Per-frame HUD updates ────────────────────────────────────────────────
        // Gold counter
        this.goldHudText.setText(`★ ${this.engine.gold}`);
        // XP bar
        this.refreshXPBar();
        // Enemy status pips
        const ps = this.enemy.statusEffects.poison;
        if (ps && ps.stacks > 0) {
            this.enemyPoisonPip.setText(`☠ ×${ps.stacks}`).setVisible(true);
        }
        else {
            this.enemyPoisonPip.setVisible(false);
        }
        const bs = this.enemy.statusEffects.burn;
        if (bs && bs.durationMs > 0) {
            this.enemyBurnPip.setText('🔥 BURN').setVisible(true);
        }
        else {
            this.enemyBurnPip.setVisible(false);
        }
    }
    // ---------------------------------------------------------------------------
    // Combat result application
    // ---------------------------------------------------------------------------
    applyAttackResult(result) {
        this.enemy.takeDamage(result.damage);
        if (result.summonDamage > 0)
            this.enemy.takeDamage(result.summonDamage);
        if (result.lightningDamage > 0)
            this.enemy.takeDamage(result.lightningDamage);
        if (result.areaDamage > 0)
            this.enemy.takeDamage(result.areaDamage);
        // Heal from lifesteal
        if (result.healAmount > 0) {
            const gained = this.player.heal(result.healAmount);
            this.engine.trackHealing(gained);
        }
        // Alchemist's Flask: heal floaters were pushed into defResult floaters,
        // but for attack result we check the floaters array for 'heal' typed ones
        // applied via the alchemist flask are in defense context — no action here.
        // Transfuser relic: lifesteal also on area + summon damage
        if (this.engine.hasUpgrade('relic_transfuser')) {
            const ls = this.player.stats.lifesteal ?? 0;
            const bonus = Math.floor((result.areaDamage + result.summonDamage) * ls);
            if (bonus > 0) {
                const gained = this.player.heal(bonus);
                this.engine.trackHealing(gained);
                this.spawnFloater(this.player.x, this.player.y - 20, bonus, 'heal');
            }
        }
        // Overcharge: excess heal → shield
        if (result.excessHeal > 0 && this.engine.hasUpgrade('overcharge')) {
            const s = this.player.stats;
            const maxSh = s.maxShield ?? 0;
            if (maxSh > 0) {
                s.shield = Math.min(maxSh, (s.shield ?? 0) + result.excessHeal);
            }
        }
        if (result.poisonApplied > 0) {
            const s = this.player.stats;
            this.enemy.applyPoison(result.poisonApplied, s.poisonDamage ?? 2, 1000 / (s.poisonTickRate ?? 2), s.poisonMaxStacks ?? 10);
        }
        if (result.burnApplied) {
            const s = this.player.stats;
            this.enemy.applyBurn(s.burnDamage ?? 5, (s.burnDuration ?? 3) * 1000, 500, s.burnCanCrit ?? false);
        }
        // Thorned / Mirrored floor modifier: player takes recoil
        const recoil = result.thornDamage + result.mirrorDamage;
        if (recoil > 0) {
            this.player.takeDamage(recoil);
            this.spawnFloater(this.player.x, this.player.y - 20, recoil, 'reflect');
            if (this.player.isDead()) {
                if (this.engine.checkPhoenix()) {
                    this.player.stats.hp = 1;
                    this.player.takeDamage(0);
                }
                else {
                    this.transition('player_dead');
                    return;
                }
            }
        }
        for (const f of result.floaters) {
            const ex = f.target === 'enemy' ? this.enemy.x : this.player.x;
            const ey = f.target === 'enemy' ? this.enemy.y : this.player.y;
            this.spawnFloater(ex, ey - 18, f.value, f.type);
        }
        this.refreshHpTexts();
    }
    applyDefenseResult(defResult) {
        this.player.takeDamage(defResult.damageTaken);
        if (defResult.reflectDamage > 0) {
            this.enemy.takeDamage(defResult.reflectDamage);
        }
        // Vampiric enemy modifier: enemy heals on damage dealt
        if (defResult.enemyHeal > 0 && !this.enemy.isDead()) {
            this.enemy.stats.hp = Math.min(this.enemy.stats.maxHp, this.enemy.stats.hp + defResult.enemyHeal);
        }
        for (const f of defResult.floaters) {
            const ex = f.target === 'player' ? this.player.x : this.enemy.x;
            const ey = f.target === 'player' ? this.player.y : this.enemy.y;
            // Heal floaters from Alchemist's Flask
            if (f.type === 'heal' && f.target === 'player') {
                const gained = this.player.heal(f.value);
                this.engine.trackHealing(gained);
            }
            this.spawnFloater(ex, ey - 18, f.value, f.type);
        }
        this.refreshHpTexts();
    }
    // ---------------------------------------------------------------------------
    // Floor transitions
    // ---------------------------------------------------------------------------
    handleEnemyKill() {
        this.killCount++;
        const isBoss = this.enemy.isBoss;
        if (isBoss) {
            this.bossKillCount++;
            this.engine.onBossKilled();
            // BUG #2 fix: clear boss label immediately — don't wait for advanceFloor
            this.updateEnemyPanelName('ENEMY', false);
            // Boss kills always grant an upgrade pick (separate from level-up)
            this.pendingBossUpgrade = true;
            this.xpManager.bossXP(this.floorManager.currentFloor);
        }
        else {
            // Normal kill: grant XP (level-up fires onLevelUp callback → pendingLevelUpUpgrade)
            this.xpManager.killXP(this.floorManager.currentFloor);
        }
        // Volatile modifier: enemy explodes on death
        if (this.engine.volatile && this.enemy.stats.maxHp > 0) {
            const explosion = Math.floor(this.enemy.stats.maxHp * 0.25);
            this.player.takeDamage(explosion);
            this.spawnFloater(this.player.x, this.player.y - 30, explosion, 'burn');
            if (this.player.isDead() && !this.engine.checkPhoenix()) {
                this.transition('player_dead');
                return;
            }
            else if (this.player.isDead()) {
                this.player.stats.hp = 1;
            }
        }
        // Cursed floor modifier: bonus gold on kill
        const mod = this.floorManager.currentModifier;
        if (mod?.bonusGold) {
            this.engine.addGold(mod.bonusGold);
            this.spawnFloater(this.enemy.x, this.enemy.y - 30, mod.bonusGold, 'gold');
        }
        // Bomb Collar relic: store explosion damage for carryover
        if (this.engine.hasUpgrade('relic_bomb_collar')) {
            const blast = Math.floor(this.enemy.stats.maxHp * 0.50);
            const data = this.engine.getRelicData('bomb_collar');
            data['pendingBlast'] = blast;
        }
        // Golden Idol relic: gold per relic owned
        if (this.engine.hasUpgrade('relic_golden_idol')) {
            const relicBonus = this.ownedRelics.size * 3;
            this.engine.addGold(relicBonus);
        }
        const killResult = this.engine.onEnemyKilled(this.enemy);
        if (killResult.pendingHeal > 0) {
            const gained = this.player.heal(killResult.pendingHeal);
            if (gained > 0) {
                this.engine.trackHealing(gained);
                this.spawnFloater(this.player.x, this.player.y - 20, gained, 'heal');
            }
        }
        this.transition('floor_clear');
    }
    transition(next) {
        this.state = next;
        this.refreshHpTexts();
        if (next === 'floor_clear')
            this.onFloorClear();
        else
            this.onPlayerDead();
    }
    onFloorClear() {
        const floor = this.floorManager.currentFloor;
        const { rules } = getRunConfig();
        // Boss Rush keeps its own cadence (upgrade + relic every 3 bosses).
        // Standard mode: upgrades come from LEVEL-UPS and BOSS KILLS only.
        // Relic floors remain floor-based (FloorManager decides).
        const isBossRush = rules.bossesOnly;
        const isUpgradeFloor = isBossRush
            ? floor % 3 === 0
            : (this.pendingBossUpgrade || this.pendingLevelUpUpgrade);
        const isRelicFloor = isBossRush
            ? floor % 3 === 0
            : this.floorManager.isRelicFloor() && !isUpgradeFloor;
        // Consume flags regardless of which branch fires
        const doUpgrade = isUpgradeFloor;
        this.pendingBossUpgrade = false;
        this.pendingLevelUpUpgrade = false;
        this.time.delayedCall(250, () => {
            this.showFloorClearOverlay(floor);
            this.time.delayedCall(800, () => {
                if (doUpgrade)
                    this.launchUpgradeScreen();
                else if (isRelicFloor)
                    this.launchRelicScreen();
                else
                    this.advanceFloor();
            });
        });
    }
    launchUpgradeScreen() {
        const classWeights = this.currentClass?.categoryWeights;
        // Determine context label: boss reward > level-up > floor (Boss Rush fallback)
        const isBossReward = this.enemy?.isBoss ?? false;
        const level = this.xpManager.currentLevel;
        const contextLabel = isBossReward
            ? '⚔  Boss Reward'
            : level > 0
                ? `★  Level ${level} — Choose an Upgrade`
                : `Floor ${this.floorManager.currentFloor} cleared`;
        const data = {
            playerStats: this.player.stats,
            engine: this.engine,
            upgrades: pickRunUpgrades(3, this.floorManager.currentFloor, this.owned, classWeights),
            ownedUpgrades: this.owned,
            floor: this.floorManager.currentFloor,
            context: contextLabel,
        };
        this.events.once(Phaser.Scenes.Events.RESUME, (_scene, resumeData) => {
            // Momentum Stone relic: +5 max HP per upgrade taken
            if (resumeData?.upgraded && this.engine.hasUpgrade('relic_momentum_stone')) {
                this.player.stats.maxHp += 5;
                this.player.stats.hp = Math.min(this.player.stats.hp + 5, this.player.stats.maxHp);
            }
            // Boss Rush: relic floor fires on the same cadence as the upgrade draft
            // (every 3 bosses). Chain the relic screen before advancing.
            const { rules } = getRunConfig();
            if (rules.bossesOnly) {
                this.launchRelicScreen();
            }
            else {
                this.advanceFloor();
            }
        });
        this.scene.launch('UpgradeScene', data);
        this.scene.pause();
    }
    launchRelicScreen() {
        const relics = pickRelics(3, this.floorManager.currentFloor, this.ownedRelics);
        if (relics.length === 0) {
            this.advanceFloor();
            return;
        }
        const data = {
            playerStats: this.player.stats,
            engine: this.engine,
            relics,
            ownedRelics: this.ownedRelics,
            floor: this.floorManager.currentFloor,
        };
        this.events.once(Phaser.Scenes.Events.RESUME, () => {
            this.updateRelicHud();
            this.advanceFloor();
        });
        this.scene.launch('RelicScene', data);
        this.scene.pause();
    }
    advanceFloor() {
        this.floorManager.advance();
        // Boss Rush: always spawn a boss regardless of floor number
        const { rules } = getRunConfig();
        const config = rules.bossesOnly
            ? this.floorManager.buildBossConfig()
            : this.floorManager.buildEnemyConfig();
        const mod = this.floorManager.currentModifier;
        this.enemy.destroy();
        this.enemy = new Enemy(this, ENEMY_X, COMBAT_Y, config);
        this.floorLabel.setText(`Floor ${this.floorManager.currentFloor}`);
        this.updateModifierLabel();
        this.hideOverlay();
        // ── Special floors: skip combat ────────────────────────────────────────
        if (mod?.skipCombat) {
            this.state = 'special_floor';
            if (mod.specialType === 'merchant') {
                this.launchMerchantScene();
            }
            else {
                // Treasure floor
                this.showTreasureOverlay(mod);
            }
            return;
        }
        // Apply kill carryover (Plague Carrier, Backdraft, Bomb Collar blast)
        this.engine.applyKillCarryover(this.enemy);
        const bombData = this.engine.getRelicData('bomb_collar');
        if (bombData['pendingBlast']) {
            const blast = bombData['pendingBlast'];
            this.enemy.takeDamage(blast);
            this.spawnFloater(this.enemy.x, this.enemy.y - 30, blast, 'area');
            bombData['pendingBlast'] = 0;
        }
        this.engine.onFloorStart(mod);
        // ── Nightmare modifier: player starts at 50% HP ────────────────────────
        if (this.engine.nightmareActive) {
            this.player.stats.hp = Math.max(1, Math.floor(this.player.stats.maxHp * 0.5));
            this.player.takeDamage(0); // refresh health bar
        }
        // ── Sanctified modifier: player heals 30% max HP ──────────────────────
        if (this.engine.sanctifiedActive) {
            const healAmt = Math.floor(this.player.stats.maxHp * 0.3);
            const gained = this.player.heal(healAmt);
            if (gained > 0)
                this.spawnFloater(this.player.x, this.player.y - 30, gained, 'heal');
        }
        // ── Constricting modifier: lose 25% of current HP on entry ────────────
        if (this.engine.activeModifier === 'constricting') {
            const penalty = Math.max(1, Math.floor(this.player.stats.hp * 0.25));
            this.player.takeDamage(penalty);
            this.spawnFloater(this.player.x, this.player.y - 20, penalty, 'damage');
            if (this.player.isDead() && !this.engine.checkPhoenix()) {
                this.transition('player_dead');
                return;
            }
            else if (this.player.isDead()) {
                this.player.stats.hp = 1;
            }
        }
        this.enemyNameLabel.setText(config.isBoss ? config.bossLabel : 'ENEMY');
        this.enemyNameLabel.setColor(config.isBoss ? '#ffd700' : '#ef5350');
        this.updateEnemyPanelName(config.bossLabel || 'ENEMY', config.isBoss);
        if (config.isBoss)
            this.announceBoss(config.bossLabel);
        else
            this.announceFloor();
        this.state = 'fighting';
    }
    // ── Treasure floor ───────────────────────────────────────────────────────
    showTreasureOverlay(mod) {
        this.overlay.removeAll(true);
        const gold = mod.bonusRewards?.gold ?? 40;
        this.engine.addGold(gold);
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.85);
        bg.fillRoundedRect(-190, -120, 380, 240, 10);
        bg.lineStyle(2, 0xffd700);
        bg.strokeRoundedRect(-190, -120, 380, 240, 10);
        const title = this.add.text(0, -86, '✦  TREASURE ROOM  ✦', {
            fontSize: '22px', color: '#ffd700',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        const goldText = this.add.text(0, -44, `+${gold} GOLD`, {
            fontSize: '18px', color: '#ffd700', fontFamily: 'monospace',
        }).setOrigin(0.5);
        const hintText = this.add.text(0, -10, 'Bonus upgrade awaits…', {
            fontSize: '12px', color: '#888899', fontFamily: 'monospace',
        }).setOrigin(0.5);
        // Claim button
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x1a3a1a);
        btnBg.fillRoundedRect(-80, 30, 160, 44, 8);
        btnBg.lineStyle(2, 0x2ecc71);
        btnBg.strokeRoundedRect(-80, 30, 160, 44, 8);
        const btnLabel = this.add.text(0, 52, 'CLAIM REWARD', {
            fontSize: '13px', color: '#2ecc71',
            fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        const zone = this.add.zone(0, 52, 160, 44).setInteractive({ cursor: 'pointer' });
        zone.on('pointerdown', () => {
            this.overlay.removeAll(true);
            this.overlay.setVisible(false);
            this.spawnFloater(this.enemy.x, this.enemy.y - 30, gold, 'gold');
            this.launchUpgradeScreen();
        });
        this.overlay.add([bg, title, goldText, hintText, btnBg, btnLabel, zone]);
        this.overlay.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: this.overlay, alpha: 1, duration: 300 });
    }
    // ── Merchant floor ───────────────────────────────────────────────────────
    launchMerchantScene() {
        const data = {
            playerStats: this.player.stats,
            engine: this.engine,
            ownedUpgrades: this.owned,
            floor: this.floorManager.currentFloor,
        };
        this.events.once(Phaser.Scenes.Events.RESUME, () => {
            this.advanceFloor(); // advance past merchant floor into next combat floor
        });
        this.scene.launch('MerchantScene', data);
        this.scene.pause();
    }
    onPlayerDead() {
        // Clear any residual boss label so it doesn't linger on the game-over overlay
        this.updateEnemyPanelName('ENEMY', false);
        const floor = this.floorManager.currentFloor;
        const goldEarned = MetaService.earnedForFloor(floor);
        const durationMs = Date.now() - this.runStartTime;
        // ── Legacy meta progression (currency, permanent upgrades) ────────────
        metaService.recordRunEnd({ floor, kills: this.killCount, bossesDefeated: this.bossKillCount, goldEarned });
        // ── Platform run record ───────────────────────────────────────────────
        const profile = ServiceLocator.profile.getProfile();
        const cfg = getRunConfig();
        // Mode-aware score formula
        const score = cfg.modeId === 'boss_rush'
            ? this.bossKillCount * 100 + Math.floor(this.engine.totalDamageDealt / 10)
            : floor * 10 + this.killCount;
        const run = {
            id: this.generateRunId(),
            player_id: profile?.id ?? 'local',
            mode_id: cfg.modeId,
            class_id: this.currentClass?.id ?? 'unknown',
            floor_reached: floor,
            score,
            build_archetype: this.detectBuildName(),
            relics_owned: [...this.ownedRelics],
            keystone_owned: this.detectKeystone(),
            kills: this.killCount,
            bosses_killed: this.bossKillCount,
            damage_dealt: this.engine.totalDamageDealt,
            healing_done: this.engine.totalHealingDone,
            highest_hit: this.engine.highestDamageHit,
            duration_ms: durationMs,
            date: new Date().toISOString(),
            won: floor >= 20,
        };
        const { newTitles } = ServiceLocator.profile.recordRunEnd(run);
        ServiceLocator.history.addRun(run);
        this.showGameOverOverlay(floor, goldEarned, newTitles);
        this.input.keyboard?.once('keydown-R', () => this.scene.start('HomeScene'));
    }
    generateRunId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    detectKeystone() {
        for (const [id] of this.owned) {
            const upg = ALL_UPGRADES.find(u => u.id === id && u.tier === 'keystone');
            if (upg)
                return upg.name;
        }
        return null;
    }
    // ---------------------------------------------------------------------------
    // Scene construction
    // ---------------------------------------------------------------------------
    // ── Mode rule application ────────────────────────────────────────────────────
    applyModeRules() {
        const { modeId, rules } = getRunConfig();
        // One HP: override player stats before HUD reads them
        if (rules.maxHpOverride !== null) {
            this.player.stats.maxHp = rules.maxHpOverride;
            this.player.stats.hp = rules.maxHpOverride;
        }
        // Disable lifesteal (One HP mode — healing is a no-op at max=1 anyway,
        // but disabling explicitly prevents shield generation from Overcharge)
        if (rules.disableLifesteal) {
            this.player.stats.lifesteal = 0;
        }
        // Starting gold (Warlock class already gives 30 via class apply; this
        // is for future modes that grant gold)
        if (rules.startingGold > 0) {
            this.engine.addGold(rules.startingGold);
        }
        // Chaos mode: grant random relics before floor 1
        if (rules.forceRandomRelics > 0) {
            this.grantRandomRelics(rules.forceRandomRelics);
        }
        // Store mode ID so run results carry the right leaderboard target
        void modeId; // used via getRunConfig() in onPlayerDead
    }
    /** Grant N random relics from the pool (used for Chaos mode). */
    grantRandomRelics(count) {
        const available = ALL_RELICS.filter(r => !this.ownedRelics.has(r.id));
        const picks = [...available].sort(() => Math.random() - 0.5).slice(0, count);
        picks.forEach(relic => {
            relic.onAcquire(this.player.stats, this.engine);
            this.engine.registerRelic(relic.id);
            this.engine.registerUpgrade(relic.id);
            this.ownedRelics.add(relic.id);
        });
    }
    createEntities() {
        this.player = new Player(this, PLAYER_X, COMBAT_Y);
        // Nightmare: skip permanent upgrade bonuses so meta progression has no effect
        if (!getRunConfig().rules.noMetaBonuses) {
            metaService.applyBonus(this.player.stats);
        }
        this.engine = new RulesEngine(this.player.stats);
        this.enemy = new Enemy(this, ENEMY_X, COMBAT_Y, this.floorManager.buildEnemyConfig());
    }
    drawBackground() {
        const g = this.add.graphics();
        // Base background
        g.fillStyle(0x0d0d1f);
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        // Top bar surface
        g.fillStyle(0x0c0c1e);
        g.fillRect(0, 0, GAME_WIDTH, HEADER_H);
        g.lineStyle(1, 0x1e1e36);
        g.lineBetween(0, HEADER_H, GAME_WIDTH, HEADER_H);
        // Bottom info bar surface
        g.fillStyle(0x0b0b1c);
        g.fillRect(0, BOT_BAR_Y, GAME_WIDTH, GAME_HEIGHT - BOT_BAR_Y);
        g.lineStyle(1, 0x1a1a30);
        g.lineBetween(0, BOT_BAR_Y, GAME_WIDTH, BOT_BAR_Y);
        // Subtle arena ground line
        g.lineStyle(1, 0x1e1e36);
        g.lineBetween(16, COMBAT_Y + 44, GAME_WIDTH - 16, COMBAT_Y + 44);
        // Player / enemy zone divider (very subtle)
        g.lineStyle(1, 0x111120);
        g.lineBetween(GAME_WIDTH / 2, HP_PANEL_Y + HP_PANEL_H + 4, GAME_WIDTH / 2, BOT_BAR_Y - 4);
    }
    // ---------------------------------------------------------------------------
    // HUD
    // ---------------------------------------------------------------------------
    createHUD() {
        // ── Top bar ───────────────────────────────────────────────────────────────
        this.floorLabel = this.add.text(GAME_WIDTH / 2, 13, 'Floor 1', {
            fontSize: '15px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5, 0);
        // Class badge — top-left with subtle colour background
        if (this.currentClass) {
            const cls = this.currentClass;
            const badgeBg = this.add.graphics();
            badgeBg.fillStyle(cls.color, 0.12);
            badgeBg.fillRoundedRect(4, 6, 114, 18, 3);
            badgeBg.lineStyle(1, cls.color, 0.25);
            badgeBg.strokeRoundedRect(4, 6, 114, 18, 3);
            this.add.text(10, 15, `${cls.icon}  ${cls.name.toUpperCase()}`, {
                fontSize: '9px', color: intToHex(cls.color), fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0, 0.5);
        }
        // enemyNameLabel kept for advanceFloor compat — positioned off-screen
        this.enemyNameLabel = this.add.text(0, -999, '').setVisible(false);
        // Mode badge — shown top-centre when not classic
        const { modeId } = getRunConfig();
        if (modeId && modeId !== 'classic') {
            const modeCfg = getModeById(modeId);
            const badgeBg = this.add.graphics();
            const label = `${modeCfg.icon}  ${modeCfg.name.toUpperCase()}`;
            const bw = label.length * 6 + 16;
            const bx = GAME_WIDTH / 2;
            badgeBg.fillStyle(modeCfg.color, 0.15);
            badgeBg.fillRoundedRect(bx - bw / 2, 6, bw, 18, 3);
            badgeBg.lineStyle(1, modeCfg.color, 0.4);
            badgeBg.strokeRoundedRect(bx - bw / 2, 6, bw, 18, 3);
            this.add.text(bx, 15, label, {
                fontSize: '8px', color: intToHex(modeCfg.color),
                fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0.5);
        }
        this.buildModifierStrip();
        this.buildHpPanels();
        this.buildBottomBar();
        this.redrawHpPanels();
        this.redrawModifierStrip();
    }
    // ── Modifier strip ──────────────────────────────────────────────────────────
    buildModifierStrip() {
        this.modStripBg = this.add.graphics();
        this.modStripName = this.add.text(10, MOD_STRIP_Y + MOD_STRIP_H / 2, '', {
            fontSize: '9px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.modStripDesc = this.add.text(0, MOD_STRIP_Y + MOD_STRIP_H / 2, '', {
            fontSize: '8px', color: '#666688', fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
    }
    redrawModifierStrip() {
        const mod = this.floorManager.currentModifier;
        this.modStripBg.clear();
        if (mod && !mod.skipCombat) {
            const col = mod.color;
            this.modStripBg.fillStyle(col, 0.07);
            this.modStripBg.fillRect(0, MOD_STRIP_Y, GAME_WIDTH, MOD_STRIP_H);
            this.modStripBg.fillStyle(col, 0.55);
            this.modStripBg.fillRect(0, MOD_STRIP_Y, 3, MOD_STRIP_H);
            this.modStripName.setText(mod.name).setColor(intToHex(col)).setVisible(true);
            // Name takes ~130px; description fills the rest
            const nameWidth = 132;
            const maxDescW = GAME_WIDTH - nameWidth - 14;
            const desc = truncateText(mod.description, maxDescW, 8);
            this.modStripDesc
                .setText(desc)
                .setX(nameWidth + 6)
                .setVisible(true);
        }
        else {
            this.modStripName.setVisible(false);
            this.modStripDesc.setVisible(false);
        }
    }
    // ── HP panels ───────────────────────────────────────────────────────────────
    buildHpPanels() {
        this.hpPanelLeft = this.add.graphics();
        this.hpPanelRight = this.add.graphics();
        const panY = HP_PANEL_Y;
        const nameY = panY + 11;
        const hpY = panY + 11;
        const pipY = panY + 44;
        // Player panel texts
        this.add.text(HP_L_X + 8, nameY, 'PLAYER', {
            fontSize: '9px', color: '#4fc3f7', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.playerPanelHp = this.add.text(HP_L_X + HP_PANEL_W - 8, hpY, '', {
            fontSize: '9px', color: '#9999bb', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        // Enemy panel texts — enemy name updates via updateEnemyPanelName()
        this.enemyPanelName = this.add.text(HP_R_X + 8, nameY, 'ENEMY', {
            fontSize: '9px', color: '#ef5350', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.enemyPanelHp = this.add.text(HP_R_X + HP_PANEL_W - 8, hpY, '', {
            fontSize: '9px', color: '#9999bb', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        // Status pips (enemy)
        this.enemyPoisonPip = this.add.text(HP_R_X + 8, pipY, '', {
            fontSize: '8px', color: '#9b59b6', fontFamily: 'monospace',
        }).setOrigin(0, 0.5).setVisible(false);
        this.enemyBurnPip = this.add.text(HP_R_X + 72, pipY, '', {
            fontSize: '8px', color: '#e67e22', fontFamily: 'monospace',
        }).setOrigin(0, 0.5).setVisible(false);
    }
    redrawHpPanels() {
        const p = this.player.stats;
        const e = this.enemy.stats;
        const isSpecial = e.maxHp >= 999999; // special/dummy enemy on non-combat floors
        const barX = 8;
        const barW = HP_PANEL_W - 16;
        const barY = HP_PANEL_Y + 22;
        const barH = 8;
        // ── Player panel ───────────────────────────────────────────────────────
        const pRatio = p.maxHp > 0 ? Math.max(0, Math.min(1, p.hp / p.maxHp)) : 0;
        this.hpPanelLeft.clear();
        this.hpPanelLeft.fillStyle(0x0c0c1e);
        this.hpPanelLeft.fillRoundedRect(HP_L_X, HP_PANEL_Y, HP_PANEL_W, HP_PANEL_H, 5);
        this.hpPanelLeft.lineStyle(1, 0x1a1a30);
        this.hpPanelLeft.strokeRoundedRect(HP_L_X, HP_PANEL_Y, HP_PANEL_W, HP_PANEL_H, 5);
        // Accent bar (player blue)
        this.hpPanelLeft.fillStyle(0x4fc3f7);
        this.hpPanelLeft.fillRect(HP_L_X, HP_PANEL_Y, HP_PANEL_W, 3);
        // Bar track
        this.hpPanelLeft.fillStyle(0x12121e);
        this.hpPanelLeft.fillRoundedRect(HP_L_X + barX, barY, barW, barH, 3);
        // Bar fill
        if (pRatio > 0) {
            const col = pRatio > 0.5 ? 0x2ecc71 : pRatio > 0.25 ? 0xf39c12 : 0xe74c3c;
            this.hpPanelLeft.fillStyle(col);
            this.hpPanelLeft.fillRoundedRect(HP_L_X + barX, barY, Math.max(4, Math.floor(barW * pRatio)), barH, 3);
        }
        this.playerPanelHp.setText(isSpecial ? '' : `${p.hp} / ${p.maxHp}`);
        // ── Enemy panel ────────────────────────────────────────────────────────
        const eRatio = !isSpecial && e.maxHp > 0
            ? Math.max(0, Math.min(1, e.hp / e.maxHp))
            : 0;
        this.hpPanelRight.clear();
        this.hpPanelRight.fillStyle(0x0c0c1e);
        this.hpPanelRight.fillRoundedRect(HP_R_X, HP_PANEL_Y, HP_PANEL_W, HP_PANEL_H, 5);
        this.hpPanelRight.lineStyle(1, 0x1a1a30);
        this.hpPanelRight.strokeRoundedRect(HP_R_X, HP_PANEL_Y, HP_PANEL_W, HP_PANEL_H, 5);
        // Accent bar (enemy red)
        this.hpPanelRight.fillStyle(0xef5350);
        this.hpPanelRight.fillRect(HP_R_X, HP_PANEL_Y, HP_PANEL_W, 3);
        // Bar track
        this.hpPanelRight.fillStyle(0x12121e);
        this.hpPanelRight.fillRoundedRect(HP_R_X + barX, barY, barW, barH, 3);
        // Bar fill
        if (eRatio > 0) {
            const col = eRatio > 0.5 ? 0xe74c3c : eRatio > 0.25 ? 0xe67e22 : 0xff6b6b;
            this.hpPanelRight.fillStyle(col);
            this.hpPanelRight.fillRoundedRect(HP_R_X + barX, barY, Math.max(4, Math.floor(barW * eRatio)), barH, 3);
        }
        this.enemyPanelHp.setText(isSpecial ? '' : `${e.hp} / ${e.maxHp}`);
    }
    // ── Bottom info bar ──────────────────────────────────────────────────────────
    buildBottomBar() {
        const rowA = BOT_BAR_Y + 10; // gold + keyboard hints
        const rowB = BOT_BAR_Y + 28; // relic chips + XP bar
        // Gold
        this.add.text(8, rowA, 'GOLD', {
            fontSize: '8px', color: '#555577', fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        this.goldHudText = this.add.text(38, rowA, '★ 0', {
            fontSize: '10px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        // Keyboard hints (right side)
        this.add.text(GAME_WIDTH - 6, rowA, '[B] Build  [Tab] Stats', {
            fontSize: '8px', color: '#444466', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        // Relic strip (left, shortened to leave room for XP)
        this.relicHudText = this.add.text(8, rowB, 'RELICS: none', {
            fontSize: '8px', color: '#444466', fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        // XP bar — bottom-right corner of bottom bar
        const XP_BAR_W = 100;
        const XP_BAR_H = 5;
        const XP_BAR_X = GAME_WIDTH - XP_BAR_W - 8;
        const XP_BAR_Y = rowB - XP_BAR_H / 2;
        // Track background
        const xpBg = this.add.graphics();
        xpBg.fillStyle(0x12121e);
        xpBg.fillRoundedRect(XP_BAR_X, XP_BAR_Y, XP_BAR_W, XP_BAR_H, 2);
        // Fill (updated each frame)
        this.xpBarFill = this.add.graphics();
        // Level label
        this.xpLevelText = this.add.text(XP_BAR_X - 4, rowB, 'Lv 0', {
            fontSize: '8px', color: '#444466', fontFamily: 'monospace',
        }).setOrigin(1, 0.5);
        // Store geometry for per-frame refresh
        this['_xpBarX'] = XP_BAR_X;
        this['_xpBarY'] = XP_BAR_Y;
        this['_xpBarW'] = XP_BAR_W;
        this['_xpBarH'] = XP_BAR_H;
    }
    // ── Speed control buttons ────────────────────────────────────────────────
    createSpeedButtons() {
        const speeds = [1, 1.5, 2];
        const labels = ['1×', '1.5×', '2×'];
        const btnW = 34;
        const btnH = 16;
        const gap = 3;
        // Top-right, below the floor label
        const startX = GAME_WIDTH - (btnW + gap) * 3 + gap / 2;
        const btnY = 12;
        speeds.forEach((speed, i) => {
            const cx = startX + i * (btnW + gap) + btnW / 2;
            const bg = this.add.graphics();
            const label = this.add.text(cx, btnY + btnH / 2, labels[i], {
                fontSize: '9px', color: '#ffffff', fontFamily: 'monospace',
            }).setOrigin(0.5);
            const container = this.add.container(0, 0, [bg, label]);
            this.speedBtns.push(container);
            const drawBtn = (active, hover) => {
                bg.clear();
                const fill = active ? 0x1e3a1e : hover ? 0x1a1a30 : 0x0e0e1a;
                const stroke = active ? 0x2ecc71 : hover ? 0x4444aa : 0x222240;
                bg.fillStyle(fill);
                bg.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 3);
                bg.lineStyle(1, stroke);
                bg.strokeRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 3);
                label.setColor(active ? '#2ecc71' : hover ? '#aaaacc' : '#555577');
            };
            drawBtn(speed === 1, false); // 1× active by default
            const zone = this.add.zone(cx, btnY + btnH / 2, btnW, btnH).setInteractive({ cursor: 'pointer' });
            zone.on('pointerover', () => drawBtn(this.gameSpeed === speed, true));
            zone.on('pointerout', () => drawBtn(this.gameSpeed === speed, false));
            zone.on('pointerdown', () => {
                this.setGameSpeed(speed);
            });
        });
    }
    // BUG #3: speed controls affect ONLY simulation time scaling (gameSpeed).
    // They must NEVER touch s.attackSpeed or any engine stat.
    // playerSpeedMultiplier is a floor-modifier stat effect — separate concern.
    setGameSpeed(speed) {
        this.gameSpeed = speed;
        // Redraw all buttons to reflect new active state
        const speeds = [1, 1.5, 2];
        const labels = ['1×', '1.5×', '2×'];
        const btnW = 34;
        const btnH = 16;
        const gap = 3;
        const startX = GAME_WIDTH - (btnW + gap) * 3 + gap / 2;
        const btnY = 12;
        this.speedBtns.forEach((container, i) => {
            const cx = startX + i * (btnW + gap) + btnW / 2;
            const active = speeds[i] === speed;
            const bg = container.list[0];
            const label = container.list[1];
            bg.clear();
            const fill = active ? 0x1e3a1e : 0x0e0e1a;
            const stroke = active ? 0x2ecc71 : 0x222240;
            bg.fillStyle(fill);
            bg.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 3);
            bg.lineStyle(1, stroke);
            bg.strokeRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 3);
            label.setColor(active ? '#2ecc71' : '#555577');
            void labels[i];
        });
    }
    refreshHpTexts() {
        this.redrawHpPanels();
    }
    updateModifierLabel() {
        this.redrawModifierStrip();
    }
    updateRelicHud() {
        if (this.ownedRelics.size === 0) {
            this.relicHudText.setText('RELICS: none').setColor('#444466');
            return;
        }
        const names = [...this.ownedRelics]
            .map(id => {
            const def = ALL_RELICS.find(r => r.id === id);
            return `◈ ${def ? def.name : id}`;
        })
            .join('  ');
        this.relicHudText.setText(names).setColor('#ffd700');
    }
    /** Called by advanceFloor when a new enemy spawns. Updates the panel name label. */
    updateEnemyPanelName(label, isBoss) {
        if (isBoss) {
            this.enemyPanelName
                .setText(label.length > 22 ? label.slice(0, 20) + '…' : label)
                .setColor('#ffd700');
        }
        else {
            this.enemyPanelName.setText('ENEMY').setColor('#ef5350');
        }
    }
    // ---------------------------------------------------------------------------
    // Overlays
    // ---------------------------------------------------------------------------
    createOverlay() {
        this.overlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this.overlay.setVisible(false);
    }
    showFloorClearOverlay(floor) {
        this.overlay.removeAll(true);
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.82);
        bg.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
        const cleared = this.add.text(0, -52, 'FLOOR CLEARED', {
            fontSize: '40px', color: '#2ecc71',
            fontFamily: 'monospace', fontStyle: 'bold',
            stroke: '#0a1a0a', strokeThickness: 4,
        }).setOrigin(0.5);
        const rule = this.add.graphics();
        rule.lineStyle(1, 0x1a6a3a);
        rule.lineBetween(-160, -80, 160, -80);
        const sub = this.add.text(0, 18, `Floor ${floor}`, {
            fontSize: '22px', color: '#5a5a88', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.overlay.add([bg, rule, cleared, sub]);
        this.overlay.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: this.overlay, alpha: 1, duration: 300, ease: 'Power2' });
    }
    showGameOverOverlay(floor, earned, newTitles = []) {
        this.overlay.removeAll(true);
        const PW = 320;
        const PH = 340;
        const hx = -PW / 2;
        const hy = -PH / 2;
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.88);
        bg.fillRoundedRect(hx, hy, PW, PH, 10);
        bg.lineStyle(1, 0x252540);
        bg.strokeRoundedRect(hx, hy, PW, PH, 10);
        const title = this.add.text(0, hy + 22, 'GAME OVER', {
            fontSize: '26px', color: '#e74c3c', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        // Build identity line
        const buildName = this.detectBuildName();
        const classLine = this.currentClass
            ? `${this.currentClass.icon}  ${this.currentClass.name.toUpperCase()}  ·  ${buildName}`
            : buildName;
        const classText = this.add.text(0, hy + 56, classLine, {
            fontSize: '10px', color: '#9b59b6', fontFamily: 'monospace',
        }).setOrigin(0.5);
        // Divider
        const div1 = this.add.graphics();
        div1.lineStyle(1, 0x1a1a30);
        div1.lineBetween(hx + 16, hy + 72, hx + PW - 16, hy + 72);
        // Primary stat: "Bosses Cleared" for Boss Rush, "Floor reached" for all others
        const { modeId: deadModeId } = getRunConfig();
        const primaryLabel = deadModeId === 'boss_rush' ? 'BOSSES CLEARED' : 'FLOOR';
        const primaryValue = deadModeId === 'boss_rush' ? `${this.bossKillCount}` : `${floor}`;
        const floorLabel = this.add.text(-60, hy + 98, primaryLabel, {
            fontSize: '9px', color: '#555577', fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        const floorNum = this.add.text(-60, hy + 116, primaryValue, {
            fontSize: '28px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0);
        const bestFloor = metaService.highestFloor;
        const bestLabel = this.add.text(60, hy + 98, 'BEST', {
            fontSize: '9px', color: '#333355', fontFamily: 'monospace',
        }).setOrigin(0, 0.5);
        const bestNum = this.add.text(60, hy + 116, `${bestFloor}`, {
            fontSize: '28px', color: '#333355', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0);
        const div2 = this.add.graphics();
        div2.lineStyle(1, 0x1a1a30);
        div2.lineBetween(hx + 16, hy + 152, hx + PW - 16, hy + 152);
        // Combat stats row
        const statY = hy + 166;
        const statTexts = [
            [`${this.killCount}`, 'KILLS'],
            [`${this.bossKillCount}`, 'BOSSES'],
            [`${this.engine.highestDamageHit}`, 'TOP HIT'],
            [`${this.engine.totalHealingDone}`, 'HEALED'],
        ];
        const colW = PW / 4;
        const statObjs = [];
        statTexts.forEach(([val, lbl], i) => {
            const cx = hx + colW * i + colW / 2;
            statObjs.push(this.add.text(cx, statY, val, { fontSize: '14px', color: '#e0e0e0', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5, 0), this.add.text(cx, statY + 18, lbl, { fontSize: '8px', color: '#555577', fontFamily: 'monospace' }).setOrigin(0.5, 0));
        });
        const div3 = this.add.graphics();
        div3.lineStyle(1, 0x1a1a30);
        div3.lineBetween(hx + 16, hy + 206, hx + PW - 16, hy + 206);
        // Relics
        const relicNames = [...this.ownedRelics]
            .map(id => { const d = ALL_RELICS.find(r => r.id === id); return d ? d.name : id; })
            .join('  ·  ');
        const relicText = relicNames
            ? this.add.text(0, hy + 220, `◈  ${relicNames}`, { fontSize: '8px', color: '#ffd700', fontFamily: 'monospace', wordWrap: { width: PW - 32 }, align: 'center' }).setOrigin(0.5, 0)
            : this.add.text(0, hy + 220, 'No relics found', { fontSize: '8px', color: '#333355', fontFamily: 'monospace' }).setOrigin(0.5, 0);
        const div4 = this.add.graphics();
        div4.lineStyle(1, 0x1a1a30);
        div4.lineBetween(hx + 16, hy + 248, hx + PW - 16, hy + 248);
        // Currency earned
        const earnedLabel = this.add.text(-20, hy + 264, 'EARNED', { fontSize: '8px', color: '#555577', fontFamily: 'monospace' }).setOrigin(1, 0.5);
        const earnedVal = this.add.text(-14, hy + 264, `+${earned} ★`, { fontSize: '13px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0, 0.5);
        const hint = this.add.text(0, hy + PH - 22, 'Press R to return to hub', {
            fontSize: '9px', color: '#333355', fontFamily: 'monospace',
        }).setOrigin(0.5);
        const allObjs = [
            bg, title, classText, div1,
            floorLabel, floorNum, bestLabel, bestNum, div2,
            ...statObjs, div3, relicText, div4,
            earnedLabel, earnedVal, hint,
        ];
        // ── Milestone unlock banner ────────────────────────────────────────────
        if (newTitles.length > 0) {
            const titleName = newTitles[0]; // show first unlock
            const unlockBg = this.add.graphics();
            unlockBg.fillStyle(0x0d2a18);
            unlockBg.fillRoundedRect(-150, hy + PH - 56, 300, 26, 4);
            unlockBg.lineStyle(1, 0x2ecc71);
            unlockBg.strokeRoundedRect(-150, hy + PH - 56, 300, 26, 4);
            const unlockText = this.add.text(0, hy + PH - 43, `✦ Title unlocked: ${titleName}`, {
                fontSize: '10px', color: '#2ecc71', fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0.5);
            allObjs.push(unlockBg, unlockText);
        }
        this.overlay.add(allObjs);
        this.overlay.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: this.overlay, alpha: 1, duration: 300 });
    }
    /** Detect the player's build archetype from owned upgrades. */
    detectBuildName() {
        // Simpler: count by tag occurrence across owned upgrade IDs
        const poisonIds = ['venom_tips', 'toxic_coating', 'plague_carrier', 'reactive_venom', 'poison_lord'];
        const critIds = ['eagle_eye', 'precision', 'predators_mark', 'speed_to_crit', 'eternal_crit'];
        const lightIds = ['static_charge', 'spark', 'overload', 'ball_lightning', 'thunder_engine'];
        const burnIds = ['kindling', 'igniter', 'backdraft', 'conflagration', 'spontaneous_combustion', 'phoenix_protocol'];
        const summonIds = ['familiar', 'pack_leader', 'coordinated_strike', 'lich_form'];
        const defIds = ['iron_skin', 'reactive_plating', 'living_wall', 'diamond_body'];
        const count = (ids) => ids.filter(id => (this.owned.get(id) ?? 0) > 0).length;
        const p = count(poisonIds), c = count(critIds), l = count(lightIds), b = count(burnIds), s = count(summonIds), d = count(defIds);
        if (p >= 3 && c >= 2)
            return 'Toxic Criticals';
        if (p >= 3)
            return 'Endless Plague';
        if (c >= 3)
            return 'Critical Strike';
        if (l >= 3)
            return 'Lightning Storm';
        if (b >= 3)
            return 'Pyromaniac';
        if (s >= 2)
            return 'Battle Commander';
        if (d >= 3)
            return 'Iron Fortress';
        return 'Mixed Build';
    }
    hideOverlay() {
        this.tweens.killTweensOf(this.overlay);
        this.overlay.setVisible(false);
        this.overlay.setAlpha(1);
    }
    refreshXPBar() {
        const rec = this;
        const x = rec['_xpBarX'];
        const y = rec['_xpBarY'];
        const w = rec['_xpBarW'];
        const h = rec['_xpBarH'];
        if (x === undefined)
            return;
        const progress = this.xpManager.xpProgress;
        this.xpBarFill.clear();
        if (progress > 0) {
            this.xpBarFill.fillStyle(0x4fc3f7, 0.7);
            this.xpBarFill.fillRoundedRect(x, y, Math.max(2, Math.floor(w * progress)), h, 2);
        }
        this.xpLevelText.setText(`Lv ${this.xpManager.currentLevel}`);
    }
    // ---------------------------------------------------------------------------
    // Announcements
    // ---------------------------------------------------------------------------
    announceFloor() {
        const mod = this.floorManager.currentModifier;
        const label = mod
            ? `FLOOR ${this.floorManager.currentFloor}  ${mod.name}`
            : `FLOOR ${this.floorManager.currentFloor}`;
        const color = mod ? intToHex(mod.color) : '#ffffff';
        const text = this.add
            .text(GAME_WIDTH / 2, COMBAT_Y - 90, label, {
            fontSize: '26px', color, fontFamily: 'monospace', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4,
        })
            .setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: text, alpha: 1, duration: 250, yoyo: true, hold: 600, onComplete: () => text.destroy() });
    }
    announceBoss(bossLabel) {
        const card = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.72);
        bg.fillRoundedRect(-150, -44, 300, 88, 8);
        bg.lineStyle(1, 0x9b59b6);
        bg.strokeRoundedRect(-150, -44, 300, 88, 8);
        const warning = this.add.text(0, -18, '⚠  BOSS ENCOUNTER', { fontSize: '12px', color: '#e74c3c', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5);
        const name = this.add.text(0, 14, bossLabel, { fontSize: '20px', color: '#9b59b6', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5);
        card.add([bg, warning, name]);
        card.setAlpha(0);
        this.tweens.add({ targets: card, alpha: 1, duration: 300, yoyo: true, hold: 1800, onComplete: () => card.destroy() });
    }
    // ---------------------------------------------------------------------------
    // Floating damage numbers
    // ---------------------------------------------------------------------------
    spawnFloater(x, y, value, type) {
        if (value <= 0)
            return;
        const cfg = {
            damage: { color: '#ffffff', size: '14px' },
            crit: { color: '#FFD700', size: '22px' }, // crits are visually distinct: larger + gold
            heal: { color: '#2ecc71', size: '14px' },
            poison: { color: '#9b59b6', size: '12px' },
            burn: { color: '#e67e22', size: '12px' },
            lightning: { color: '#3498db', size: '14px' },
            area: { color: '#bdc3c7', size: '11px' },
            reflect: { color: '#95a5a6', size: '11px' },
            summon: { color: '#4fc3f7', size: '12px' },
            gold: { color: '#ffd700', size: '13px' },
            shield: { color: '#5dade2', size: '13px' },
        };
        const { color, size } = cfg[type];
        const prefix = (type === 'heal' || type === 'gold' || type === 'shield') ? '+' : '';
        const label = this.add
            .text(x + Phaser.Math.Between(-12, 12), y, `${prefix}${value}`, {
            fontSize: size,
            color,
            fontFamily: 'monospace',
            fontStyle: type === 'crit' ? 'bold' : 'normal',
            stroke: '#000000',
            strokeThickness: 3,
        })
            .setOrigin(0.5);
        this.tweens.add({
            targets: label, y: label.y - 50, alpha: 0,
            duration: 900, ease: 'Power1',
            onComplete: () => label.destroy(),
        });
    }
}
function intToHex(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}
/**
 * Rough character-count truncation for HUD text that must fit a pixel budget.
 * 8px monospace ≈ 6px per char, so maxPixels / 6 ≈ char budget.
 */
function truncateText(text, maxPixels, _fontSize) {
    const charBudget = Math.floor(maxPixels / 5.6);
    return text.length <= charBudget ? text : text.slice(0, charBudget - 1) + '…';
}
