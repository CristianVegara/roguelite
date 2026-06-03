/**
 * StatusEffects — runtime state of damage-over-time effects on an entity.
 *
 * Owned by Enemy (players don't receive DoTs in Phase 1).
 * Updated by RulesEngine.tickStatusEffects() each frame.
 */

export interface PoisonState {
  stacks:          number;    // current stack count
  damagePerStack:  number;    // snapshot from attacker's stats at proc time
  tickIntervalMs:  number;    // ms between ticks
  tickTimer:       number;    // ms until next tick fires
}

export interface BurnState {
  damagePerTick:   number;    // snapshot from attacker's stats
  durationMs:      number;    // total remaining burn time
  tickIntervalMs:  number;    // ms between ticks (default 500)
  tickTimer:       number;    // ms until next tick
  canCrit:         boolean;   // Conflagration transformation
}

export interface EntityStatusEffects {
  poison: PoisonState | null;
  burn:   BurnState   | null;
}

export function createEmptyStatusEffects(): EntityStatusEffects {
  return { poison: null, burn: null };
}

/** Tick result returned by RulesEngine.tickStatusEffects(). */
export interface StatusTickResult {
  poisonDamage:    number;
  burnDamage:      number;
  burnIsCrit:      boolean;
  /** Heal for player if Vampiric Aura is active. */
  dotHeal:         number;
  /** HP to restore to the enemy (Regenerating floor modifier). */
  enemyRegenHeal:  number;
}
