import { rollFloorModifier, buildSpecialEnemyStats } from './FloorModifier';
/**
 * FloorManager — pure game-logic class, zero Phaser dependency.
 *
 * Regular enemy scaling (linear):
 *   HP        +20% per floor
 *   Damage    +12% per floor
 *   AtkSpeed  +0.05/s per floor (capped at 2.5)
 *   Armor     +1 every 3 floors
 *
 * Boss floors (every 10th by default, configurable via bossEveryNFloors):
 *   Three hand-tuned bosses at floors 10, 20, 30.
 *   Floors beyond 30 fall back to a scaled formula so the game
 *   never hard-errors even if no specific boss is defined.
 *
 * Balance notes (player has 3 upgrades per 9 floors):
 *   Floor 10 boss → survivable with a focused damage or HP build.
 *   Floor 20 boss → requires 6 solid upgrades.
 *   Floor 30 boss → hard cap for MVP; tuned for near-perfect builds.
 */
export class FloorManager {
    constructor(options = {}) {
        this._currentFloor = 1;
        this._currentModifier = null;
        this._bossesOnly = options.bossesOnly ?? false;
        this._allFloorsModified = options.allFloorsModified ?? false;
        this._bossEveryNFloors = options.bossEveryNFloors ?? 10;
        this._enemyHpMultiplier = options.enemyHpMultiplier ?? 1;
        this._enemyDamageMultiplier = options.enemyDamageMultiplier ?? 1;
        this._enemySpeedMultiplier = options.enemySpeedMultiplier ?? 1;
        this._getRandomMonsterCellKey = options.getRandomMonsterCellKey ?? null;
        this._getRandomBossCellKey = options.getRandomBossCellKey ?? null;
    }
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    get currentFloor() {
        return this._currentFloor;
    }
    get currentModifier() {
        return this._currentModifier;
    }
    isBossFloor() {
        return this._currentFloor % this._bossEveryNFloors === 0;
    }
    /**
     * Relic floors: floor 5 then every 10 floors (15, 25, 35…).
     * Boss clears (floor % bossEveryNFloors === 0) also award a relic.
     */
    isRelicFloor() {
        const f = this._currentFloor;
        const n = this._bossEveryNFloors;
        return f % n === 0 || f % n === Math.floor(n / 2);
    }
    advance() {
        this._currentFloor++;
        // Roll a modifier for the next floor.
        // In allFloorsModified mode every floor gets one; otherwise boss floors skip.
        if (this._allFloorsModified || !this.isBossFloor()) {
            this._currentModifier = rollFloorModifier(this._currentFloor);
        }
        else {
            this._currentModifier = null;
        }
    }
    /**
     * Returns the full spawn config for the current floor's enemy.
     * GameScene passes this straight to the Enemy constructor.
     */
    buildEnemyConfig() {
        // Boss Rush: every floor is a boss — delegate to buildBossConfig()
        if (this._bossesOnly) {
            return this.buildBossConfig();
        }
        // Special floors (treasure, merchant) use a harmless dummy enemy
        if (this._currentModifier?.skipCombat) {
            return { stats: buildSpecialEnemyStats(), isBoss: false, bossLabel: '' };
        }
        if (this.isBossFloor()) {
            return this.buildBossConfig();
        }
        const base = this.buildRegularStats();
        // Apply current modifier mutations (if any) to the enemy
        if (this._currentModifier?.mutateEnemy) {
            this._currentModifier.mutateEnemy(base);
        }
        return {
            stats: base,
            isBoss: false,
            bossLabel: '',
            sprite: {
                textureKey: this._getRandomMonsterCellKey?.() ?? 'enemy',
            },
        };
    }
    /**
     * Builds a boss EnemyConfig for the current floor.
     * In Boss Rush mode, tier = currentFloor (boss 1 ≈ floor-10-equivalent).
     * In standard mode, uses hand-tuned stats at floors 10/20/30, then scaled formula.
     */
    buildBossConfig() {
        let stats;
        let bossLabel;
        if (this._bossesOnly) {
            // Boss Rush: tier index = current floor (1-based), scales from tier 1 upward
            stats = this.buildScaledBossStats(this._currentFloor);
            bossLabel = `BOSS ${this._currentFloor}`;
        }
        else {
            stats = { ...(FloorManager.BOSS_STATS[this._currentFloor] ??
                    this.buildScaledBossStats(this._currentFloor / this._bossEveryNFloors)) };
            bossLabel =
                FloorManager.BOSS_NAMES[this._currentFloor] ??
                    `FLOOR ${this._currentFloor} BOSS`;
        }
        const isFirstBossFloor = !this._bossesOnly && this._currentFloor === this._bossEveryNFloors;
        const bossSprite = isFirstBossFloor && this._getRandomBossCellKey
            ? { textureKey: this._getRandomBossCellKey() }
            : {
                textureKey: 'boss_sheet',
                frame: this._bossesOnly
                    ? Math.floor(Math.random() * (4 * 4))
                    : (this._currentFloor - 1) % (4 * 4),
            };
        return {
            stats: { ...stats },
            isBoss: true,
            bossLabel,
            sprite: bossSprite,
        };
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    buildRegularStats() {
        const f = this._currentFloor;
        const hp = Math.floor(60 * (1 + 0.2 * (f - 1)) * this._enemyHpMultiplier);
        return {
            maxHp: hp,
            hp,
            damage: Math.floor(8 * (1 + 0.12 * (f - 1)) * this._enemyDamageMultiplier),
            attackSpeed: Math.min(2.5, (0.9 + 0.05 * (f - 1)) * this._enemySpeedMultiplier),
            armor: 2 + Math.floor((f - 1) / 3),
            critChance: 0,
            critMultiplier: 2.0,
        };
    }
    /**
     * Scaled boss stats used for floors beyond the hand-tuned set (30+) and for Boss Rush.
     * @param tier  Boss tier: 1 = floor-10 equivalent, 2 = floor-20 equivalent, etc.
     */
    buildScaledBossStats(tier) {
        const hp = Math.floor(280 * (1 + 0.8 * (tier - 1)) * this._enemyHpMultiplier);
        return {
            maxHp: hp, hp,
            damage: Math.floor(13 * (1 + 0.6 * (tier - 1)) * this._enemyDamageMultiplier),
            attackSpeed: Math.min(2.0, (0.7 + 0.08 * (tier - 1)) * this._enemySpeedMultiplier),
            armor: 4 + 6 * (tier - 1),
            critChance: Math.min(0.4, 0.08 + 0.04 * (tier - 1)),
            critMultiplier: 2.0,
        };
    }
}
// ---------------------------------------------------------------------------
// Boss definitions
// ---------------------------------------------------------------------------
FloorManager.BOSS_STATS = {
    10: {
        maxHp: 280, hp: 280,
        damage: 13, attackSpeed: 0.7,
        armor: 4, critChance: 0.08, critMultiplier: 2.0,
    },
    20: {
        maxHp: 650, hp: 650,
        damage: 24, attackSpeed: 0.8,
        armor: 10, critChance: 0.12, critMultiplier: 2.0,
    },
    30: {
        maxHp: 1200, hp: 1200,
        damage: 38, attackSpeed: 0.9,
        armor: 18, critChance: 0.16, critMultiplier: 2.0,
    },
};
FloorManager.BOSS_NAMES = {
    10: 'FLOOR GUARDIAN',
    20: 'ANCIENT HORROR',
    30: 'VOID TITAN',
};
