/**
 * StatusEffects — runtime state of damage-over-time effects on an entity.
 *
 * Owned by Enemy (players don't receive DoTs in Phase 1).
 * Updated by RulesEngine.tickStatusEffects() each frame.
 */
export function createEmptyStatusEffects() {
    return { poison: null, burn: null };
}
