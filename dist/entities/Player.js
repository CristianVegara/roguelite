import { createFullStats } from '../combat/CombatStats';
import { HealthBar } from '../ui/HealthBar';
/**
 * Phase 1: all optional build-system fields are set explicitly to 0 so
 * upgrades can safely do `stats.lifesteal += 0.05` without null-guards.
 */
export const PLAYER_BASE_STATS = createFullStats({
    maxHp: 100,
    hp: 100,
    damage: 12,
    attackSpeed: 1.2,
    armor: 3,
    critChance: 0.05,
    critMultiplier: 2.0,
});
export class Player {
    constructor(scene, x, y) {
        this.attackTimer = 0;
        this.scene = scene;
        this.stats = { ...PLAYER_BASE_STATS };
        this.sprite = scene.add.image(x, y, 'player');
        this.healthBar = new HealthBar(scene, x, y - 44, 70, 9);
    }
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    // ---------------------------------------------------------------------------
    // Combat interface
    // ---------------------------------------------------------------------------
    tickAttack(delta) {
        this.attackTimer += delta;
        const interval = 1000 / this.stats.attackSpeed;
        if (this.attackTimer >= interval) {
            this.attackTimer -= interval;
            this.playAttackAnim();
            return true;
        }
        return false;
    }
    takeDamage(amount) {
        this.stats.hp = Math.max(0, this.stats.hp - amount);
        this.healthBar.update(this.stats.hp, this.stats.maxHp);
        this.playHurtAnim();
    }
    /** Heal the player by `amount`, capped at maxHp. Returns actual HP gained. */
    heal(amount) {
        const before = this.stats.hp;
        this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
        const gained = this.stats.hp - before;
        this.healthBar.update(this.stats.hp, this.stats.maxHp);
        return gained;
    }
    isDead() { return this.stats.hp <= 0; }
    destroy() {
        this.sprite.destroy();
        this.healthBar.destroy();
    }
    // ---------------------------------------------------------------------------
    // Animations
    // ---------------------------------------------------------------------------
    playAttackAnim() {
        this.scene.tweens.add({
            targets: this.sprite, x: this.sprite.x + 14,
            duration: 70, yoyo: true, ease: 'Power2',
        });
    }
    playHurtAnim() {
        this.scene.tweens.add({
            targets: this.sprite, alpha: 0.15,
            duration: 80, yoyo: true,
        });
    }
}
