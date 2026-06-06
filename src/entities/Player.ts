import Phaser from 'phaser';
import { CombatStats, createFullStats } from '../combat/CombatStats';
import { HealthBar } from '../ui/HealthBar';

/**
 * Phase 1: all optional build-system fields are set explicitly to 0 so
 * upgrades can safely do `stats.lifesteal += 0.05` without null-guards.
 */
export const PLAYER_BASE_STATS: CombatStats = createFullStats({
  maxHp:         100,
  hp:            100,
  damage:        12,
  attackSpeed:   1.2,
  armor:         3,
  critChance:    0.05,
  critMultiplier: 2.0,
});

export class Player {
  public stats: CombatStats;

  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly healthBar: HealthBar;
  private readonly baseX: number;
  private attackTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, classSpriteFrame?: number, skinTextureKey?: string | null) {
    this.scene = scene;
    this.baseX = x;
    this.stats = { ...PLAYER_BASE_STATS };

    const classSpriteFrameKey = classSpriteFrame != null ? String(classSpriteFrame) : null;
    const useSkinSprite = skinTextureKey != null && scene.textures.exists(skinTextureKey);
    const useClassSprite = classSpriteFrameKey != null && scene.textures.exists('class_sprite') && scene.textures.get('class_sprite').has(classSpriteFrameKey);

    if (useSkinSprite) {
      this.sprite = scene.add.image(x, y, skinTextureKey);
      this.sprite.setScale(0.52);
    } else if (useClassSprite) {
      this.sprite = scene.add.image(x, y, 'class_sprite', classSpriteFrame);
      this.sprite.setScale(0.22);
    } else {
      this.sprite = scene.add.image(x, y, 'player');
    }

    this.healthBar = new HealthBar(scene, x, y - 44, 70, 9);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

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

  /** Heal the player by `amount`, capped at maxHp. Returns actual HP gained. */
  heal(amount: number): number {
    const before   = this.stats.hp;
    this.stats.hp  = Math.min(this.stats.maxHp, this.stats.hp + amount);
    const gained   = this.stats.hp - before;
    this.healthBar.update(this.stats.hp, this.stats.maxHp);
    return gained;
  }

  isDead(): boolean { return this.stats.hp <= 0; }

  destroy(): void {
    this.sprite.destroy();
    this.healthBar.destroy();
  }

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  private playAttackAnim(): void {
    // Always tween from baseX so stacked attacks can't accumulate drift.
    this.sprite.x = this.baseX;
    this.scene.tweens.add({
      targets: this.sprite, x: this.baseX + 14,
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
