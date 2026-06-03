# THE SPIRE — Game Design Document
## Build Ecosystem Redesign
**Version 1.0 | Lead: Technical Director / Systems Designer**

---

> **Design Mantra:** *"Simple to understand, impossible to master."*
> Players should eventually feel like they are breaking the game through
> clever build creation — not grinding to Floor 100.

---

## TABLE OF CONTENTS

1. [Design Philosophy](#design-philosophy)
2. [Phase 1 — Build System Redesign](#phase-1--build-system-redesign)
3. [Phase 2 — Keystone System](#phase-2--keystone-system)
4. [Phase 3 — Relic System](#phase-3--relic-system)
5. [Phase 4 — Advanced Upgrade Drafting](#phase-4--advanced-upgrade-drafting)
6. [Phase 5 — Player Statistics Panel](#phase-5--player-statistics-panel)
7. [Phase 6 — Combat Feedback](#phase-6--combat-feedback)
8. [Phase 7 — Floor Variants](#phase-7--floor-variants)
9. [Phase 8 — Classes](#phase-8--classes)
10. [Implementation Sequence](#implementation-sequence)

---

## DESIGN PHILOSOPHY

### The Problem With Pure Stat Upgrades
"+5% damage" creates zero interesting decisions. The player calculates which is largest, takes it,
and feels nothing. After 20 runs everything blurs into the same experience.

### The Solution: Interaction-Driven Design
Every upgrade should create a question the player hasn't answered before:
- *"What happens if I stack lifesteal and area damage?"*
- *"Can I make poison do what lightning normally does?"*
- *"What if I just don't attack at all?"*

The answer should sometimes be "nothing interesting" and sometimes be "I am absolutely destroying
Floor 30 with a build nobody has ever tried." Both outcomes teach the player something.

### Power Curve Philosophy
```
Floors 1-5:   Linear growth (1x → 2x damage)
Floors 6-10:  Synergy kicks in (2x → 8x)
Floors 11-20: Transformation effects emerge (8x → 50x)
Floors 21+:   Exponential / "broken" territory (50x → ∞)
```
The game is not balanced at the top end. That is intentional. Players reaching absurd numbers
should be rewarded with a screenshot moment, not a brick wall.

---

## PHASE 1 — BUILD SYSTEM REDESIGN

### Design Goals
Replace the flat upgrade pool with a structured ecosystem of 14 build categories.
Each category supports a complete build path — a player can commit entirely to one category
or create hybrid builds by mixing categories at the synergy layer.

### Retention Impact
- **Short-term:** Players have a meaningful choice on every upgrade screen (not "biggest number wins")
- **Mid-term:** Players discover that two categories combine in unexpected ways
- **Long-term:** Players plan runs around specific category combinations before starting

### Balance Risks
- **Trap categories:** Economy and Cooldown must contribute actual damage output or players ignore them
- **Dominant paths:** Lightning and Poison are DoT-heavy; if they outclass everything, nobody experiments
- **Synergy explosions:** Transformation upgrades can create infinite loops — every one requires a
  ceiling check during implementation

### Data Structures

```typescript
type BuildCategory =
  | 'damage'    | 'critical'  | 'lifesteal' | 'defense'
  | 'reflect'   | 'poison'    | 'burn'      | 'lightning'
  | 'summons'   | 'rage'      | 'berserker' | 'economy'
  | 'cooldown'  | 'areaDamage';

type UpgradeTier   = 'starter' | 'synergy' | 'transformation' | 'keystone';
type UpgradeRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

interface UpgradeDefinition {
  id:           string;
  name:         string;
  description:  string;
  flavourText?: string;        // Lore / humour line shown below description
  category:     BuildCategory;
  tier:         UpgradeTier;
  rarity:       UpgradeRarity;
  maxStacks:    number;        // 1 for keystones, 3–5 for starters
  requires?:    string[];      // Upgrade IDs that must be owned first
  tags:         string[];      // Used by the draft biasing system
  effect:       UpgradeEffect;
}

interface UpgradeEffect {
  // Immediate stat mutations
  statDeltas?:       Partial<CombatStats>;
  // Conditional triggers that run in the combat loop
  triggers?:         TriggerDefinition[];
  // Rules that permanently mutate how an existing mechanic works
  ruleTransforms?:   RuleTransform[];
}

interface TriggerDefinition {
  event:     CombatEvent;    // 'onHit' | 'onKill' | 'onCrit' | 'onDamageTaken' | ...
  condition?: TriggerCond;   // optional predicate (e.g. "target below 50% HP")
  action:    TriggerAction;  // what happens
  chance?:   number;         // 0–1 probability gate
}

interface RuleTransform {
  target: string;   // e.g. "attackSpeed", "critChance", "poisonStacks"
  rule:   string;   // human-readable rule ID, looked up in RulesEngine
}

// CombatEvent union — extend as new systems are added
type CombatEvent =
  | 'onHit' | 'onCrit' | 'onKill' | 'onBossKill'
  | 'onDamageTaken' | 'onHeal' | 'onPoison' | 'onBurn'
  | 'onLightningChain' | 'onSummonAttack' | 'onFloorStart' | 'onFloorEnd';
```

### Architecture

The build system introduces a **RulesEngine** layer between `CombatCalculator` and `GameScene`.
The RulesEngine holds the currently active `RuleTransform` list and intercepts each combat step:

```
Player.tickAttack()
  → RulesEngine.resolveAttack(attacker, target)
      → base damage from CombatCalculator
      → apply active transforms (poison on crit? burn spreads? etc.)
      → fire registered triggers
      → return final result
```

`RulesEngine` is reset on scene creation (each new run) and populated as upgrades are applied.
It is the single place where "does crit apply poison?" is answered.

---

### THE 14 CATEGORIES

Each category lists: role, starter × 3, synergy × 3, transformation × 2, keystone × 1.
Upgrades marked **(S)** can appear in the draft without prerequisites.
Upgrades marked **(SYN: X)** require at least one upgrade from category X.

---

#### 1. DAMAGE
*Raw attack power. The universal starting point.*

| Name | Tier | Effect |
|------|------|--------|
| **Sharp Edge** (S) | Starter | +20% base damage. Stackable ×5. |
| **Heavy Strikes** (S) | Starter | +30% damage, −10% attack speed. Stackable ×3. |
| **Executioner** (S) | Starter | +0.5% damage for every 1% HP the enemy is missing. |
| **Momentum** | Synergy | Each kill this floor grants +3% damage (resets per floor). Max 30%. |
| **Overflow** | Synergy | Overkill damage (damage beyond enemy's remaining HP) is stored and added to your next attack. |
| **Resonance** | Synergy | Every 5th attack deals ×3 damage. Counter resets on taking damage. |
| **Cascade** | Transformation | When Overflow triggers, the bonus also deals area damage equal to 30% of stored value. |
| **Death's Arithmetic** | Transformation | Executioner's bonus now applies to YOUR missing HP as well — two missing-HP bonuses multiply. |
| **COLOSSUS STRIKE** | Keystone | Your attacks deal 25% of main-hit damage in a shockwave to adjacent enemies. All shockwaves can trigger Overflow. |

---

#### 2. CRITICAL
*High-impact hits. The category that interacts with everything.*

| Name | Tier | Effect |
|------|------|--------|
| **Eagle Eye** (S) | Starter | +10% crit chance. Stackable ×5. |
| **Precision** (S) | Starter | +60% crit damage multiplier. Stackable ×4. |
| **Glass Edge** (S) | Starter | +25% crit chance, −15% base damage. |
| **Predator's Mark** | Synergy | Each crit applies a mark. Next hit against marked target deals extra damage equal to 20% of the crit that applied the mark. |
| **Opportunist** | Synergy | Crits against enemies below 50% HP restore 5% of max HP. |
| **Avalanche** (SYN: damage) | Synergy | Each non-crit hit in a row increases crit chance by 3%. Resets on crit. |
| **Fortune's Blade** | Transformation | Crit chance is removed from your stats. Instead, every attack deals variable damage (base × 0.5 to base × 1.5 + crit multiplier). Every hit is a "partial crit." |
| **Speed-to-Crit** | Transformation | Remove all crit chance. For every 0.1 attacks/sec above 1.0, gain 8% crit chance (can exceed 100%). |
| **ETERNAL CRIT** | Keystone | Base crit chance becomes 100%. Base damage is halved. Crits no longer deal bonus damage — instead, they always trigger ALL active crit-triggered effects simultaneously. |

---

#### 3. LIFESTEAL
*Sustain. The category that makes high-damage builds survive.*

| Name | Tier | Effect |
|------|------|--------|
| **Leech** (S) | Starter | +5% lifesteal. Stackable ×6. |
| **Vital Strike** (S) | Starter | Every 3rd hit heals a flat 8 HP regardless of damage dealt. |
| **Blood Tap** (S) | Starter | On kill, heal 15% of the enemy's max HP. |
| **Overcharge** | Synergy | Healing beyond max HP becomes a temporary shield (lasts 5s, max equal to 20% max HP). |
| **Blood Drunk** (SYN: critical) | Synergy | Lifesteal procs can crit. A lifesteal crit heals for the full crit damage amount. |
| **Sanguine Tide** (SYN: poison) | Synergy | Each active poison stack on the enemy generates 0.5% lifesteal. |
| **Hemophage** | Transformation | Sacrifice 50% of max HP permanently. Gain lifesteal equal to 20% of the sacrificed HP value (flat healing per attack). |
| **Vampiric Aura** | Transformation | Lifesteal now applies to ALL damage sources: poison ticks, burn ticks, reflect, summons — everything. |
| **UNDYING THIRST** | Keystone | Lifesteal doubles when below 50% HP. On kill while below 30% HP, instantly restore 40% max HP. Overcharge threshold increases to 50% max HP. |

---

#### 4. DEFENSE
*Damage reduction and walls. The category others build through.*

| Name | Tier | Effect |
|------|------|--------|
| **Iron Skin** (S) | Starter | +12 armor. Stackable ×6. |
| **Stoic** (S) | Starter | +8% damage reduction (additive). Stackable ×3. |
| **Reactive Plating** (S) | Starter | Gain 5 armor for 3s after taking a hit. Stackable ×4. |
| **Fortress** | Synergy | After clearing a floor, permanently gain 2 armor for this run. Stacks infinitely. |
| **Absorb** (SYN: lifesteal) | Synergy | When the Overcharge shield absorbs damage, gain armor equal to 10% of the absorbed amount for 5s. |
| **Pressure Suit** | Synergy | Damage reduction applies to all damage types (poison, burn, reflect). |
| **Living Wall** | Transformation | Armor above 20 also contributes to your attack damage at a 2:1 ratio. (50 armor → +15 damage.) |
| **Adaptation** | Transformation | Each unique attack from an enemy permanently reduces that specific damage type by 3%. Tracks per run. |
| **DIAMOND BODY** | Keystone | Immune to the first hit of each floor. After the first hit, armor doubles for the remainder of that floor. |

---

#### 5. REFLECT
*The mirror build. Turns defense into offense.*

| Name | Tier | Effect |
|------|------|--------|
| **Mirror Shards** (S) | Starter | Reflect 15% of incoming damage back to attacker. Stackable ×4. |
| **Spine** (S) | Starter | Enemies that attack you take flat 5 damage. |
| **Counterstrike** (S) | Starter | When hit, 20% chance to immediately retaliate with a free attack. |
| **Amplified Return** (SYN: burn) | Synergy | Reflected damage applies a burn stack to the attacker. |
| **Pressure Wave** (SYN: areaDamage) | Synergy | Reflected damage hits all enemies on the floor for 30% of the reflected amount. |
| **Dark Echo** (SYN: critical) | Synergy | Reflected damage can critically strike using your crit stats. |
| **Dark Mirror** | Transformation | Store all incoming damage below 8 (instead of reflecting it). Release stored energy as bonus damage on your next attack. |
| **Grudge** | Transformation | Each time you take damage, gain a permanent +1% reflect for this run. Stacks infinitely. |
| **KARMA** | Keystone | Reflect increases to 75%. You take only 25% of all incoming damage. Your HP becomes your primary resource — low HP means more reflection value. |

---

#### 6. POISON
*The patient build. Stacks slowly, kills inevitably.*

| Name | Tier | Effect |
|------|------|--------|
| **Venom Tips** (S) | Starter | Attacks apply 1 poison stack (2 dmg/tick, 0.5s tick). Max 10 stacks. Stackable ×3 (increases max stacks). |
| **Toxic Coating** (S) | Starter | +1 additional stack per attack. |
| **Corrosive** (S) | Starter | Each poison stack reduces enemy armor by 1. |
| **Plague Carrier** | Synergy | On kill, all poison stacks transfer to the next enemy at 75% count. |
| **Festering Wounds** (SYN: lifesteal) | Synergy | Poison ticks trigger lifesteal. |
| **Neurotoxin** | Synergy | Each poison stack reduces enemy attack speed by 3%. |
| **Viral Toxin** | Transformation | Poison duration extends by 0.5s each time a new stack is applied. Stacks can last indefinitely if constantly refreshed. |
| **Reactive Venom** (SYN: critical) | Transformation | Crits apply 3× the normal poison stacks. Poison ticks can critically strike. |
| **POISON LORD** | Keystone | Poison stacks have no maximum. Each stack does 3 dmg/tick (up from 2). Poison never expires — it only ends when the enemy dies. |

---

#### 7. BURN
*The volatile build. Explosive payoffs, risky timing.*

| Name | Tier | Effect |
|------|------|--------|
| **Kindling** (S) | Starter | 15% chance per attack to apply burn (5 dmg/tick, 3 ticks). Stackable ×3. |
| **Flammable** (S) | Starter | Burn duration doubles. Burn chance +10%. |
| **Igniter** (S) | Starter | If enemy is already burning, hits deal +15% damage. |
| **Backdraft** | Synergy | On kill of a burning enemy, 60% chance to spread burn to the next enemy with full duration. |
| **Smoke Screen** | Synergy | Burning enemies deal 20% less damage to you. |
| **Volatile** | Synergy | Enemies at max burn stacks (5) explode for 15% of their max HP as area damage. |
| **Conflagration** (SYN: critical) | Transformation | Burn ticks can critically strike. Burn crits double the tick damage AND extend duration by 1s. |
| **Spontaneous Combustion** | Transformation | If an enemy takes more than 30% of their max HP in a single hit, they instantly ignite at max stacks. |
| **PHOENIX PROTOCOL** | Keystone | Once per run, when you would die, survive with 1 HP. For the next 10s, your attacks deal bonus burn damage equal to 100% of the HP you lost this combat. |

---

#### 8. LIGHTNING
*The chain build. Single-target damage with AoE potential.*

| Name | Tier | Effect |
|------|------|--------|
| **Static Charge** (S) | Starter | 15% chance on attack to chain lightning to the target for 50% of damage. Stackable ×3 (increases %). |
| **Spark** (S) | Starter | Build electric charge (5 hits to fill). On full charge, auto-release a lightning bolt for 80% of your base damage. |
| **Grounding** (S) | Starter | Lightning strikes slow enemy attack speed by 15% for 2s. |
| **Overload** (SYN: critical) | Synergy | Critical hits always chain lightning, ignoring the chance roll. |
| **Arc Flash** (SYN: areaDamage) | Synergy | Lightning chains can now hit the same target twice. Second hit deals 50% of first. |
| **Storm Cell** | Synergy | Every floor, build a storm counter (1 per hit). At 20, release a free lightning strike equal to 200% base damage. |
| **Ball Lightning** | Transformation | Remove the chance-based chain. Instead, build a charge every 3 attacks. Release as a guaranteed chain hitting for 200% damage. |
| **Conductor** (SYN: summons) | Transformation | Lightning chains now also arc to your summons and back, dealing 40% to each. Summons hit by your lightning deal their next attack as electric damage. |
| **THUNDER ENGINE** | Keystone | Every critical strike chains lightning to ALL enemies on the floor for 40% of the crit damage. Each chain can trigger further crits. |

---

#### 9. SUMMONS
*The controller build. Trade personal power for army strength.*

| Name | Tier | Effect |
|------|------|--------|
| **Familiar** (S) | Starter | Summon a shadow familiar with 20% of your stats that auto-attacks. Max 1. Stackable ×2 (increases max). |
| **Reinforcements** (S) | Starter | At floor start, summon a temporary soldier with base stats for 15s. |
| **Pack Leader** (S) | Starter | Each active summon grants +5% to your own damage. |
| **Coordinated Strike** (SYN: critical) | Synergy | When you land a critical hit, all summons immediately attack. |
| **Inheritance** | Synergy | Your damage upgrades apply to summons at 40% effectiveness. |
| **Hivemind** (SYN: areaDamage) | Synergy | Summons deal area damage on each hit for 30% of attack. |
| **Swarm** | Transformation | On summon death (or kill), it splits into two weaker copies at 50% stats. Copies cannot split again. |
| **Mirrored Legion** | Transformation | Every permanent upgrade you own also applies to summons at 25% strength (including keystones). |
| **LICH FORM** | Keystone | You stop attacking entirely. Summons gain +300% damage and +300% attack speed. You become a support — all healing/lifesteal now applies to your summons instead. Your HP pool is now your summons' shared HP pool. |

---

#### 10. RAGE
*The desperation build. Scales with danger.*

| Name | Tier | Effect |
|------|------|--------|
| **Fury** (S) | Starter | +8% damage when below 75% HP. Stackable ×4. |
| **Berserker's Heart** (S) | Starter | +15% damage when below 50% HP. Stacks with Fury. |
| **Warlord's Cry** (S) | Starter | On taking damage, gain +3% damage for 4s (max +30%). |
| **Warlord** (SYN: summons) | Synergy | Rage bonuses apply to summons. |
| **Bloodlust** (SYN: lifesteal) | Synergy | While below 50% HP, lifesteal triples. |
| **Desperate Gamble** | Synergy | When below 25% HP, attacks cost 10 HP and deal 60% bonus damage. |
| **Frenzy** | Transformation | Attack speed increases by 3% for every 1% of max HP you are missing. (At 50% HP: +150% attack speed.) |
| **Pain is Power** | Transformation | Sacrifice 40% of max HP permanently. Gain permanent attack speed equal to 20% of the sacrificed value. |
| **RAGE GOD** | Keystone | Your damage scales inversely with HP. At full HP: 100% damage. At 50% HP: 300% damage. At 1 HP: 1000% damage. All healing receives a −75% penalty. |

---

#### 11. BERSERKER
*The speed build. Combos, momentum, and punishing stops.*

| Name | Tier | Effect |
|------|------|--------|
| **Quick Draw** (S) | Starter | +15% attack speed. Stackable ×5. |
| **Combo Sense** (S) | Starter | Track a combo counter. +1% damage per hit in streak. Max 20. Resets on taking damage. |
| **Flurry** (S) | Starter | Every 10th consecutive hit (no damage taken) deals 200% damage. |
| **Perpetual Motion** | Synergy | Kills extend your active combo by 5s instead of resetting it. |
| **Blur** | Synergy | Above 2.0 attacks/sec, gain 10% dodge. Above 3.0, gain 20% dodge. |
| **Afterimage** (SYN: summons) | Synergy | While combo is active, attacks spawn afterimages that deal 25% of damage one frame later. |
| **Unstoppable** | Transformation | Remove the attack speed cap entirely. Attack speed can exceed 5.0 attacks/sec. |
| **Infinite Assault** | Transformation | Each attack deals 30% of normal damage. However, each consecutive hit in a combo multiplies damage by 1.05×. At 20 hits: normal damage. At 50 hits: 4× normal. |
| **SPEEDFORCE** | Keystone | Attack speed above 2.0 converts into additional projectile attacks (1 per 0.5 above cap). Each projectile deals 40% base damage. Effectively unlimited AoE at high speed. |

---

#### 12. ECONOMY
*The investment build. Compounds value over the run.*

| Name | Tier | Effect |
|------|------|--------|
| **Treasure Hunter** (S) | Starter | Gain +8 gold after each floor clear. Stackable ×4. |
| **Compound Interest** (S) | Starter | After every 5 floors, current gold total increases by 20%. |
| **Opportunistic Looting** (S) | Starter | On boss kill, gain bonus gold equal to current floor × 3. |
| **Midas Touch** (SYN: critical) | Synergy | Critical hits generate 1 gold each. |
| **Market Timing** | Synergy | The more gold you hold at an upgrade choice, the higher rarity the offered upgrades. (50g → always at least Uncommon, 200g → always at least Rare.) |
| **Gold Plating** (SYN: defense) | Synergy | Convert 10 gold → 1 permanent armor, once per floor. |
| **War Chest** | Transformation | Gold converts to temporary damage at combat start. Every 10 gold → 1% damage for the floor. Gold is not spent. |
| **Miser's Revenge** | Transformation | You deal bonus damage equal to 1% of your gold total. Losing gold (spending on relics) deals this damage to YOU once. Rewards hoarding. |
| **SCROOGE** | Keystone | Begin the run with 500 gold and no upgrades. All upgrades now cost gold (cost = rarity × floor × 10). At floor 10 and every 10 floors after, convert 100% of held gold into permanent stats at a 3:1:1 (dmg:hp:speed) ratio. |

---

#### 13. COOLDOWN
*The rhythm build. Casts abilities in combat cycles.*

| Name | Tier | Effect |
|------|------|--------|
| **Quick Recovery** (S) | Starter | −15% cooldown on all abilities. Stackable ×4. |
| **Preparation** (S) | Starter | Start each floor with all cooldowns fully charged. |
| **Echo** (S) | Starter | Abilities have a 20% chance to trigger a second time for free. Stackable ×3. |
| **Chain Cast** (SYN: areaDamage) | Synergy | Using an ability immediately resets your attack timer (next attack fires instantly). |
| **Resonant Cycle** | Synergy | Each ability use reduces all other abilities' cooldowns by 0.5s. |
| **Prepared Mind** (SYN: economy) | Synergy | For each floor cleared without taking damage, reduce all cooldowns by 1s permanently for this run. |
| **Pulse** | Transformation | Cooldowns become attack-count-based instead of time-based. (e.g., "Every 8 attacks" instead of "Every 5 seconds.") Attack speed directly accelerates ability cycles. |
| **Zero Point** | Transformation | All cooldowns are set to 0. All abilities fire as persistent auras instead. Aura strength is 50% of the ability's original effect. |
| **PERPETUAL MACHINE** | Keystone | Abilities gain 1 stack each time any ability fires. At 5 stacks, all abilities deal 200% effect. At 10 stacks, abilities trigger chain reactions (each hit triggers a random other ability). Stacks reset after chain reaction. |

---

#### 14. AREA DAMAGE
*The crowd-control build. Eventually hits everything.*

| Name | Tier | Effect |
|------|------|--------|
| **Cleave** (S) | Starter | Attacks hit the primary target and adjacent enemies for 30% damage. Stackable ×3 (% increases). |
| **Shockwave** (S) | Starter | Every 5th attack releases a shockwave hitting all enemies for 40% damage. |
| **Ripple** (S) | Starter | Area hits apply 1 poison stack. |
| **Mass Destruction** (SYN: critical) | Synergy | Area damage can critically strike. |
| **Earthquake** | Synergy | Area radius grows with consecutive attacks: +5% per hit (max +100% at 20 hits, resets on taking damage). |
| **Impact** (SYN: defense) | Synergy | Area damage hits reduce target armor by 3 until end of floor. |
| **Collateral** (SYN: burn) | Transformation | Area damage always applies burn regardless of what triggered the area. |
| **Nuclear Option** | Transformation | Your main attack deals 40% of normal damage. Area damage radius doubles and deals 300% of the removed main-hit value. (You become an AoE specialist; single-target is sacrificed.) |
| **SINGULARITY** | Keystone | Once per floor, when hitting any enemy, create a gravitational pulse that pulls all enemies to the same position and deals your full attack damage to all of them simultaneously. Recharges on floor clear. |

---

### UPGRADE POOL SUMMARY

| Category | Total Upgrades | Stackable Starters | Synergies | Transforms | Keystones |
|----------|---------------|---------------------|-----------|------------|-----------|
| Damage | 9 | 3 | 3 | 2 | 1 |
| Critical | 9 | 3 | 3 | 2 | 1 |
| Lifesteal | 9 | 3 | 3 | 2 | 1 |
| Defense | 9 | 3 | 3 | 2 | 1 |
| Reflect | 9 | 3 | 3 | 2 | 1 |
| Poison | 9 | 3 | 3 | 2 | 1 |
| Burn | 9 | 3 | 3 | 2 | 1 |
| Lightning | 9 | 3 | 3 | 2 | 1 |
| Summons | 9 | 3 | 3 | 2 | 1 |
| Rage | 9 | 3 | 3 | 2 | 1 |
| Berserker | 9 | 3 | 3 | 2 | 1 |
| Economy | 9 | 3 | 3 | 2 | 1 |
| Cooldown | 9 | 3 | 3 | 2 | 1 |
| Area Damage | 9 | 3 | 3 | 2 | 1 |
| **TOTAL** | **126** | **42** | **42** | **28** | **14** |

---

## PHASE 2 — KEYSTONE SYSTEM

### Design Goals
Keystones are run-defining upgrades. When a player takes a keystone, it changes the fundamental
question of the run from "how do I maximize my damage?" to "how do I play *this specific
character* optimally?"

A keystone should be so distinctive that the player immediately starts mentally restructuring
what every future upgrade choice means in its context.

### Retention Impact
Keystones are the "screenshot moment" drivers. Players don't share "I got to Floor 22."
They share "I took KARMA + PHOENIX PROTOCOL and reflected a boss to death while dead."

### Balance Risks
- Some keystones are intrinsically more powerful in long runs (Poison Lord) vs. short runs (Colossus)
- Keystones must be locked to rarity:Legendary to prevent early-run access
- Keystones that disable mechanics (Lich Form, Eternal Crit) must ensure the remaining mechanics
  are *more than sufficient* — otherwise the keystone is a trap

### Architecture
Keystones use the same `UpgradeDefinition` schema as regular upgrades.
The `tier: 'keystone'` flag signals the draft system to handle them differently:
- Only one keystone can be active at a time (second keystone offer replaces the first — player
  must choose to swap)
- Keystones are always offered alone on a dedicated "Keystone choice" screen, not mixed with
  regular upgrades
- The active keystone's ID is stored in `RunState.activeKeystone`

### Data Structure Addition

```typescript
interface RunState {
  floor:           number;
  killCount:       number;
  bossKillCount:   number;
  activeKeystone?: string;       // Only one at a time
  relics:          string[];
  buildCategories: BuildCategory[];   // Inferred from owned upgrades
  comboCounter:    number;
  stormCounter:    number;
  rageStacks:      number;
  // ...other run-scoped counters
}
```

---

### KEYSTONE CATALOGUE (30)

The 14 category keystones are already defined above. Below are 16 **cross-category** keystones
that reward hybrid builds:

| # | Name | Build Identity | Effect |
|---|------|---------------|--------|
| 1 | **Glass Cannon** | Damage/Critical | +100% damage, −50% max HP. Cannot stack HP upgrades. |
| 2 | **Blood Mage** | Lifesteal/Rage | Spend HP instead of waiting for lifesteal. Each attack costs 5 HP but deals +50% damage. Lifesteal restores the cost. |
| 3 | **Living Fortress** | Defense/Reflect | All armor converts to damage (2:1). Lose all existing armor. You deal damage through blocking rather than attacking. |
| 4 | **Wildfire** | Burn/Lightning | Burn spreads to all enemies simultaneously. Lightning chains between burning enemies for free. |
| 5 | **Venom Oracle** | Poison/Summons | Your summons exclusively apply poison. You exclusively deal base damage. Poison damage is boosted by 150%. |
| 6 | **Echo Chamber** | Cooldown/Area | All AoE effects repeat once after 0.5s at 60% strength (free echo). Cannot take regular Cooldown starters. |
| 7 | **The Void** | Economy/Defense | Convert all gold to a permanent void shield equal to 50% of total gold. Shield regenerates between floors. Spending gold reduces the shield cap. |
| 8 | **Mirror Universe** | Reflect/Critical | All reflect damage applies your crit multiplier. All crits trigger reflect. The two systems are merged. |
| 9 | **Chaos Surge** | All | After each kill, randomly apply one of: burn, poison, lightning, reflect, rage. Each floor, gain the effect that triggered most. |
| 10 | **Singularity** | Area/Damage | (Reserved — see Phase 7 floor variant interaction.) Area damage is your primary damage type; single-target is disabled. |
| 11 | **Necromancer's Pact** | Summons/Death | Every time you kill an enemy, add a permanent +5% damage stack. Stacks never reset. Summons also gain this. You become exponentially stronger over a long run. |
| 12 | **Coward's Strength** | Defense/Economy | Cannot attack below 80% HP. Gain +5% damage for every 1% HP above 80% you maintain. Rewards perfect play. |
| 13 | **Overdrive** | Berserker/Cooldown | Attack speed cap removed. Above 3.0 atk/sec, each attack has a 5% chance to fire all active cooldown abilities simultaneously. |
| 14 | **Pandemic** | Poison/Burn | Poison and burn are merged into "plague." Plague applies both effects simultaneously. Plague can spread to all enemies on kill. |
| 15 | **Doppelganger** | Damage/Summons | Summon a perfect copy of yourself. Copy has 100% of your stats. You and copy attack independently. Copy is permanent but cannot gain upgrades. |
| 16 | **The Immortal** | Lifesteal/Defense | Cannot die. Instead, at 0 HP, activate "death mode" for 5s: deal 500% damage, cannot take damage, lose all lifesteal. After 5s, restore 50% HP. Can trigger once per floor. |

---

## PHASE 3 — RELIC SYSTEM

### Design Goals
Relics are passive objects that introduce *new mechanical rules*, not stat increases.
A relic should make the player say "I didn't know the game could do that."

Every relic is categorized by what type of new mechanic it introduces:
- **Multiplier Relics** — multiply an existing mechanic
- **Converter Relics** — transform one thing into another
- **Enabler Relics** — unlock mechanics that didn't exist before
- **Conditional Relics** — grant effects based on a special condition
- **Echo Relics** — duplicate or repeat existing effects

### Retention Impact
Relics are the "run lottery." Players start a run excited to see which relic they stumble into.
A good relic chain makes players abandon their planned build to chase something unexpected.

### Balance Risks
- Enabler relics that add entirely new damage types (e.g., "spawn explosions") need damage caps
- Multiplier relics stack multiplicatively with everything — test for floor-1 infinite damage
- Echo relics create infinite loops if not carefully capped

### Architecture

```typescript
interface RelicDefinition {
  id:          string;
  name:        string;
  description: string;
  type:        'multiplier' | 'converter' | 'enabler' | 'conditional' | 'echo';
  rarity:      'common' | 'uncommon' | 'rare' | 'legendary';
  category?:   BuildCategory;   // optional — biases toward builds in this category
  effect:      RelicEffect;
}

interface RelicEffect {
  // Relics that modify existing stats
  statMultipliers?:  Partial<Record<keyof CombatStats, number>>;
  // Relics that trigger on events
  eventTriggers?:    TriggerDefinition[];
  // Relics that modify rules
  ruleModifiers?:    RuleModifier[];
  // Relics that add new mechanics
  newMechanics?:     NewMechanic[];
}

// Example: "Duplicate the first upgrade on each floor"
// This is a NewMechanic, not a stat or trigger
interface NewMechanic {
  id:     string;   // e.g. "first_upgrade_duplicate"
  params: Record<string, unknown>;
}
```

---

### RELIC CATALOGUE (50)

#### MULTIPLIER RELICS (12)

| # | Name | Effect |
|---|------|--------|
| 1 | **Philosopher's Stone** | All gold gains are doubled. |
| 2 | **Resonance Crystal** | The 5th upgrade of any type costs 0 gold and counts double for synergy purposes. |
| 3 | **Mirror Lens** | Reflect % is doubled. |
| 4 | **Amplifier** | Every damage bonus from synergy upgrades is doubled (not starters). |
| 5 | **Bloody Prism** | Lifesteal percentage applies twice (once on hit, once on tick after 0.5s). |
| 6 | **Overdrive Core** | Attack speed bonuses from ALL sources are multiplied by 1.5×. |
| 7 | **Poison Vial** | Poison tick damage doubled. Poison stack cap +5. |
| 8 | **Solar Lens** | Burn tick damage doubles each second the enemy has been burning. |
| 9 | **Storm Battery** | Lightning chain damage increases by 15% per chain (multiplicative). |
| 10 | **Whetstone** | Crit damage multiplier increased by 75%. |
| 11 | **Army Insignia** | Each summon's stats scale with your summon count (1.1× per additional summon). |
| 12 | **Compound Formula** | Each Relic you own gives +5% to ALL damage. |

---

#### CONVERTER RELICS (10)

| # | Name | Effect |
|---|------|--------|
| 13 | **Alchemy Engine** | Convert 50% of armor into lifesteal (1 armor = 0.5% lifesteal). Both effects are active. |
| 14 | **Rage Lens** | Convert 50% of damage bonus from Rage upgrades into permanent HP healing on kill. |
| 15 | **Static Converter** | Convert 50% of your attack speed into crit chance (every 0.1 spd = 5% crit). |
| 16 | **Pain Feedback** | Convert 30% of all damage you take into a delayed counter-hit 1s later. |
| 17 | **Life Engine** | Convert excess lifesteal (healing beyond max HP) into a permanent +1 max HP (stacks per heal event). |
| 18 | **Gold Forge** | Convert gold to temporary attack speed every floor (every 20g = +0.1 spd). Gold is not consumed. |
| 19 | **Toxin Siphon** | Each poison stack on target converts to 1% lifesteal per second they remain alive. |
| 20 | **Volatile Core** | Each burn tick converts 20% of its damage into an equal shield. |
| 21 | **Echo Synapse** | 25% of your largest single-category bonus is added to ALL other categories. |
| 22 | **Dark Fusion** | Combine your two highest stat upgrades. Each contributes 75% instead of 100%. Total output is 150% of one. |

---

#### ENABLER RELICS (14)

| # | Name | Effect |
|---|------|--------|
| 23 | **First Strike Token** | Duplicate the first upgrade chosen after each upgrade screen. |
| 24 | **Rarity Magnet** | Gain +1 damage for each unique rarity of upgrade currently owned. |
| 25 | **Phantom Blade** | Your attacks spawn ghostly afterimages 0.3s later dealing 40% of attack damage. |
| 26 | **Overheal Bomb** | When healed beyond max HP, release an explosion dealing 15% max HP to the enemy. |
| 27 | **Shield Reactor** | Convert excess healing into a persistent shield. Shield activates when HP is full. Max 30% of max HP. |
| 28 | **Combat Drug** | Track "damage taken this floor." At floor end, gain temporary +1% damage per 5 damage taken (stacks, lasts 5 floors). |
| 29 | **Echo Rune** | Each active buff on the player randomly triggers an additional tick of effect every 5s. |
| 30 | **Quantum Tunnel** | Once per floor, when an enemy would deal lethal damage, teleport (skip) to 1 HP and the enemy takes 200% of their own attack. |
| 31 | **Resonant Mind** | Whenever you gain any upgrade, all your summons also gain a 30% stat increase for 1 floor. |
| 32 | **Soul Anchor** | If you have not taken damage for 3s, gain +50% damage and +25% attack speed until next hit. |
| 33 | **Fuse Box** | Combine burn and lightning into "Storm Flame." Storm Flame ticks every 0.3s (faster than either alone) for 70% of each type's damage. |
| 34 | **Parasite** | After each boss kill, absorb the boss's primary stat and add a fractional version (+10% of their damage) permanently. |
| 35 | **Mimic** | On floor start, copy the enemy's highest stat as a bonus for that floor only. |
| 36 | **Catalyst** | The first upgrade of each category you take also triggers a free upgrade offer. |

---

#### CONDITIONAL RELICS (8)

| # | Name | Effect |
|---|------|--------|
| 37 | **No Mercy** | Deal +40% damage to enemies below 30% HP. |
| 38 | **Bloodied Fury** | While below 50% HP, gain +1 armor per second. At full HP, lose all stacked armor. |
| 39 | **Perfect Timing** | If you kill an enemy within 5s of it spawning, gain a permanent +2 damage for this run. |
| 40 | **Pacifist's Gambit** | At floor start, if you have no starters with damage bonuses, gain +100% damage for the floor. |
| 41 | **Streak Keeper** | If you clear a floor without taking damage, the next upgrade offer shows only Rare or Legendary options. |
| 42 | **Last Resort** | At 1 HP, all damage is multiplied by 10× for 3s. Recharges on floor clear. |
| 43 | **Boss Trophy** | Each boss kill permanently increases damage by 5%. |
| 44 | **Hoarder's Reward** | If you have not spent any gold in 3 floors, your next upgrade is guaranteed Legendary. |

---

#### ECHO RELICS (6)

| # | Name | Effect |
|---|------|--------|
| 45 | **Mirror Copy** | Each upgrade from your most common category gives a 20% bonus to your second most common category. |
| 46 | **Deja Vu** | After each upgrade screen, there is a 15% chance to be offered the same three choices again. |
| 47 | **Recursion** | Every 10 floors, repeat the effect of your lowest-stack upgrade for free. |
| 48 | **Parallel Run** | A ghost version of your floor-1 self runs alongside you (base stats only). Ghost attacks deal 15% damage and can trigger lifesteal. |
| 49 | **Fractal** | Your three most recently applied upgrade effects each also trigger at 25% of their normal power whenever any of them trigger. |
| 50 | **The Loop** | On floor 20, the run resets to floor 1 with all upgrades and relics intact. Enemy scaling restarts but continues from where it left off. Intended for extreme late game. |

---

## PHASE 4 — ADVANCED UPGRADE DRAFTING

### Design Goals
Replace random upgrade selection with an intelligent draft system that:
1. Presents 3 choices from a weighted rarity pool
2. Secretly biases toward upgrades that synergize with the player's existing build
3. Gradually reinforces a coherent build archetype over time
4. Sometimes injects "pivot" options that tempt the player to switch archetypes

### Retention Impact
The draft system creates the feeling that "the game is talking to you."
Players feel guided toward powerful builds without feeling railroaded.
The pivot options create agonizing decisions: "I've committed to poison, but this
Eternal Crit keystone would be insane if I switch now."

### Balance Risks
- Synergy biasing must not be so strong that players always end up with the same build
- The "intelligently offered" upgrades should feel earned, not handed
- Keystones must be rarer at early floors — being offered Glass Cannon on Floor 1 is a trap

### Architecture

#### Rarity Weights by Floor

```
Floor 1–3:   Common 80%, Uncommon 18%, Rare 2%, Legendary 0%
Floor 4–6:   Common 60%, Uncommon 28%, Rare 10%, Legendary 2%
Floor 7–10:  Common 40%, Uncommon 30%, Rare 22%, Legendary 8%
Floor 11–15: Common 20%, Uncommon 30%, Rare 32%, Legendary 18%
Floor 16+:   Common 10%, Uncommon 25%, Rare 35%, Legendary 30%
```

Keystone upgrades are sub-pool of Legendary (1-in-3 chance a Legendary slot becomes a Keystone).

#### Synergy Biasing Algorithm

```typescript
interface DraftBias {
  categoryWeights: Record<BuildCategory, number>;   // 1.0 = neutral
  tagWeights:      Record<string, number>;
  excludeIds:      string[];   // Already owned max-stack upgrades
}

function computeBias(ownedUpgrades: OwnedUpgrade[]): DraftBias {
  // 1. Count upgrades per category
  const catCounts = countByCategory(ownedUpgrades);
  // 2. Top 2 categories get +50% weight (coherent build reinforcement)
  // 3. Categories with 0 upgrades get −20% weight (avoid orphaned options)
  // 4. Categories with synergy with top-2 get +25% weight
  // 5. Every 5th upgrade offer: "pivot" — inject top-rated upgrade from lowest-weight category
}
```

#### Draft Generation Steps

1. Determine rarity for each of 3 slots (floor-based weights)
2. For each slot: filter upgrade pool by rarity
3. Apply `DraftBias` to filter weights
4. Roll from weighted pool
5. Guarantee: if player has 2+ upgrades in a category, at least 1 of 3 choices matches or synergizes
6. Guarantee: no duplicate IDs in one offer
7. If a keystone is drawn: replace all 3 choices with a dedicated keystone choice screen

#### Data Structures

```typescript
interface DraftState {
  currentOffer:     UpgradeDefinition[];
  offerHistory:     string[][];         // Track what was offered (analytics)
  activeBias:       DraftBias;
  pivotCountdown:   number;             // Counts to 5, then forces a pivot
  keystoneLocked:   boolean;            // True after first keystone taken
}

interface DraftConfig {
  offerCount:       number;             // 3
  rarityWeights:    RarityWeightTable;  // By floor range
  biasStrength:     number;             // 0–1, how strongly to apply synergy bias
  pivotInterval:    number;             // Every N upgrades, force a pivot option
}
```

#### The Archetype Reinforcement System

Once the player has 4+ upgrades in a single category, they are classified as having an "archetype."
The draft system then enters **Archetype Mode**:

- 2 of 3 choices always come from the player's archetype (including its synergies)
- 1 choice is always a wildcard (any category, any rarity)
- Transformation upgrades for the archetype become 2× more likely
- The player's keystone for that archetype becomes eligible at floor 7 (normally floor 10)

This creates a "commitment rewards" loop: the more you invest, the better the game feeds your build.

---

## PHASE 5 — PLAYER STATISTICS PANEL

### Design Goals
Players should be able to see exactly why they are powerful.
The panel transforms the abstract "build" into concrete numbers that validate decisions.
Seeing "DPS: 2,840" after stacking crit upgrades is a dopamine hit.

### Retention Impact
Players who understand their build optimize it more. They start runs with a target statistic in
mind ("can I get DPS above 5000 this run?"). The panel creates numeric goals alongside the
floor goal.

### Balance Risks
- Displaying raw DPS may make the game feel like a math problem rather than a game
- Stats that the player can't influence (e.g., Effective HP) may create confusion, not clarity
- The panel must update smoothly without performance impact (throttle to 10fps update rate)

### Architecture

#### Computed Statistics

```typescript
interface LiveStats {
  // Attack
  attackSpeed:       number;   // attacks/sec
  baseDamage:        number;
  critChance:        number;   // 0–1
  critDamage:        number;   // multiplier

  // Derived damage
  effectiveDPS:      number;   // baseDamage × atkSpeed × (1 + critChance × (critDmg - 1))
  highestHit:        number;   // tracked per run

  // DoT
  poisonDPS:         number;   // stacks × tickDmg / tickInterval
  burnDPS:           number;
  lightningDPS:      number;   // estimated from chain proc rate

  // Sustain
  lifestealPercent:  number;
  HPS:               number;   // effectiveDPS × lifestealPercent

  // Defense
  armor:             number;
  effectiveHP:       number;   // maxHP × (1 / (1 - dmgReduction))
  reflectPercent:    number;

  // Economy
  goldPerFloor:      number;

  // Run totals (persistent over run)
  totalDamageDone:   number;
  totalHealingDone:  number;
  totalKills:        number;
}
```

#### Panel Modes

**Compact Mode** (always visible, right side of screen, collapsed by default):
```
DPS  2,840 | HP  89/125 | EHP  312
```

**Expanded Mode** (toggle via Tab key or UI button):
```
┌─────────────────────────────┐
│  COMBAT STATISTICS          │
├────────────────┬────────────┤
│ Attack Speed   │ 1.85 /s    │
│ Base Damage    │ 47         │
│ Crit Chance    │ 35%        │
│ Crit Damage    │ 280%       │
│ Effective DPS  │ 2,840      │
│ Highest Hit    │ 312        │
├────────────────┼────────────┤
│ Poison DPS     │ 120        │
│ Burn DPS       │ 85         │
│ Lightning DPS  │ ~340       │
├────────────────┼────────────┤
│ Lifesteal      │ 12%        │
│ HPS            │ 341        │
├────────────────┼────────────┤
│ Armor          │ 18         │
│ Eff. HP        │ 281        │
│ Reflect        │ 30%        │
├────────────────┼────────────┤
│ Total Dmg Done │ 47,280     │
│ Total Healing  │ 8,460      │
└────────────────┴────────────┘
```

The panel is a separate `StatsPanel` Phaser GameObject. It reads from a `LiveStatsCalculator`
service (no Phaser dependency) that is updated every 100ms during combat. The panel itself
re-renders on change, not on tick.

---

## PHASE 6 — COMBAT FEEDBACK

### Design Goals
Every mechanic should have a visual representation. Players should be able to *watch* their
build working without looking at the stats panel.

### Retention Impact
Visual feedback creates "feel." A build that looks impressive *feels* impressive. Players
share screenshots and clips — this is free marketing.

### Balance Risks
Screen clutter. At high attack speeds with AoE + DoT + summons, the screen can become unreadable.
Every visual element must have a `simplify` mode that activates above a threshold of simultaneous
elements.

### Architecture

#### Floating Number System

```typescript
interface FloatingNumber {
  value:    number;
  type:     FloatType;
  x:        number;
  y:        number;
  lifetime: number;    // ms
}

type FloatType =
  | 'damage'         // white
  | 'crit'           // yellow, large
  | 'heal'           // green
  | 'poison'         // purple, small
  | 'burn'           // orange, small
  | 'lightning'      // electric blue
  | 'reflect'        // mirror-silver
  | 'absorb'         // shield-blue
  | 'overheal';      // bright green pulse
```

#### Status Icons
Each active status effect on the player or enemy has a small icon that:
- Shows a stack count for stackable effects (poison, combo, rage)
- Pulses on new stacks
- Fades when effect expires

#### Special Visual Events
- **Critical hit:** Camera micro-shudder (2px, 80ms) + hit-stop (2 frame pause) + large yellow number
- **Kill:** Enemy flash-white → dissolve particle
- **Boss damage:** Extra-large floaters with glow outline
- **Keystone activation:** Full-screen flash + keystone icon appears in corner of screen

---

## PHASE 7 — FLOOR VARIANTS

### Design Goals
Floor variants prevent the run from becoming a rhythm game. The player should not be able to
"autopilot" through floors 1–5 every run. Variants create moments of adaptation.

### Retention Impact
A bad floor variant that punishes a specific build creates memorable failure stories ("I had a
perfect Poison build but hit a Fireproof floor and lost"). Players adapt, learn, try again.

### Balance Risks
- Curse variants must have proportionally better rewards or players will feel punished for no reason
- Treasure and Merchant floors must feel valuable, not like "skip a real floor"
- Floor variants should never be 100% mandatory — let the player refuse with a cost

### Architecture

```typescript
interface FloorVariant {
  id:           string;
  name:         string;
  description:  string;
  type:         'combat' | 'treasure' | 'merchant' | 'elite' | 'chaos' | 'event';
  frequency:    number;     // 0–1, probability weight
  minFloor:     number;     // Earliest floor it can appear
  effects:      FloorEffect[];
  rewards:      FloorReward[];
  canRefuse?:   boolean;    // Player can skip at a cost
  refuseCost?:  FloorRefuseCost;
}
```

---

### FLOOR VARIANT CATALOGUE (22)

| # | Name | Type | Effect | Reward |
|---|------|------|--------|--------|
| 1 | **Cursed Floor** | Combat | Enemy +50% HP, +25% damage | +2 upgrade choices instead of 1 |
| 2 | **Treasure Floor** | Treasure | No combat | Choose 1 of 3 relics |
| 3 | **Elite Floor** | Elite | One enemy with 3× HP and a special trait | Guaranteed Rare upgrade |
| 4 | **Chaos Floor** | Chaos | Random global modifier each visit | +1 upgrade, random rarity |
| 5 | **Merchant Floor** | Merchant | Shop: buy upgrades/relics with gold | — |
| 6 | **Echo Floor** | Combat | Your previous floor's enemy re-appears at 150% power | Double gold payout |
| 7 | **Gauntlet Floor** | Elite | 3 enemies in sequence with no heal between | +1 keystone offer if all killed |
| 8 | **Blessed Floor** | Treasure | Enemy +25% HP | All 3 upgrade choices are Rare or higher |
| 9 | **Fireproof Floor** | Chaos | Burn and lightning deal 0 damage | Enemies drop double gold |
| 10 | **Immune Floor** | Chaos | Enemy is immune to poison this floor | Bonus armor permanently |
| 11 | **Speed Surge** | Chaos | All attack speeds doubled (player AND enemy) | If survived: +15% permanent attack speed |
| 12 | **Mirror Floor** | Chaos | Enemy reflects 50% of all incoming damage | If survived: Mirror Lens relic |
| 13 | **Rest Stop** | Treasure | Restore 50% HP | No upgrade; gold bonus instead |
| 14 | **Dark Bargain** | Event | Choose: lose 30% HP for a Legendary upgrade, or skip | Player decides |
| 15 | **Sacrifice Floor** | Event | Sacrifice an owned upgrade to copy one of three Rare upgrades | Opt-in only |
| 16 | **Corruption Floor** | Chaos | One owned upgrade is temporarily disabled this floor | Disabled upgrade is doubled next floor |
| 17 | **Ghost Horde** | Combat | 5 weak enemies instead of 1 | Area damage upgrades shine here; +1 summon temp. |
| 18 | **Boss Rush** | Elite | Mini-boss from a previous floor reappears | Boss trophy relic if defeated |
| 19 | **Gambler's Floor** | Event | Spend gold to roll for upgrade rarity (50g: random, 150g: Rare guaranteed, 500g: Legendary guaranteed) | — |
| 20 | **Training Ground** | Treasure | No enemy | Permanently increase one stat of your choice by 10% |
| 21 | **Paradox Floor** | Chaos | All damage types are swapped (poison deals burn, lightning deals reflect) | Permanent +20% to the swapped type you killed with |
| 22 | **The Abyss** | Elite | An impossible-seeming enemy (×10 HP of normal) | Defeating grants 300 gold + relic choice. Refusing costs 50 gold. |

---

## PHASE 8 — CLASSES

### Design Goals
Classes are the last layer added — after all build systems work — because they modify HOW
upgrades behave rather than WHAT upgrades are available. A class without a functioning
upgrade ecosystem is just a different skin.

Classes work through three mechanisms:
1. **Pool Bias:** Certain categories appear more frequently in drafts
2. **Modifier Rules:** Specific upgrade effects are amplified or altered
3. **Starting State:** Different initial stats and one free starting upgrade

### Retention Impact
Classes create "run seeding" — the player decides what kind of run they want *before* it starts.
This extends "one more run" psychology because now they're chasing both a build AND a class
mastery achievement.

### Balance Risks
- Classes that are purely better than the classless state will be taken every time
- Classes that conflict with popular keystones create trap combinations
- "Class locked" builds (can only work with one class) reduce experimentation

### Architecture

```typescript
interface ClassDefinition {
  id:              string;
  name:            string;
  lore:            string;
  startingStats:   Partial<CombatStats>;
  startingUpgrade: string;             // Free upgrade ID at run start
  poolBias:        Record<BuildCategory, number>;   // Multipliers on draft weights
  modifiers:       ClassModifier[];
  synergies:       string[];           // Keystone IDs that interact specially with this class
}

interface ClassModifier {
  // "Whenever you gain a [category] upgrade, also gain [effect]"
  trigger:  string;
  effect:   TriggerAction;
}
```

---

### CLASS CATALOGUE (8 Classes)

#### 1. NECROMANCER
*"They don't truly die. They just change employers."*
- **Starting:** Free Familiar (Summons starter)
- **Pool Bias:** Summons +100%, Poison +50%, Cooldown +25%
- **Modifier:** Each Summons upgrade also permanently increases summon count cap by 1
- **Modifier:** Poison upgrades also apply to summons at 60% effectiveness
- **Synergy — Lich Form:** Lich Form grants +2 extra summon slots. Summons inherit 50% of your upgrades (normally 25%)

#### 2. ASSASSIN
*"The first hit is guaranteed. The rest are art."*
- **Starting:** Free Eagle Eye (Critical starter)
- **Pool Bias:** Critical +100%, Berserker +50%, Damage +25%
- **Modifier:** All Critical upgrades gain +15% of their listed effect
- **Modifier:** First attack each floor is guaranteed to crit
- **Synergy — Eternal Crit:** Eternal Crit also gives +1 free hit at floor start before the enemy can attack

#### 3. PALADIN
*"The light I carry turns to a hammer."*
- **Starting:** Free Vital Strike (Lifesteal starter)
- **Pool Bias:** Lifesteal +100%, Defense +50%, Reflect +25%
- **Modifier:** All healing effects (lifesteal, potions, Blood Tap) also deal equal damage to the enemy
- **Modifier:** Defense upgrades cost 15% less in drafts
- **Synergy — Diamond Body:** Diamond Body grants a full heal on activation. The immunity period extends to 3 hits instead of 1

#### 4. PYROMANCER
*"Burn the world. Build on the ashes."*
- **Starting:** Free Kindling + Backdraft immediately available in draft (ignores tier requirement)
- **Pool Bias:** Burn +100%, Lightning +50%, Area Damage +25%
- **Modifier:** Burn duration starts at 5 ticks instead of 3
- **Modifier:** Lightning upgrades also apply their secondary effects to burning enemies
- **Synergy — Phoenix Protocol:** Revive restore increases to 75% HP. Bonus burn damage lasts 20s instead of 10s

#### 5. PLAGUE DOCTOR
*"A cure for some is a weapon for others."*
- **Starting:** Free Venom Tips + Corrosive available in draft
- **Pool Bias:** Poison +100%, Lifesteal +50%, Economy +25%
- **Modifier:** Poison stacks deal +50% damage but have a 20% longer tick interval (burst vs sustained)
- **Modifier:** Lifesteal also heals based on total poison stacks on enemy (1 stack = 0.5% bonus lifesteal)
- **Synergy — Poison Lord:** Stacks accumulate 2× faster. The no-expiry rule also applies to burn when combined with Pandemic relic

#### 6. BERSERKER
*"I stopped counting the hits. I started counting the corpses."*
- **Starting:** Free Quick Draw × 2 + Combo Sense
- **Pool Bias:** Berserker +100%, Rage +75%, Damage +25%
- **Modifier:** Combo counter never resets on damage taken (only resets on floor end)
- **Modifier:** Each kill above 5 in a floor gives a permanent +1% damage this run
- **Synergy — Speedforce:** Above 3.0 atk/sec, each additional 0.1 atk/sec spawns an extra projectile (was 0.5)

#### 7. ALCHEMIST
*"Everything is a resource. Especially you."*
- **Starting:** Free Compound Interest (Economy starter) + all converter relics are half-price
- **Pool Bias:** Economy +100%, Cooldown +50%, all others neutral
- **Modifier:** Converter relics apply their conversion at 125% efficiency
- **Modifier:** Each floor cleared without spending gold gives a permanent +2% damage for this run
- **Synergy — Scrooge:** Starting gold increases to 750. Gold-to-stat conversion rate improves to 2:1:1

#### 8. WARDEN
*"I don't kill enemies. I simply create unfortunate physics."*
- **Starting:** Free Shockwave + Ripple immediately available in draft
- **Pool Bias:** Area Damage +100%, Summons +50%, Defense +25%
- **Modifier:** Area damage effects trigger one additional time 0.5s after the initial hit (echo)
- **Modifier:** Summons created by the Warden deal area damage on every hit
- **Synergy — Singularity:** Singularity recharges every 3 kills (instead of per floor). Each use also applies all active DoTs to all affected enemies

---

## IMPLEMENTATION SEQUENCE

Phase order for implementation is strict. Each phase depends on the previous:

```
Phase 1  →  Build System (RulesEngine, 14 categories, 126 upgrades)
Phase 4  →  Draft System (must come before player sees upgrades from Phase 1)
Phase 2  →  Keystones (requires Draft System to gate them correctly)
Phase 3  →  Relics (requires RulesEngine from Phase 1)
Phase 6  →  Combat Feedback (requires all damage types from Phase 1 + 2 + 3)
Phase 5  →  Statistics Panel (requires all damage types to compute correctly)
Phase 7  →  Floor Variants (requires Relic/Upgrade systems to create meaningful variants)
Phase 8  →  Classes (final layer — requires all build systems operational)
```

**Start Phase 1 implementation only after confirming:**
- [ ] RulesEngine architecture is agreed upon
- [ ] CombatStats interface is extended for new damage types (poison, burn, lightning, etc.)
- [ ] TriggerDefinition system is designed and stub-implemented
- [ ] Draft UI can handle 126-upgrade pool without performance regression

---

*Document version 1.0 — Architecture review required before Phase 1 implementation begins.*
*Code generation begins on explicit request per phase.*
