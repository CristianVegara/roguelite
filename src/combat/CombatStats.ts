/**
 * CombatStats — shared data interface for player and enemy.
 *
 * Core fields (7) are required; they exist on every entity.
 * Build-system fields are optional — undefined is treated as 0 by
 * RulesEngine (using `?? 0`), so FloorManager's inline enemy objects
 * need no changes and compile without modification.
 */
export interface CombatStats {
  // ── Core ──────────────────────────────────────────────────────────────────
  maxHp:         number;
  hp:            number;
  damage:        number;       // base damage per hit, before modifiers
  attackSpeed:   number;       // attacks per second
  armor:         number;       // flat damage reduction on incoming hits
  critChance:    number;       // 0.0–1.0
  critMultiplier: number;      // multiplier on a critical hit (default 2.0)

  // ── Build system — Lifesteal ──────────────────────────────────────────────
  lifesteal?:      number;     // 0.0–1.0: fraction of damage dealt as healing

  // ── Build system — Reflect ───────────────────────────────────────────────
  reflectPercent?: number;     // 0.0–1.0: fraction of incoming damage reflected

  // ── Build system — Poison ────────────────────────────────────────────────
  poisonChance?:    number;    // 0.0–1.0: proc probability per hit
  poisonStacks?:    number;    // stacks applied per proc
  poisonDamage?:    number;    // damage per stack per tick
  poisonMaxStacks?: number;    // cap; 0 = unlimited (Poison Lord)
  poisonTickRate?:  number;    // ticks per second (default 2)

  // ── Build system — Burn ──────────────────────────────────────────────────
  burnChance?:    number;
  burnDamage?:    number;      // damage per tick (flat, not per stack)
  burnDuration?:  number;      // seconds per application
  burnCanCrit?:   boolean;     // Conflagration transformation

  // ── Build system — Lightning ─────────────────────────────────────────────
  lightningChance?:  number;   // 0.0–1.0 per hit
  lightningDamage?:  number;   // fraction of hit damage (e.g. 0.5 = 50%)

  // ── Build system — Area damage ───────────────────────────────────────────
  areaPercent?:     number;    // fraction of hit to deal as bonus (Cleave)
  areaEveryNHits?:  number;    // 0 = disabled; 5 = every 5 hits (Shockwave)

  // ── Build system — Summons ───────────────────────────────────────────────
  summonCount?:         number; // number of active familiars
  summonDamagePercent?: number; // each summon deals this fraction of player damage per player attack

  // ── Build system — Shield ────────────────────────────────────────────────
  shield?:    number;
  maxShield?: number;

  // ── Build system — Economy ───────────────────────────────────────────────
  goldPerFloor?: number;       // flat gold added on floor clear

  // ── Build system — Damage multiplier (multiplicative, applied last) ──────
  damageMultiplier?: number;   // 1.0 base; additive per source, applied once
}

/**
 * Returns a fully-populated CombatStats with all optional fields defaulted
 * to 0 / false. Useful for Player base stats and testing.
 */
export function createFullStats(overrides: Partial<CombatStats> & {
  maxHp: number; hp: number; damage: number;
  attackSpeed: number; armor: number;
  critChance: number; critMultiplier: number;
}): CombatStats {
  return {
    lifesteal:          0,
    reflectPercent:     0,
    poisonChance:       0,
    poisonStacks:       1,
    poisonDamage:       2,
    poisonMaxStacks:    10,
    poisonTickRate:     2,
    burnChance:         0,
    burnDamage:         5,
    burnDuration:       3,
    burnCanCrit:        false,
    lightningChance:    0,
    lightningDamage:    0.5,
    areaPercent:        0,
    areaEveryNHits:     0,
    summonCount:        0,
    summonDamagePercent: 0.2,
    shield:             0,
    maxShield:          0,
    goldPerFloor:       0,
    damageMultiplier:   1.0,
    ...overrides,
  };
}
