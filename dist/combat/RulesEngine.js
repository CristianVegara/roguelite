function freshState() {
    return {
        hitCounter: 0, hitStreak: 0, chargeCounter: 0,
        floorKills: 0, momentumBonus: 0, overflowStored: 0,
        predatorMarkBonus: 0, hasRevived: false, phoenixBonusHits: 0,
        poisonTransferStacks: 0, poisonTransferDmg: 0,
        gold: 0, warChestBonus: 0,
        firstHitThisFloor: true, armorMultiplier: 1,
        frenzyActive: false, preFrenzyAttackSpeed: 0,
        activeModifier: null,
        darkened: false, blessed: false, thorned: false,
        volatile: false, enemyRegen: false,
        mirrored: false, vampiricEnemy: false, enraged: false,
        storm: false, weakened: false, hexed: false,
        nightmareActive: false, sanctifiedActive: false, constricting: false,
        playerSpeedMult: 1.0,
        bossesKilled: 0,
        totalDamageDealt: 0, totalHealingDone: 0, highestDamageHit: 0,
    };
}
// ---------------------------------------------------------------------------
// RulesEngine
// ---------------------------------------------------------------------------
/**
 * RulesEngine — the authoritative combat resolver for a single run.
 *
 * Created fresh by GameScene at run start.  Every upgrade's `apply()`
 * function mutates playerStats AND registers triggers / upgrade IDs here.
 *
 * GameScene replaces direct CombatCalculator calls with:
 *   engine.resolvePlayerAttack(enemy)
 *   engine.resolveEnemyAttack(rawDamage, enemy)
 *   engine.tickStatusEffects(delta, enemy)
 */
