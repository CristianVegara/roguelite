import { CombatStats } from '../combat/CombatStats';
import { FloorModifier, rollFloorModifier, buildSpecialEnemyStats } from './FloorModifier';

/**
 * Describes everything GameScene needs to spawn an enemy for the current floor.
 * Defined here so FloorManager owns the full config without importing from entities.
 */
export interface EnemySpriteConfig {
  sheet: string;
  frame?: number;
}

export interface EnemyConfig {
  stats: CombatStats;
  isBoss: boolean;
  /** Display name shown in the HUD and boss intro. Empty for regular enemies. */
  bossLabel: string;
  sprite?: EnemySpriteConfig;
}

/**
 * Options passed to FloorManager to configure mode-specific behaviour.
 * All fields are optional; unset fields fall back to normal defaults.
 */
export interface FloorManagerOptions {
  /** Boss Rush: every floor is a boss, scaled by boss index not floor number. */
  bossesOnly?:             boolean;
  /** Nightmare: every floor always has a modifier, even boss floors. */
  allFloorsModified?:      boolean;
  /** Nightmare: boss floors appear every N floors instead of the default 10. */
  bossEveryNFloors?:       number;
  /** Nightmare: multiply enemy base HP by this factor. */
  enemyHpMultiplier?:      number;
  /** Nightmare: multiply enemy base damage by this factor. */
  enemyDamageMultiplier?:  number;
  /** Nightmare: multiply enemy attack speed by this factor. */
  enemySpeedMultiplier?:   number;
  /** Determines which monster sprite sheet to use for regular enemies. */
  monsterSheet?:           'monster_sheet_1' | 'monster_sheet_2' | 'monster_sheet_3';
  /** Optional callback to choose a random boss cell texture key for the first boss floor. */
  getRandomBossCellKey?:  () => string;
}

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
  private _currentFloor = 1;
  private _currentModifier: FloorModifier | null = null;

  private readonly _bossesOnly:             boolean;
  private readonly _allFloorsModified:       boolean;
  private readonly _bossEveryNFloors:        number;
  private readonly _enemyHpMultiplier:       number;
  private readonly _enemyDamageMultiplier:   number;
  private readonly _enemySpeedMultiplier:    number;

  private readonly _monsterSheet: 'monster_sheet_1' | 'monster_sheet_2' | 'monster_sheet_3';
  private readonly _getRandomBossCellKey: (() => string) | null;

  constructor(options: FloorManagerOptions = {}) {
    this._bossesOnly            = options.bossesOnly            ?? false;
    this._allFloorsModified     = options.allFloorsModified      ?? false;
    this._bossEveryNFloors      = options.bossEveryNFloors       ?? 10;
    this._enemyHpMultiplier     = options.enemyHpMultiplier      ?? 1;
    this._enemyDamageMultiplier = options.enemyDamageMultiplier  ?? 1;
    this._enemySpeedMultiplier  = options.enemySpeedMultiplier   ?? 1;
    this._monsterSheet          = options.monsterSheet          ?? 'monster_sheet_1';
    this._getRandomBossCellKey  = options.getRandomBossCellKey   ?? null;
  }

  // ---------------------------------------------------------------------------
  // Boss definitions
  // ---------------------------------------------------------------------------

  private static readonly BOSS_STATS: Readonly<Record<number, CombatStats>> = {
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

  private static readonly BOSS_NAMES: Readonly<Record<number, string>> = {
    10: 'FLOOR GUARDIAN',
    20: 'ANCIENT HORROR',
    30: 'VOID TITAN',
  };

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get currentFloor(): number {
    return this._currentFloor;
  }

  get currentModifier(): FloorModifier | null {
    return this._currentModifier;
  }

  isBossFloor(): boolean {
    return this._currentFloor % this._bossEveryNFloors === 0;
  }

  /**
   * Relic floors: floor 5 then every 10 floors (15, 25, 35…).
   * Boss clears (floor % bossEveryNFloors === 0) also award a relic.
   */
  isRelicFloor(): boolean {
    const f = this._currentFloor;
    const n = this._bossEveryNFloors;
    return f % n === 0 || f % n === Math.floor(n / 2);
  }

  advance(): void {
    this._currentFloor++;
    // Roll a modifier for the next floor.
    // In allFloorsModified mode every floor gets one; otherwise boss floors skip.
    if (this._allFloorsModified || !this.isBossFloor()) {
      this._currentModifier = rollFloorModifier(this._currentFloor);
    } else {
      this._currentModifier = null;
    }
  }

  /**
   * Returns the full spawn config for the current floor's enemy.
   * GameScene passes this straight to the Enemy constructor.
   */
  buildEnemyConfig(): EnemyConfig {
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
        sheet: this._monsterSheet,
        frame: (this._currentFloor - 1) % (4 * 4),
      },
    };
  }

  /**
   * Builds a boss EnemyConfig for the current floor.
   * In Boss Rush mode, tier = currentFloor (boss 1 ≈ floor-10-equivalent).
   * In standard mode, uses hand-tuned stats at floors 10/20/30, then scaled formula.
   */
  buildBossConfig(): EnemyConfig {
    let stats: CombatStats;
    let bossLabel: string;

    if (this._bossesOnly) {
      // Boss Rush: tier index = current floor (1-based), scales from tier 1 upward
      stats     = this.buildScaledBossStats(this._currentFloor);
      bossLabel = `BOSS ${this._currentFloor}`;
    } else {
      stats = { ...(
        FloorManager.BOSS_STATS[this._currentFloor] ??
        this.buildScaledBossStats(this._currentFloor / this._bossEveryNFloors)
      ) };
      bossLabel =
        FloorManager.BOSS_NAMES[this._currentFloor] ??
        `FLOOR ${this._currentFloor} BOSS`;
    }

    const isFirstBossFloor = !this._bossesOnly && this._currentFloor === this._bossEveryNFloors;
    const bossSprite = isFirstBossFloor && this._getRandomBossCellKey
      ? { sheet: this._getRandomBossCellKey() }
      : {
          sheet: 'boss_sheet',
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

  private buildRegularStats(): CombatStats {
    const f  = this._currentFloor;
    const hp = Math.floor(60 * (1 + 0.2 * (f - 1)) * this._enemyHpMultiplier);
    return {
      maxHp: hp,
      hp,
      damage:      Math.floor(8   * (1 + 0.12 * (f - 1)) * this._enemyDamageMultiplier),
      attackSpeed: Math.min(2.5, (0.9 + 0.05 * (f - 1))  * this._enemySpeedMultiplier),
      armor:       2 + Math.floor((f - 1) / 3),
      critChance:  0,
      critMultiplier: 2.0,
    };
  }

  /**
   * Scaled boss stats used for floors beyond the hand-tuned set (30+) and for Boss Rush.
   * @param tier  Boss tier: 1 = floor-10 equivalent, 2 = floor-20 equivalent, etc.
   */
  private buildScaledBossStats(tier: number): CombatStats {
    const hp = Math.floor(280 * (1 + 0.8 * (tier - 1)) * this._enemyHpMultiplier);
    return {
      maxHp: hp, hp,
      damage:      Math.floor(13  * (1 + 0.6  * (tier - 1)) * this._enemyDamageMultiplier),
      attackSpeed: Math.min(2.0, (0.7 + 0.08 * (tier - 1))  * this._enemySpeedMultiplier),
      armor:       4 + 6 * (tier - 1),
      critChance:  Math.min(0.4, 0.08 + 0.04 * (tier - 1)),
      critMultiplier: 2.0,
    };
  }
}
