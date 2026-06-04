import Phaser from 'phaser';
import { CombatStats } from '../combat/CombatStats';
import { EntityStatusEffects, createEmptyStatusEffects } from '../combat/StatusEffects';
import { EnemyConfig } from '../floors/FloorManager';
import { HealthBar } from '../ui/HealthBar';

export const ENEMY_BASE_STATS: CombatStats = {
  maxHp: 60, hp: 60, damage: 8, attackSpeed: 0.9,
  armor: 2, critChance: 0.0, critMultiplier: 2.0,
};

/**
 * Enemy entity.
 *
 * Phase 1 additions:
 *   - `statusEffects` — mutable DoT state read/written by RulesEngine
 *   - `applyPoison()` / `applyBurn()` — called by RulesEngine on proc
 *   - `clearStatusEffects()` — called when enemy dies / floor resets
 */
export class Enemy {
  public stats: CombatStats;
  public readonly isBoss: boolean;
  /** Mutable DoT state. RulesEngine reads and ticks this each frame. */
  public readonly statusEffects: EntityStatusEffects;

  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly healthBar: HealthBar;
  private readonly baseX: number;
  private readonly debuffText: Phaser.GameObjects.Text;
  private attackTimer: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config?: EnemyConfig) {
    this.scene = scene;
    this.baseX = x;
    this.isBoss = config?.isBoss ?? false;
    this.stats = config ? { ...config.stats } : { ...ENEMY_BASE_STATS };
    this.statusEffects = createEmptyStatusEffects();

    this.attackTimer = -(500 + Math.random() * 300);

    const textureKey = this.isBoss ? 'boss' : 'enemy';
    this.sprite = scene.add.image(x, y, textureKey);

    const barWidth = this.isBoss ? 100 : 70;
    const barY     = this.isBoss ? y - 50 : y - 40;
    this.healthBar = new HealthBar(scene, x, barY, barWidth, 9);

    // Debuff text sits just above the health bar
    this.debuffText = scene.add.text(x, barY - 13, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5, 1).setDepth(5);
  }

  /** Call each frame to keep debuff icons in sync with live status. */
  updateDebuffs(): void {
    const parts: string[] = [];
    const ps = this.statusEffects.poison;
    const bs = this.statusEffects.burn;
    if (ps && ps.stacks > 0)         parts.push(`☠${ps.stacks}`);
    if (bs && bs.durationMs > 0)     parts.push('🔥');
    this.debuffText.setText(parts.join(' '));
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  // ---------------------------------------------------------------------------
  // Status effect application (called by RulesEngine)
  // ---------------------------------------------------------------------------

  /**
   * Apply or add poison stacks to this enemy.
   * Respects maxStacks (0 = unlimited for Poison Lord).
   */
  applyPoison(
    stacks: number,
    damagePerStack: number,
    tickIntervalMs: number,
    maxStacks = 10,
  ): void {
    if (!this.statusEffects.poison) {
      this.statusEffects.poison = {
        stacks:         0,
        damagePerStack,
        tickIntervalMs,
        tickTimer:      0,
      };
    }
    const ps = this.statusEffects.poison;
    ps.damagePerStack = damagePerStack;   // always snapshot latest attacker value
    ps.tickIntervalMs = tickIntervalMs;
    if (maxStacks === 0) {
      ps.stacks += stacks;               // Poison Lord: no cap
    } else {
      ps.stacks = Math.min(maxStacks, ps.stacks + stacks);
    }
  }

  /**
   * Apply or refresh burn on this enemy.
   */
  applyBurn(
    damagePerTick: number,
    durationMs: number,
    tickIntervalMs: number,
    canCrit: boolean,
  ): void {
    if (!this.statusEffects.burn) {
      this.statusEffects.burn = {
        damagePerTick,
        durationMs,
        tickIntervalMs,
        tickTimer: 0,
        canCrit,
      };
    } else {
      // Refresh: keep highest damage, extend duration
      const bs = this.statusEffects.burn;
      bs.damagePerTick = Math.max(bs.damagePerTick, damagePerTick);
      bs.durationMs    = Math.max(bs.durationMs, durationMs);
      bs.canCrit       = bs.canCrit || canCrit;
    }
  }

  clearStatusEffects(): void {
    this.statusEffects.poison = null;
    this.statusEffects.burn   = null;
  }

  // ---------------------------------------------------------------------------
  // Combat interface
  // ---------------------------------------------------------------------------

  tickAttack(delta: number): boolean {
    this.attackTimer += delta;
    const interval = 1000 / this.stats.attackSpeed;
    if (this.attackTimer >= interval) {
      this.attackTimer -= interval;
      this.playAttackAnim();
      return true;
    }
    return false;
  }

  takeDamage(amount: number): void {
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.healthBar.update(this.stats.hp, this.stats.maxHp);
    this.playHurtAnim();
  }

  isDead(): boolean { return this.stats.hp <= 0; }

  destroy(): void {
    this.sprite.destroy();
    this.healthBar.destroy();
    this.debuffText.destroy();
  }

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  private playAttackAnim(): void {
    // Always tween from baseX so stacked attacks can't accumulate drift.
    this.sprite.x = this.baseX;
    this.scene.tweens.add({
      targets: this.sprite, x: this.baseX - 14,
      duration: 70, yoyo: true, ease: 'Power2',
    });
  }

  private playHurtAnim(): void {
    this.scene.tweens.add({
      targets: this.sprite, alpha: 0.15,
      duration: 80, yoyo: true,
    });
  }
}
