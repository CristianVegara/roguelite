/**
 * Stateless damage calculator — pure function, no Phaser, no side effects.
 *
 * Formula:
 *   effective = max(1, attacker.damage − defender.armor)
 *   if crit:  effective = floor(effective × critMultiplier)
 */
export class CombatCalculator {
    static calculate(attacker, defender) {
        const isCrit = Math.random() < attacker.critChance;
        const raw = Math.max(1, attacker.damage - defender.armor);
        const damage = isCrit ? Math.floor(raw * attacker.critMultiplier) : raw;
        return { damage, isCrit };
    }
}
