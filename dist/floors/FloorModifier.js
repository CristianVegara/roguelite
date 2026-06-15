// ---------------------------------------------------------------------------
// Helper: create a dummy enemy config for special floors
// ---------------------------------------------------------------------------
export function buildSpecialEnemyStats() {
    return {
        maxHp: 999999, hp: 999999,
        damage: 0, attackSpeed: 0,
        armor: 0, critChance: 0, critMultiplier: 2.0,
    };
}
// ---------------------------------------------------------------------------
// Modifier definitions
// ---------------------------------------------------------------------------
export const FLOOR_MODIFIERS = [
    // ── Existing 10 ──────────────────────────────────────────────────────────
    {
        type: 'cursed',
        name: '⚠ CURSED FLOOR',
        description: 'Enemy is 40% stronger. Grants +15 bonus gold on kill.',
        color: 0x9b59b6,
        mutateEnemy: (s) => {
            s.maxHp = Math.floor(s.maxHp * 1.40);
            s.hp = s.maxHp;
            s.damage = Math.floor(s.damage * 1.20);
        },
        bonusGold: 15,
    },
    {
        type: 'elite',
        name: '★ ELITE ENEMY',
        description: 'A powerful elite with doubled stats guards this floor.',
        color: 0xe74c3c,
        mutateEnemy: (s) => {
            s.maxHp = Math.floor(s.maxHp * 2.0);
            s.hp = s.maxHp;
            s.damage = Math.floor(s.damage * 1.70);
            s.armor = Math.floor((s.armor ?? 0) * 1.50) + 5;
            s.attackSpeed = Math.min(2.5, (s.attackSpeed ?? 1) * 1.15);
        },
        bonusGold: 20,
    },
    {
        type: 'frenzied',
        name: '⚡ FRENZIED',
        description: 'Enemy attacks 60% faster but deals 25% less damage.',
        color: 0xe67e22,
        mutateEnemy: (s) => {
            s.attackSpeed = Math.min(3.0, (s.attackSpeed ?? 1) * 1.60);
            s.damage = Math.floor(s.damage * 0.75);
        },
    },
    {
        type: 'fortified',
        name: '🛡 FORTIFIED',
        description: 'Enemy armor is doubled and HP is 30% higher.',
        color: 0x3498db,
        mutateEnemy: (s) => {
            s.armor = (s.armor ?? 0) * 2 + 8;
            s.maxHp = Math.floor(s.maxHp * 1.30);
            s.hp = s.maxHp;
        },
    },
    {
        type: 'darkened',
        name: '🌑 DARKENED',
        description: 'Critical hits deal no bonus damage — only crit effects fire.',
        color: 0x555577,
        engineFlag: 'darkened',
    },
    {
        type: 'blessed',
        name: '✦ BLESSED',
        description: 'You deal +30% damage this floor.',
        color: 0xf1c40f,
        engineFlag: 'blessed',
    },
    {
        type: 'thorned',
        name: '🌿 THORNED',
        description: 'The enemy has thorns — each hit you land reflects 15% of its damage back at you.',
        color: 0x27ae60,
        engineFlag: 'thorned',
    },
    {
        type: 'volatile',
        name: '💥 VOLATILE',
        description: 'Enemy explodes on death, dealing 25% of its max HP as damage to you.',
        color: 0xe74c3c,
        engineFlag: 'volatile',
    },
    {
        type: 'regenerating',
        name: '♻ REGENERATING',
        description: 'Enemy regenerates 1% of max HP per second.',
        color: 0x2ecc71,
        engineFlag: 'regenerating',
    },
    {
        type: 'shielded',
        name: '🔷 SHIELDED',
        description: 'Enemy starts with a shield equal to 25% of max HP.',
        color: 0x5dade2,
        mutateEnemy: (s) => {
            s.shield = Math.floor(s.maxHp * 0.25);
            s.maxShield = s.shield;
        },
    },
    // ── Phase 7: New combat modifiers (13) ───────────────────────────────────
    {
        type: 'mirrored',
        name: '🪞 MIRRORED',
        description: 'The enemy reflects 20% of all damage it takes back at you — armor ignored.',
        color: 0xa29bfe,
        engineFlag: 'mirrored',
    },
    {
        type: 'vampiric_enemy',
        name: '🩸 VAMPIRIC FOE',
        description: 'The enemy heals 8% of the damage it deals to you.',
        color: 0xd63031,
        engineFlag: 'vampiric_enemy',
    },
    {
        type: 'enraged',
        name: '😡 ENRAGED',
        description: 'The enemy grows stronger as it loses HP, dealing up to 160% bonus damage at 1 HP.',
        color: 0xff7675,
        engineFlag: 'enraged',
    },
    {
        type: 'glacial',
        name: '❄ GLACIAL',
        description: 'Enemy attacks 50% slower. You attack 25% slower. The floor is frozen in time.',
        color: 0x74b9ff,
        mutateEnemy: (s) => {
            s.attackSpeed = Math.max(0.2, (s.attackSpeed ?? 1) * 0.50);
        },
        playerSpeedMultiplier: 0.75,
        engineFlag: 'glacial',
    },
    {
        type: 'sanctified',
        name: '✨ SANCTIFIED',
        description: 'The floor is blessed — you heal 30% of your max HP before combat begins.',
        color: 0xfdcb6e,
        engineFlag: 'sanctified',
    },
    {
        type: 'storm',
        name: '⛈ STORM',
        description: 'Every attack has an extra 35% chance to chain lightning.',
        color: 0x00cec9,
        engineFlag: 'storm',
    },
    {
        type: 'weakened',
        name: '💀 WEAKENED',
        description: 'All armor is ignored on both sides. Raw damage only.',
        color: 0x636e72,
        engineFlag: 'weakened',
    },
    {
        type: 'ancient',
        name: '🏺 ANCIENT',
        description: 'An ancient creature with 200% HP but only 50% damage. Pure endurance.',
        color: 0x6c5ce7,
        mutateEnemy: (s) => {
            s.maxHp = Math.floor(s.maxHp * 3.0);
            s.hp = s.maxHp;
            s.damage = Math.floor(s.damage * 0.50);
        },
    },
    {
        type: 'nightmare',
        name: '👁 NIGHTMARE',
        description: 'You enter the floor at 50% HP. Whatever happened here, it already hit you.',
        color: 0x2d3436,
        engineFlag: 'nightmare',
    },
    {
        type: 'hexed',
        name: '🔮 HEXED',
        description: 'A curse nullifies all critical strikes this floor.',
        color: 0x6c5ce7,
        engineFlag: 'hexed',
    },
    {
        type: 'gilded',
        name: '💰 GILDED',
        description: 'The enemy guards a hoard — +30 gold on kill. But it has 30% more HP.',
        color: 0xffeaa7,
        mutateEnemy: (s) => {
            s.maxHp = Math.floor(s.maxHp * 1.30);
            s.hp = s.maxHp;
        },
        bonusGold: 30,
    },
    {
        type: 'constricting',
        name: '🕸 CONSTRICTING',
        description: 'The floor drains your vitality — you lose 25% of current HP on entry. Enemy has 20% less HP.',
        color: 0xb2bec3,
        mutateEnemy: (s) => {
            s.maxHp = Math.floor(s.maxHp * 0.80);
            s.hp = s.maxHp;
        },
        engineFlag: 'constricting',
    },
    // ── Phase 7: Special floor types ─────────────────────────────────────────
    {
        type: 'treasure',
        name: '💎 TREASURE ROOM',
        description: 'No enemies here — just riches and a free upgrade.',
        color: 0xffd700,
        skipCombat: true,
        specialType: 'treasure',
        bonusRewards: { gold: 40, freeUpgrade: true },
    },
    {
        type: 'merchant',
        name: '🛒 MERCHANT',
        description: 'A travelling merchant offers upgrades for sale.',
        color: 0xf9ca24,
        skipCombat: true,
        specialType: 'merchant',
    },
];
// ---------------------------------------------------------------------------
// Combat-only modifier pool (for chaos meta-rolling)
// ---------------------------------------------------------------------------
const COMBAT_MODIFIERS = FLOOR_MODIFIERS.filter(m => !m.skipCombat && m.type !== 'chaos');
// ---------------------------------------------------------------------------
// Roller
// ---------------------------------------------------------------------------
/**
 * Returns a random floor modifier or null (normal floor).
 * Special floor rates:
 *   treasure: 8%  |  merchant: 6%  |  chaos: 10%  |  combat mod: up to 45%
 */
