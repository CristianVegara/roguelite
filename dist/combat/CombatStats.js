/**
 * Returns a fully-populated CombatStats with all optional fields defaulted
 * to 0 / false. Useful for Player base stats and testing.
 */
export function createFullStats(overrides) {
    return {
        lifesteal: 0,
        reflectPercent: 0,
        poisonChance: 0,
        poisonStacks: 1,
        poisonDamage: 2,
        poisonMaxStacks: 10,
        poisonTickRate: 2,
        burnChance: 0,
        burnDamage: 5,
        burnDuration: 3,
        burnCanCrit: false,
        lightningChance: 0,
        lightningDamage: 0.5,
        areaPercent: 0,
        areaEveryNHits: 0,
        summonCount: 0,
        summonDamagePercent: 0.2,
        shield: 0,
        maxShield: 0,
        goldPerFloor: 0,
        damageMultiplier: 1.0,
        ...overrides,
    };
}
