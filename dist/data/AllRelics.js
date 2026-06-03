// ---------------------------------------------------------------------------
// Helper shorthands
// ---------------------------------------------------------------------------
function reg(engine, id) {
    engine.registerUpgrade(id); // relics share the upgrade registry for hasUpgrade() checks
}
// ---------------------------------------------------------------------------
// OFFENSE — relics that directly amplify damage
// ---------------------------------------------------------------------------
const OFFENSE = [
    {
        id: 'bomb_collar', name: 'Bomb Collar',
        description: 'On kill, the dying enemy explodes for 50% of its max HP as bonus damage applied immediately to the next enemy.',
        flavour: '"Go out with a bang."',
        rarity: 'uncommon', color: 0xe74c3c, tags: ['offense', 'kill'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_bomb_collar');
        },
    },
    {
        id: 'phantom_blade', name: 'Phantom Blade',
        description: 'Every 5th attack triggers a phantom strike dealing 300% of base damage.',
        rarity: 'rare', color: 0x9b59b6, tags: ['offense', 'periodic'],
        onAcquire: (_s, engine) => {
            engine.registerTrigger('relic_phantom_blade', {
                event: 'onHit',
                action: (ctx) => {
                    if (ctx.engine.hitCount % 5 === 0) {
                        ctx.result.areaDamage += Math.floor(ctx.stats.damage * 3.0);
                    }
                },
            });
        },
    },
    {
        id: 'void_fang', name: 'Void Fang',
        description: 'Your attacks ignore 40% of enemy armor.',
        rarity: 'uncommon', color: 0x6c3483, tags: ['offense', 'armor-pen'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_void_fang');
        },
    },
    {
        id: 'trophy_case', name: 'Trophy Case',
        description: 'Gain +3% damage permanently for each boss defeated this run.',
        rarity: 'rare', color: 0xf1c40f, tags: ['offense', 'boss', 'scaling'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_trophy_case');
            // Trigger fires on kill; GameScene calls onBossKilled separately.
        },
    },
    {
        id: 'soul_mirror', name: 'Soul Mirror',
        description: 'Critical hits have a 30% chance to duplicate the entire attack for free.',
        rarity: 'legendary', color: 0xffd700, tags: ['offense', 'crit', 'duplicate'],
        onAcquire: (_s, engine) => {
            engine.registerTrigger('relic_soul_mirror', {
                event: 'onCrit',
                action: (ctx) => {
                    if (Math.random() < 0.30) {
                        // Add a full extra hit worth of damage as area damage
                        ctx.result.areaDamage += ctx.result.damage;
                        if (ctx.result.lightningDamage > 0)
                            ctx.result.lightningDamage += ctx.result.lightningDamage;
                        if (ctx.result.summonDamage > 0)
                            ctx.result.summonDamage += ctx.result.summonDamage;
                    }
                },
            });
        },
    },
    {
        id: 'berserker_skull', name: "Berserker's Skull",
        description: 'Every 5th kill this floor, your next attack deals triple damage.',
        rarity: 'rare', color: 0xc0392b, tags: ['offense', 'kill', 'scaling'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_berserker_skull');
            engine.registerTrigger('relic_berserker_skull_hit', {
                event: 'onHit',
                action: (ctx) => {
                    if (ctx.engine.hasUpgrade('relic_berserker_skull_charged')) {
                        ctx.result.damage = Math.floor(ctx.result.damage * 3.0);
                        engine.unregisterUpgrade('relic_berserker_skull_charged');
                    }
                },
            });
            engine.registerTrigger('relic_berserker_skull_kill', {
                event: 'onKill',
                action: (ctx) => {
                    if (ctx.engine.floorKills > 0 && ctx.engine.floorKills % 5 === 0) {
                        engine.registerUpgrade('relic_berserker_skull_charged');
                    }
                },
            });
        },
    },
];
// ---------------------------------------------------------------------------
// DOT — relics that amplify damage-over-time
// ---------------------------------------------------------------------------
const DOT = [
    {
        id: 'plague_bell', name: 'Plague Bell',
        description: 'Each poison tick has a 20% chance to add 1 extra poison stack.',
        rarity: 'uncommon', color: 0x8e44ad, tags: ['poison', 'scaling'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_plague_bell');
        },
    },
    {
        id: 'inferno_glyph', name: 'Inferno Glyph',
        description: 'Burn duration is doubled. Enemies stay on fire twice as long.',
        rarity: 'uncommon', color: 0xe67e22, tags: ['burn', 'duration'],
        onAcquire: (s) => {
            s.burnDuration = (s.burnDuration ?? 3) * 2;
        },
    },
    {
        id: 'contagion_vial', name: 'Contagion Vial',
        description: 'When a poisoned enemy dies, the next enemy starts with 6 poison stacks.',
        flavour: '"The disease outlives the host."',
        rarity: 'rare', color: 0x27ae60, tags: ['poison', 'kill'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_contagion_vial');
        },
    },
];
// ---------------------------------------------------------------------------
// DEFENSE — relics that improve survivability
// ---------------------------------------------------------------------------
const DEFENSE = [
    {
        id: 'deflection_ring', name: 'Deflection Ring',
        description: '20% chance to completely ignore an incoming attack.',
        rarity: 'uncommon', color: 0x3498db, tags: ['defense', 'avoidance'],
        onAcquire: (_s, engine) => {
            engine.registerDefenseTrigger('relic_deflection_ring', (ctx) => {
                if (Math.random() < 0.20) {
                    ctx.result.damageTaken = 0;
                    ctx.result.shieldAbsorbed = 0;
                }
            });
        },
    },
    {
        id: 'corruption_crystal', name: 'Corruption Crystal',
        description: 'Survive lethal damage (max 2 times/run). Each survival costs 20% of your max HP permanently.',
        flavour: '"The crystal drinks deeply."',
        rarity: 'legendary', color: 0x9b59b6, tags: ['defense', 'survival'],
        onAcquire: (s, engine) => {
            const data = engine.getRelicData('corruption_crystal');
            data['revivesLeft'] = 2;
            engine.registerDefenseTrigger('relic_corruption_crystal', (ctx) => {
                const lives = data['revivesLeft'];
                if (lives > 0 && ctx.stats.hp - ctx.result.damageTaken <= 0) {
                    data['revivesLeft'] = lives - 1;
                    ctx.result.damageTaken = Math.max(0, ctx.stats.hp - 1);
                    // Permanently shrink max HP by 20%
                    const hpCost = Math.floor(ctx.stats.maxHp * 0.20);
                    ctx.stats.maxHp = Math.max(10, ctx.stats.maxHp - hpCost);
                }
            });
            void s;
        },
    },
    {
        id: 'battle_scar_tissue', name: 'Battle Scar Tissue',
        description: 'Gain +1 max HP for every 30 damage taken (cumulative across the run).',
        rarity: 'uncommon', color: 0xe74c3c, tags: ['defense', 'scaling'],
        onAcquire: (s, engine) => {
            const data = engine.getRelicData('battle_scar_tissue');
            data['damageTakenBank'] = 0;
            engine.registerDefenseTrigger('relic_battle_scar_tissue', (ctx) => {
                const taken = ctx.result.damageTaken;
                if (taken > 0) {
                    data['damageTakenBank'] = data['damageTakenBank'] + taken;
                    while (data['damageTakenBank'] >= 30) {
                        data['damageTakenBank'] = data['damageTakenBank'] - 30;
                        ctx.stats.maxHp += 1;
                        ctx.stats.hp += 1;
                    }
                }
            });
            void s;
        },
    },
    {
        id: 'blessed_armor', name: 'Blessed Armor',
        description: 'Gain +4 armor at the start of each floor.',
        rarity: 'uncommon', color: 0x5dade2, tags: ['defense', 'armor'],
        onAcquire: (s, engine) => {
            s.armor += 4; // immediate first floor bonus
            engine.registerTrigger('relic_blessed_armor', {
                event: 'onFloorStart',
                action: (ctx) => { ctx.stats.armor += 4; },
            });
        },
    },
];
// ---------------------------------------------------------------------------
// LIFESTEAL / HEALING
// ---------------------------------------------------------------------------
const LIFESTEAL = [
    {
        id: 'bloodstone', name: 'Bloodstone',
        description: 'Each kill heals you for 10 HP.',
        rarity: 'uncommon', color: 0x2ecc71, tags: ['lifesteal', 'kill'],
        onAcquire: (_s, engine) => {
            engine.registerTrigger('relic_bloodstone', {
                event: 'onKill',
                action: (ctx) => { ctx.result.healAmount += 10; },
            });
        },
    },
    {
        id: 'alchemist_flask', name: "Alchemist's Flask",
        description: '20% of all damage you take is converted to healing instead.',
        rarity: 'rare', color: 0x1abc9c, tags: ['lifesteal', 'defense'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_alchemist_flask');
        },
    },
    {
        id: 'transfuser', name: 'Transfuser',
        description: 'Lifesteal also triggers on area damage and summon damage.',
        rarity: 'rare', color: 0x2ecc71, tags: ['lifesteal', 'area', 'summons'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_transfuser');
        },
    },
];
// ---------------------------------------------------------------------------
// ECONOMY
// ---------------------------------------------------------------------------
const ECONOMY = [
    {
        id: 'golden_idol', name: 'Golden Idol',
        description: 'Each relic you own grants +3 gold per floor cleared.',
        flavour: '"It appreciates in value."',
        rarity: 'uncommon', color: 0xf39c12, tags: ['gold', 'economy'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_golden_idol');
            // GameScene checks how many relics the player has and adds gold accordingly
        },
    },
    {
        id: 'misers_purse', name: "Miser's Purse",
        description: '+3 gold per kill.',
        rarity: 'uncommon', color: 0xf39c12, tags: ['gold', 'kill'],
        onAcquire: (_s, engine) => {
            engine.registerTrigger('relic_misers_purse', {
                event: 'onKill',
                action: (ctx) => {
                    ctx.engine.addGold(3);
                    ctx.result.goldGained += 3;
                },
            });
        },
    },
];
// ---------------------------------------------------------------------------
// SCALING — relics that grow with time
// ---------------------------------------------------------------------------
const SCALING = [
    {
        id: 'veterans_badge', name: "Veteran's Badge",
        description: 'Every 10 floors cleared, permanently gain +0.15 attack speed.',
        rarity: 'rare', color: 0xf1c40f, tags: ['scaling', 'speed'],
        onAcquire: (s, engine) => {
            const data = engine.getRelicData('veterans_badge');
            data['floorsCleared'] = 0;
            engine.registerTrigger('relic_veterans_badge', {
                event: 'onFloorStart',
                action: (ctx) => {
                    data['floorsCleared'] = data['floorsCleared'] + 1;
                    if (data['floorsCleared'] % 10 === 0) {
                        ctx.stats.attackSpeed = parseFloat((ctx.stats.attackSpeed + 0.15).toFixed(3));
                    }
                },
            });
            void s;
        },
    },
    {
        id: 'collectors_greed', name: "Collector's Greed",
        description: 'Your attack damage increases by 2 for every unique upgrade you own.',
        rarity: 'rare', color: 0x9b59b6, tags: ['scaling', 'upgrades'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_collectors_greed');
            // Applied dynamically in resolvePlayerAttack via engine.upgradeCount()
        },
    },
    {
        id: 'momentum_stone', name: 'Momentum Stone',
        description: 'Each upgrade you take this run grants +5 max HP.',
        rarity: 'uncommon', color: 0x3498db, tags: ['scaling', 'hp'],
        onAcquire: (_s, engine) => {
            reg(engine, 'relic_momentum_stone');
            // GameScene applies the bonus in selectUpgrade hook
        },
    },
];
// ---------------------------------------------------------------------------
// Full relic pool
// ---------------------------------------------------------------------------
export const ALL_RELICS = [
    ...OFFENSE,
    ...DOT,
    ...DEFENSE,
    ...LIFESTEAL,
    ...ECONOMY,
    ...SCALING,
];
function relicWeightsForFloor(floor) {
    if (floor <= 5)
        return { uncommon: 70, rare: 28, legendary: 2 };
    if (floor <= 15)
        return { uncommon: 55, rare: 35, legendary: 10 };
    if (floor <= 25)
        return { uncommon: 35, rare: 45, legendary: 20 };
    return { uncommon: 20, rare: 45, legendary: 35 };
}
function weightedRelicRarity(w) {
    const total = w.uncommon + w.rare + w.legendary;
    let roll = Math.random() * total;
    if ((roll -= w.uncommon) < 0)
        return 'uncommon';
    if ((roll -= w.rare) < 0)
        return 'rare';
    return 'legendary';
}
/**
 * Pick `count` relics for the relic offer screen.
 * Filters out relics already owned (relics are unique per run).
 */
export function pickRelics(count, floor, ownedRelics) {
    const weights = relicWeightsForFloor(floor);
    const available = ALL_RELICS.filter(r => !ownedRelics.has(r.id));
    if (available.length === 0)
        return [];
    const chosen = [];
    const usedIds = new Set();
    for (let i = 0; i < count; i++) {
        const rarity = weightedRelicRarity(weights);
        const pool = available.filter(r => r.rarity === rarity && !usedIds.has(r.id));
        const source = pool.length > 0 ? pool : available.filter(r => !usedIds.has(r.id));
        if (source.length === 0)
            break;
        const pick = source[Math.floor(Math.random() * source.length)];
        chosen.push(pick);
        usedIds.add(pick.id);
    }
    return chosen;
}