export function rollFloorModifier(floor) {
    if (floor <= 2)
        return null; // first two floors always normal
    const roll = Math.random();
    // Treasure floor
    if (roll < 0.08) {
        return FLOOR_MODIFIERS.find(m => m.type === 'treasure');
    }
    // Merchant floor
    if (roll < 0.14) {
        return FLOOR_MODIFIERS.find(m => m.type === 'merchant');
    }
    // Chaos floor (amplified random modifier)
    if (roll < 0.24) {
        const base = COMBAT_MODIFIERS[Math.floor(Math.random() * COMBAT_MODIFIERS.length)];
        return {
            ...base,
            type: 'chaos',
            name: `⚡ CHAOS: ${base.name.replace(/^[^\s]+\s/, '')}`,
            description: `CHAOS! ${base.description} All effects are amplified.`,
            color: 0xff6b6b,
            mutateEnemy: (s) => {
                base.mutateEnemy?.(s);
                // Chaos bonus: +30% HP, +20% damage on top
                s.maxHp = Math.floor(s.maxHp * 1.30);
                s.hp = s.maxHp;
                s.damage = Math.floor(s.damage * 1.20);
            },
            bonusGold: (base.bonusGold ?? 0) + 20,
        };
    }
    // Regular combat modifier — chance scales with floor
    const combatChance = Math.min(0.45, 0.20 + floor * 0.005);
    if (Math.random() > combatChance)
        return null;
    return COMBAT_MODIFIERS[Math.floor(Math.random() * COMBAT_MODIFIERS.length)];
}