export class RulesEngine {
    constructor(playerStats) {
        this.triggers = new Map();
        this.upgradeIds = new Set();
        this.relicIds = new Set();
        this.defenseTriggers = new Map();
        this.relicDataMap = new Map();
        this.state = freshState();
        this.stats = playerStats;
    }
    // ---------------------------------------------------------------------------
    // Public API called by GameScene
    // ---------------------------------------------------------------------------
    /** Called once for each upgrade taken. id must be stable across stacks. */
    registerUpgrade(id) {
        this.upgradeIds.add(id);
    }
    unregisterUpgrade(id) {
        this.upgradeIds.delete(id);
    }
    hasUpgrade(id) {
        return this.upgradeIds.has(id);
    }
    registerRelic(id) {
        this.relicIds.add(id);
    }
    hasRelic(id) {
        return this.relicIds.has(id);
    }
    /** Returns a persistent mutable state bucket for a given relic ID. */
    getRelicData(id) {
        if (!this.relicDataMap.has(id)) {
            this.relicDataMap.set(id, {});
        }
        return this.relicDataMap.get(id);
    }
    registerTrigger(id, trigger) {
        this.triggers.set(id, trigger);
    }
    registerDefenseTrigger(id, fn) {
        this.defenseTriggers.set(id, fn);
    }
    get gold() { return this.state.gold; }
    get floorKills() { return this.state.floorKills; }
    get hitStreak() { return this.state.hitStreak; }
    get hitCount() { return this.state.hitCounter; }
    get bossesKilled() { return this.state.bossesKilled; }
    get totalDamageDealt() { return this.state.totalDamageDealt; }
    get totalHealingDone() { return this.state.totalHealingDone; }
    get highestDamageHit() { return this.state.highestDamageHit; }
    get darkened() { return this.state.darkened; }
    get volatile() { return this.state.volatile; }
    get enemyRegen() { return this.state.enemyRegen; }
    get thorned() { return this.state.thorned; }
    get activeModifier() { return this.state.activeModifier; }
    // Phase 7
    get mirrored() { return this.state.mirrored; }
    get vampiricEnemy() { return this.state.vampiricEnemy; }
    get hexed() { return this.state.hexed; }
    get nightmareActive() { return this.state.nightmareActive; }
    get sanctifiedActive() { return this.state.sanctifiedActive; }
    get playerSpeedMultiplier() { return this.state.playerSpeedMult; }
    /** Number of unique upgrades registered (for Collector's Greed). */
    upgradeCount() { return this.upgradeIds.size; }
    addGold(amount) { this.state.gold += amount; }
    /** Track healing for the stats panel. */
    trackHealing(amount) {
        this.state.totalHealingDone += amount;
    }
    onBossKilled() {
        this.state.bossesKilled++;
        // Trophy Case: +3% damage per boss
        if (this.hasUpgrade('relic_trophy_case')) {
            this.stats.damageMultiplier = (this.stats.damageMultiplier ?? 1) + 0.03;
        }
    }
    /** Effective armor accounting for Diamond Body multiplier. */
    effectiveArmor() {
        return (this.stats.armor ?? 0) * this.state.armorMultiplier;
    }
    // ---------------------------------------------------------------------------
    // Combat resolvers
    // ---------------------------------------------------------------------------
    resolvePlayerAttack(enemy) {
        const s = this.stats;
        this.state.hitCounter++;
        const result = {
            damage: 0, isCrit: false, healAmount: 0, excessHeal: 0,
            areaDamage: 0, lightningDamage: 0, summonDamage: 0,
            poisonApplied: 0, burnApplied: false, goldGained: 0,
            thornDamage: 0, mirrorDamage: 0,
            floaters: [],
        };
        // ── 1. Base damage ──────────────────────────────────────────────────
        let dmg = s.damage;
        // Overflow carryover (one-time bonus from previous overkill)
        if (this.state.overflowStored > 0 && this.hasUpgrade('overflow')) {
            dmg += this.state.overflowStored;
            this.state.overflowStored = 0;
        }
        // Predator's Mark bonus (stored from previous crit)
        if (this.state.predatorMarkBonus > 0 && this.hasUpgrade('predators_mark')) {
            dmg += this.state.predatorMarkBonus;
            this.state.predatorMarkBonus = 0;
        }
        // Momentum bonus (kills this floor)
        if (this.hasUpgrade('momentum')) {
            dmg *= (1 + this.state.momentumBonus);
        }
        // War Chest bonus (gold → damage for this floor)
        if (this.state.warChestBonus > 0) {
            dmg *= (1 + this.state.warChestBonus);
        }
        // Executioner: bonus from enemy's missing HP
        if (this.hasUpgrade('executioner') && enemy.stats.maxHp > 0) {
            const missing = 1 - (enemy.stats.hp / enemy.stats.maxHp);
            dmg += dmg * missing * 0.5;
        }
        // Living Wall: armor above 20 → bonus damage
        if (this.hasUpgrade('living_wall')) {
            const extraArmor = Math.max(0, this.effectiveArmor() - 20);
            dmg += extraArmor * 0.5;
        }
        // Combo Sense: hit streak bonus
        if (this.hasUpgrade('combo_sense')) {
            const comboBonus = Math.min(0.20, this.state.hitStreak * 0.01);
            dmg *= (1 + comboBonus);
        }
        // Infinite Assault: low base but scaling combo
        if (this.hasUpgrade('infinite_assault')) {
            const scaling = Math.pow(1.05, Math.min(this.state.hitStreak, 60));
            dmg = dmg * 0.30 * scaling;
        }
        // HP-based multipliers (Fury, Berserker's Heart, Rage God)
        const hpRatio = s.maxHp > 0 ? s.hp / s.maxHp : 1;
        if (this.hasUpgrade('rage_god')) {
            dmg *= (1 + (1 - hpRatio) * 9); // 1× at full, 10× at 1 HP
        }
        if (this.hasUpgrade('berserkers_heart') && hpRatio < 0.50)
            dmg *= 1.15;
        if (this.hasUpgrade('fury')) {
            // Each Fury stack adds 8% when below 75% HP
            if (hpRatio < 0.75)
                dmg *= 1.08;
            if (hpRatio < 0.50)
                dmg *= 1.08; // second stack
        }
        // Phoenix bonus hits
        if (this.state.phoenixBonusHits > 0) {
            dmg *= 2.0;
            this.state.phoenixBonusHits--;
        }
        // Damage multiplier (flat from stats)
        dmg *= (s.damageMultiplier ?? 1.0);
        // Blessed floor: +30% damage
        if (this.state.blessed)
            dmg *= 1.30;
        // Collector's Greed relic: +2 damage per unique upgrade
        if (this.hasUpgrade('relic_collectors_greed')) {
            dmg += this.upgradeCount() * 2;
        }
        // Void Fang relic: ignore 40% of enemy armor — handled below in armor
        // (enemy armor reduction is applied at the enemy entity, so we boost dmg here)
        if (this.hasUpgrade('relic_void_fang')) {
            const armorIgnored = (enemy.stats.armor ?? 0) * 0.40;
            dmg += armorIgnored;
        }
        dmg = Math.max(1, Math.floor(dmg));
        // ── 2. Critical hit ─────────────────────────────────────────────────
        let critChance = s.critChance;
        // Speed-to-Crit: convert attackSpeed above 1.0 to crit chance
        if (this.hasUpgrade('speed_to_crit')) {
            critChance = 0;
            const speedAboveBase = Math.max(0, s.attackSpeed - 1.0);
            critChance = Math.min(0.95, speedAboveBase * 0.8);
        }
        // Hexed floor: crit chance = 0
        if (this.state.hexed)
            critChance = 0;
        // Eternal Crit: always crit, all effects fire but no damage multiplier
        const isCrit = this.hasUpgrade('eternal_crit') && !this.state.hexed
            ? true
            : Math.random() < critChance;
        if (isCrit) {
            // Darkened floor: crits deal no bonus damage — effects still fire
            if (!this.hasUpgrade('eternal_crit') && !this.state.darkened) {
                dmg = Math.floor(dmg * (s.critMultiplier ?? 2.0));
            }
            // Predator's Mark: store 20% of crit as bonus for next hit
            if (this.hasUpgrade('predators_mark')) {
                this.state.predatorMarkBonus = dmg * 0.2;
            }
            result.isCrit = true;
        }
        result.damage = dmg;
        // ── 3. Streak / combo tracking ───────────────────────────────────────
        this.state.hitStreak++;
        // ── 4. Lifesteal ─────────────────────────────────────────────────────
        const lsRate = (s.lifesteal ?? 0) * (this.hasUpgrade('bloodlust') && hpRatio < 0.50 ? 3 : 1);
        const rawHeal = Math.floor(dmg * lsRate);
        const hpHeadroom = s.maxHp - s.hp;
        result.healAmount = Math.min(rawHeal, hpHeadroom);
        result.excessHeal = Math.max(0, rawHeal - hpHeadroom);
        // Vital Strike: every 3rd hit heals flat 8 HP
        if (this.hasUpgrade('vital_strike') && this.state.hitCounter % 3 === 0) {
            const vitalHeal = Math.min(8, s.maxHp - (s.hp + result.healAmount));
            result.healAmount += Math.max(0, vitalHeal);
        }
        if (result.healAmount > 0) {
            result.floaters.push({ value: Math.ceil(result.healAmount), type: 'heal', target: 'player' });
        }
        // ── 5. Summon damage ────────────────────────────────────────────────
        const sc = s.summonCount ?? 0;
        if (sc > 0) {
            const summonBase = dmg * (s.summonDamagePercent ?? 0.2);
            // Coordinated Strike: crit → all summons attack simultaneously
            const summonMult = (isCrit && this.hasUpgrade('coordinated_strike')) ? sc : 1;
            result.summonDamage = Math.floor(summonBase * summonMult);
            if (result.summonDamage > 0) {
                result.floaters.push({ value: result.summonDamage, type: 'summon', target: 'enemy' });
            }
        }
        // ── 6. Poison proc ───────────────────────────────────────────────────
        const pChance = s.poisonChance ?? 0;
        if (pChance > 0 && Math.random() < pChance) {
            const stacks = s.poisonStacks ?? 1;
            result.poisonApplied = stacks;
        }
        // Always-on poison from reactive_venom (crit → triple stacks)
        if (isCrit && this.hasUpgrade('reactive_venom') && result.poisonApplied === 0) {
            result.poisonApplied = (s.poisonStacks ?? 1) * 3;
        }
        else if (isCrit && this.hasUpgrade('reactive_venom')) {
            result.poisonApplied *= 3;
        }
        // ── 7. Burn proc ─────────────────────────────────────────────────────
        const bChance = s.burnChance ?? 0;
        if (bChance > 0 && Math.random() < bChance) {
            result.burnApplied = true;
        }
        // Spontaneous Combustion: single hit > 30% enemy maxHp → instant burn
        if (!result.burnApplied && this.hasUpgrade('spontaneous_combustion')) {
            if (enemy.stats.maxHp > 0 && dmg > enemy.stats.maxHp * 0.30) {
                result.burnApplied = true;
            }
        }
        // ── 8. Lightning proc ────────────────────────────────────────────────
        let lightningProc = false;
        if (this.hasUpgrade('ball_lightning')) {
            // Archmage class fires every 2 attacks; normally every 3
            const threshold = this.hasUpgrade('archmage_class') ? 2 : 3;
            this.state.chargeCounter++;
            if (this.state.chargeCounter >= threshold) {
                lightningProc = true;
                this.state.chargeCounter = 0;
            }
        }
        else {
            const lChance = s.lightningChance ?? 0;
            if (lChance > 0 && Math.random() < lChance)
                lightningProc = true;
        }
        // Overload: crit → always chain lightning
        if (isCrit && this.hasUpgrade('overload'))
            lightningProc = true;
        // Thunder Engine: crit → massive lightning
        if (isCrit && this.hasUpgrade('thunder_engine'))
            lightningProc = true;
        if (lightningProc) {
            const lDmg = Math.floor(dmg * (s.lightningDamage ?? 0.5));
            result.lightningDamage = lDmg;
            result.floaters.push({ value: lDmg, type: 'lightning', target: 'enemy' });
        }
        // ── 9. Area damage ───────────────────────────────────────────────────
        const areaFrac = s.areaPercent ?? 0;
        if (areaFrac > 0) {
            result.areaDamage += Math.floor(dmg * areaFrac);
        }
        const everyN = s.areaEveryNHits ?? 0;
        if (everyN > 0 && this.state.hitCounter % everyN === 0) {
            result.areaDamage += Math.floor(dmg * 0.4); // Shockwave: 40%
        }
        if (result.areaDamage > 0) {
            result.floaters.push({ value: result.areaDamage, type: 'area', target: 'enemy' });
        }
        // ── 10. Floaters for main hit ────────────────────────────────────────
        result.floaters.unshift(isCrit
            ? { value: result.damage, type: 'crit', target: 'enemy' }
            : { value: result.damage, type: 'damage', target: 'enemy' });
        // ── 11. onHit triggers ───────────────────────────────────────────────
        const ctx = { stats: this.stats, engine: this, enemy, damage: dmg, isCrit: result.isCrit, result };
        this.fireTriggers('onHit', ctx);
        if (isCrit)
            this.fireTriggers('onCrit', ctx);
        // ── 12. Gold (Midas Touch) ───────────────────────────────────────────
        if (isCrit && this.hasUpgrade('midas_touch')) {
            result.goldGained += 1;
            this.state.gold += 1;
        }
        // ── 13. Thorned floor modifier: recoil damage ────────────────────────
        if (this.state.thorned) {
            result.thornDamage = Math.max(1, Math.floor(result.damage * 0.15));
        }
        // ── 14. Mirrored floor: enemy reflects 20% of damage taken ───────────
        if (this.state.mirrored) {
            result.mirrorDamage = Math.max(1, Math.floor(result.damage * 0.20));
        }
        // ── 15. Storm floor: extra 35% lightning chain ────────────────────────
        if (this.state.storm && !lightningProc && Math.random() < 0.35) {
            const lDmg = Math.floor(dmg * Math.max(s.lightningDamage ?? 0.5, 0.5));
            if (lDmg > 0) {
                result.lightningDamage += lDmg;
                result.floaters.push({ value: lDmg, type: 'lightning', target: 'enemy' });
            }
        }
        // ── 14. Alchemist's Flask relic: convert part of future damage taken ──
        // (handled in resolveEnemyAttack)
        // ── 15. Combat stat tracking ─────────────────────────────────────────
        const totalHit = result.damage + result.areaDamage + result.lightningDamage + result.summonDamage;
        this.state.totalDamageDealt += totalHit;
        if (result.damage > this.state.highestDamageHit) {
            this.state.highestDamageHit = result.damage;
        }
        return result;
    }
    // ---------------------------------------------------------------------------
    resolveEnemyAttack(rawDamage, enemy) {
        const s = this.stats;
        const result = {
            damageTaken: 0, shieldAbsorbed: 0, reflectDamage: 0, enemyHeal: 0, floaters: [],
        };
        // Enraged modifier: enemy deals more damage as its HP drops
        if (this.state.enraged && enemy.stats.maxHp > 0) {
            const missingHpRatio = 1 - (enemy.stats.hp / enemy.stats.maxHp);
            rawDamage = Math.floor(rawDamage * (1 + missingHpRatio * 1.6));
        }
        // Diamond Body: immune to first hit this floor
        if (this.hasUpgrade('diamond_body') && this.state.firstHitThisFloor) {
            this.state.firstHitThisFloor = false;
            this.state.armorMultiplier = 2; // armor doubles after first hit
            result.damageTaken = 0;
            return result; // full immunity — no other effects
        }
        // Karma: take only 25% of damage
        const damageFactor = this.hasUpgrade('karma') ? 0.25 : 1.0;
        // Weakened modifier: both sides ignore armor
        const armor = this.state.weakened ? 0 : this.effectiveArmor();
        let mitigated = Math.max(1, rawDamage * damageFactor - armor);
        // Shield absorption
        const shield = s.shield ?? 0;
        if (shield > 0 && s.maxShield) {
            const absorbed = Math.min(mitigated, shield);
            s.shield = shield - absorbed;
            result.shieldAbsorbed = absorbed;
            mitigated -= absorbed;
            if (result.shieldAbsorbed > 0) {
                result.floaters.push({ value: result.shieldAbsorbed, type: 'shield', target: 'player' });
            }
        }
        result.damageTaken = Math.max(0, Math.floor(mitigated));
        // Vampiric enemy: heals 8% of damage it deals
        if (this.state.vampiricEnemy && result.damageTaken > 0) {
            result.enemyHeal = Math.floor(result.damageTaken * 0.08);
        }
        // Reflect
        const rp = s.reflectPercent ?? 0;
        if (rp > 0) {
            result.reflectDamage = Math.floor(result.damageTaken * rp);
            if (result.reflectDamage > 0) {
                result.floaters.push({ value: result.reflectDamage, type: 'reflect', target: 'enemy' });
            }
        }
        // Karma reflect (75% of original)
        if (this.hasUpgrade('karma')) {
            result.reflectDamage = Math.max(result.reflectDamage, Math.floor(rawDamage * 0.75));
        }
        // Alchemist's Flask relic: 20% of incoming damage → healing
        if (this.hasUpgrade('relic_alchemist_flask') && result.damageTaken > 0) {
            const converted = Math.floor(result.damageTaken * 0.20);
            result.damageTaken = Math.max(0, result.damageTaken - converted);
            // Healing handled in GameScene (it has access to player.heal)
            // Store in floaters so GameScene can pick it up
            if (converted > 0) {
                result.floaters.push({ value: converted, type: 'heal', target: 'player' });
            }
        }
        // Reset hit streak
        this.state.hitStreak = 0;
        // Frenzy: activate bonus when below 50% HP (after taking damage).
        // Store pre-frenzy speed and restore it exactly to prevent float drift.
        if (this.hasUpgrade('frenzy')) {
            const hpAfter = s.hp - result.damageTaken;
            const ratioAfter = hpAfter / s.maxHp;
            if (!this.state.frenzyActive && ratioAfter < 0.50) {
                this.state.frenzyActive = true;
                this.state.preFrenzyAttackSpeed = s.attackSpeed; // store exact value
                s.attackSpeed = parseFloat((s.attackSpeed * 1.6).toFixed(3));
            }
            if (this.state.frenzyActive && ratioAfter >= 0.50) {
                this.state.frenzyActive = false;
                // Restore exact pre-frenzy speed — never divide (avoids float drift)
                if (this.state.preFrenzyAttackSpeed > 0) {
                    s.attackSpeed = this.state.preFrenzyAttackSpeed;
                }
                this.state.preFrenzyAttackSpeed = 0;
            }
        }
        // Grudge: each hit taken adds 1% reflect permanently
        if (this.hasUpgrade('grudge')) {
            s.reflectPercent = parseFloat(((s.reflectPercent ?? 0) + 0.01).toFixed(3));
        }
        // Reactive Plating: gain 5 armor for 3s (tracked via flag, restored in onFloorStart)
        // Simplified in Phase 1: each hit adds 1 flat armor (simulating the reactive bonus)
        if (this.hasUpgrade('reactive_plating')) {
            s.armor += 1;
        }
        // Defense triggers
        const dCtx = { stats: this.stats, engine: this, rawDamage, result };
        this.defenseTriggers.forEach(fn => fn(dCtx));
        if (result.damageTaken > 0) {
            result.floaters.unshift({ value: result.damageTaken, type: 'damage', target: 'player' });
        }
        return result;
    }
    // ---------------------------------------------------------------------------
    // Status effect ticking
    // ---------------------------------------------------------------------------
    tickStatusEffects(delta, enemy) {
        const tick = { poisonDamage: 0, burnDamage: 0, burnIsCrit: false, dotHeal: 0, enemyRegenHeal: 0 };
        const vampiric = this.hasUpgrade('vampiric_aura');
        const lsRate = this.stats.lifesteal ?? 0;
        // ── Poison ───────────────────────────────────────────────────────────
        const ps = enemy.statusEffects.poison;
        if (ps && ps.stacks > 0) {
            ps.tickTimer += delta;
            while (ps.tickTimer >= ps.tickIntervalMs) {
                ps.tickTimer -= ps.tickIntervalMs;
                const dmg = ps.stacks * ps.damagePerStack;
                tick.poisonDamage += dmg;
                // Plague Bell relic: 20% chance to add 1 extra stack per tick
                if (this.hasUpgrade('relic_plague_bell') && Math.random() < 0.20) {
                    const cap = this.stats.poisonMaxStacks ?? 10;
                    if (cap === 0 || ps.stacks < cap) {
                        ps.stacks++;
                    }
                }
                // Poison Lord: stacks never expire (skip reduction logic)
                if (!this.hasUpgrade('poison_lord')) {
                    // Phase 1 simplification: stacks persist until enemy dies or floor ends.
                }
            }
            if (vampiric && tick.poisonDamage > 0) {
                tick.dotHeal += Math.floor(tick.poisonDamage * lsRate);
            }
        }
        // ── Burn ─────────────────────────────────────────────────────────────
        const bs = enemy.statusEffects.burn;
        if (bs && bs.durationMs > 0) {
            bs.durationMs -= delta;
            bs.tickTimer += delta;
            while (bs.tickTimer >= bs.tickIntervalMs && bs.durationMs > -bs.tickIntervalMs) {
                bs.tickTimer -= bs.tickIntervalMs;
                let dmg = bs.damagePerTick;
                let isCrit = false;
                if (bs.canCrit && Math.random() < (this.stats.critChance ?? 0)) {
                    dmg = Math.floor(dmg * (this.stats.critMultiplier ?? 2.0));
                    isCrit = true;
                }
                tick.burnDamage += dmg;
                tick.burnIsCrit = tick.burnIsCrit || isCrit;
            }
            if (bs.durationMs <= 0) {
                enemy.statusEffects.burn = null;
            }
            if (vampiric && tick.burnDamage > 0) {
                tick.dotHeal += Math.floor(tick.burnDamage * lsRate);
            }
        }
        // ── Regenerating floor modifier ───────────────────────────────────────
        if (this.state.enemyRegen) {
            // Accumulate regen in tickTimer reuse — we use a simple per-second rate
            // GameScene delta is in ms; we give 1% max HP per second
            tick.enemyRegenHeal = Math.floor(enemy.stats.maxHp * 0.01 * (delta / 1000));
        }
        return tick;
    }
    // ---------------------------------------------------------------------------
    // Floor / kill events
    // ---------------------------------------------------------------------------
    onFloorStart(modifier) {
        this.state.floorKills = 0;
        this.state.momentumBonus = 0;
        this.state.firstHitThisFloor = true;
        this.state.armorMultiplier = 1;
        // Frenzy: restore base speed on floor transition if bonus was active
        if (this.state.frenzyActive && this.state.preFrenzyAttackSpeed > 0) {
            this.stats.attackSpeed = this.state.preFrenzyAttackSpeed;
        }
        this.state.frenzyActive = false;
        this.state.preFrenzyAttackSpeed = 0;
        // Apply floor modifier flags
        this.state.activeModifier = modifier?.type ?? null;
        this.state.darkened = modifier?.engineFlag === 'darkened';
        this.state.blessed = modifier?.engineFlag === 'blessed';
        this.state.thorned = modifier?.engineFlag === 'thorned';
        this.state.volatile = modifier?.engineFlag === 'volatile';
        this.state.enemyRegen = modifier?.engineFlag === 'regenerating';
        // Phase 7
        this.state.mirrored = modifier?.engineFlag === 'mirrored';
        this.state.vampiricEnemy = modifier?.engineFlag === 'vampiric_enemy';
        this.state.enraged = modifier?.engineFlag === 'enraged';
        this.state.storm = modifier?.engineFlag === 'storm';
        this.state.weakened = modifier?.engineFlag === 'weakened';
        this.state.hexed = modifier?.engineFlag === 'hexed';
        this.state.nightmareActive = modifier?.engineFlag === 'nightmare';
        this.state.sanctifiedActive = modifier?.engineFlag === 'sanctified';
        this.state.constricting = modifier?.engineFlag === 'constricting';
        this.state.playerSpeedMult = modifier?.playerSpeedMultiplier ?? 1.0;
        // War Chest: convert current gold to floor damage bonus
        if (this.hasUpgrade('war_chest') && this.state.gold > 0) {
            this.state.warChestBonus = Math.floor(this.state.gold / 10) * 0.01;
        }
        else {
            this.state.warChestBonus = 0;
        }
        this.fireTriggers('onFloorStart', {
            stats: this.stats, engine: this, enemy: null,
            damage: 0, isCrit: false, result: this.emptyAttackResult(),
        });
    }
    /**
     * Called by GameScene on enemy kill.
     * Returns a pending HP heal to apply to the player (from kill-triggered heals).
     */
    onEnemyKilled(enemy) {
        this.state.floorKills++;
        let pendingHeal = 0;
        // Berserker class: 5% max HP on kill
        if (this.hasUpgrade('berserker_class')) {
            pendingHeal += Math.floor(this.stats.maxHp * 0.05);
        }
        // Warlock class: every 20 gold → +3% permanent damage boost
        if (this.hasUpgrade('warlock_class') && this.state.gold >= 20) {
            const stacks = Math.floor(this.state.gold / 20);
            this.stats.damageMultiplier = (this.stats.damageMultiplier ?? 1) + stacks * 0.03;
        }
        // Momentum: each kill grants +2% damage for this floor
        if (this.hasUpgrade('momentum')) {
            this.state.momentumBonus = Math.min(0.30, this.state.momentumBonus + 0.02);
        }
        // Plague Carrier: store 75% of poison stacks for next enemy
        const ps = enemy.statusEffects.poison;
        if (ps && ps.stacks > 0 && this.hasUpgrade('plague_carrier')) {
            const transferRate = this.hasUpgrade('plague_doctor_class') ? 1.0 : 0.75;
            this.state.poisonTransferStacks = Math.floor(ps.stacks * transferRate);
            this.state.poisonTransferDmg = ps.damagePerStack;
        }
        // Contagion Vial relic: poisoned kill → next enemy starts with 6 stacks
        if (ps && ps.stacks > 0 && this.hasUpgrade('relic_contagion_vial')) {
            if (this.state.poisonTransferStacks < 6) {
                this.state.poisonTransferStacks = 6;
                this.state.poisonTransferDmg = ps.damagePerStack;
            }
        }
        const ctx = {
            stats: this.stats, engine: this, enemy,
            damage: 0, isCrit: false, result: this.emptyAttackResult(),
        };
        this.fireTriggers('onKill', ctx);
        // Collect any kill-trigger heals from result (undying_thirst, berserker_class via trigger)
        pendingHeal += ctx.result.healAmount;
        return { pendingHeal };
    }
    /** Apply kill carryover effects to the freshly spawned next enemy. */
    applyKillCarryover(enemy) {
        if (this.state.poisonTransferStacks > 0) {
            enemy.applyPoison(this.state.poisonTransferStacks, this.state.poisonTransferDmg, 1000 / (this.stats.poisonTickRate ?? 2));
            this.state.poisonTransferStacks = 0;
            this.state.poisonTransferDmg = 0;
        }
        // Backdraft: if previous enemy was burning, start burn on this one
        if (this.hasUpgrade('backdraft') && Math.random() < 0.60) {
            enemy.applyBurn(this.stats.burnDamage ?? 5, (this.stats.burnDuration ?? 3) * 1000, 500, this.stats.burnCanCrit ?? false);
        }
    }
    /** Store overkill damage for Overflow. */
    storeOverkill(overkill) {
        if (this.hasUpgrade('overflow') && overkill > 0) {
            this.state.overflowStored = overkill;
        }
    }
    /**
     * Phoenix Protocol check — called by GameScene when player HP would reach 0.
     * Returns true if Phoenix saved the player (GameScene sets HP to 1 instead of dying).
     */
    checkPhoenix() {
        if (this.hasUpgrade('phoenix_protocol') && !this.state.hasRevived) {
            this.state.hasRevived = true;
            this.state.phoenixBonusHits = 5; // next 5 attacks deal 2× damage
            return true;
        }
        return false;
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    fireTriggers(event, ctx) {
        this.triggers.forEach(trigger => {
            if (trigger.event === event)
                trigger.action(ctx);
        });
    }
    emptyAttackResult() {
        return {
            damage: 0, isCrit: false, healAmount: 0, excessHeal: 0,
            areaDamage: 0, lightningDamage: 0, summonDamage: 0,
            poisonApplied: 0, burnApplied: false, goldGained: 0,
            thornDamage: 0, mirrorDamage: 0,
            floaters: [],
        };
    }
}
