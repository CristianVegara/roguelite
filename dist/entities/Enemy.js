import { createEmptyStatusEffects } from '../combat/StatusEffects';
import { HealthBar } from '../ui/HealthBar';
export const ENEMY_BASE_STATS = {
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
    constructor(scene, x, y, config) {
        this.scene = scene;
        this.isBoss = config?.isBoss ?? false;
        const bossLabel = config?.bossLabel ?? '';
        this.stats = config ? { ...config.stats } : { ...ENEMY_BASE_STATS };
        this.statusEffects = createEmptyStatusEffects();
        this.attackTimer = -(500 + Math.random() * 300);
        const textureKey = this.isBoss ? 'boss' : 'enemy';
        this.sprite = scene.add.image(x, y, textureKey);
        const barWidth = this.isBoss ? 100 : 70;
        const barY = this.isBoss ? y - 50 : y - 40;
        this.healthBar = new HealthBar(scene, x, barY, barWidth, 9);
        if (this.isBoss && bossLabel) {
            scene.add.text(x, barY - 14, bossLabel, {
                fontSize: '11px', color: '#ffd700',
                fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0.5, 0.5);
        }
    }
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    // ---------------------------------------------------------------------------
    // Status effect application (called by RulesEngine)
    // ---------------------------------------------------------------------------
    /**
     * Apply or add poison stacks to this enemy.
     * Respects maxStacks (0 = unlimited for Poison Lord).
     */
    applyPoison(stacks, damagePerStack, tickIntervalMs, maxStacks = 10) {
        if (!this.statusEffects.poison) {
            this.statusEffects.poison = {
                stacks: 0,
                damagePerStack,
                tickIntervalMs,
                tickTimer: 0,
            };
        }
        const ps = this.statusEffects.poison;
        ps.damagePerStack = damagePerStack; // always snapshot latest attacker value
        ps.tickIntervalMs = tickIntervalMs;
        if (maxStacks === 0) {
            ps.stacks += stacks; // Poison Lord: no cap
        }
        else {
            ps.stacks = Math.min(maxStacks, ps.stacks + stacks);
        }
    }
    /**
     * Apply or refresh burn on this enemy.
     */
    applyBurn(damagePerTick, durationMs, tickIntervalMs, canCrit) {
        if (!this.statusEffects.burn) {
            this.statusEffects.burn = {
                damagePerTick,
                durationMs,
                tickIntervalMs,
                tickTimer: 0,
                canCrit,
            };
        }
        else {
            // Refresh: keep highest damage, extend duration
            const bs = this.statusEffects.burn;
            bs.damagePerTick = Math.max(bs.damagePerTick, damagePerTick);
            bs.durationMs = Math.max(bs.durationMs, durationMs);
            bs.canCrit = bs.canCrit || canCrit;
        }
    }
    clearStatusEffects() {
        this.statusEffects.poison = null;
        this.statusEffects.burn = null;
    }
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
            targets: this.sprite, x: this.sprite.x - 14,
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
