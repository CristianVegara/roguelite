/**
 * The full pool of 10 upgrades available during a run.
 *
 * Design notes:
 *   - `apply` mutates stats directly — no modifier stack needed for MVP.
 *   - HP upgrades also heal the player by the same amount (standard roguelite).
 *   - Crit is capped at 0.95 so it never feels binary.
 *   - Attack speed is stored as a float; toFixed(3) prevents floating-point drift.
 */
export const UPGRADES = [
    {
        id: 'dmg_10',
        label: '+10% Damage',
        description: 'Deal 10% more damage per hit.',
        color: 0xe74c3c,
        apply: (s) => { s.damage = Math.ceil(s.damage * 1.1); },
    },
    {
        id: 'dmg_20',
        label: '+20% Damage',
        description: 'Deal 20% more damage per hit.',
        color: 0xe74c3c,
        apply: (s) => { s.damage = Math.ceil(s.damage * 1.2); },
    },
    {
        id: 'spd_10',
        label: '+10% Attack Speed',
        description: 'Attack 10% faster.',
        color: 0xf1c40f,
        apply: (s) => { s.attackSpeed = parseFloat((s.attackSpeed * 1.1).toFixed(3)); },
    },
    {
        id: 'spd_20',
        label: '+20% Attack Speed',
        description: 'Attack 20% faster.',
        color: 0xf1c40f,
        apply: (s) => { s.attackSpeed = parseFloat((s.attackSpeed * 1.2).toFixed(3)); },
    },
    {
        id: 'hp_50',
        label: '+50 Max HP',
        description: 'Gain 50 max HP and heal 50.',
        color: 0x2ecc71,
        apply: (s) => { s.maxHp += 50; s.hp = Math.min(s.maxHp, s.hp + 50); },
    },
    {
        id: 'hp_100',
        label: '+100 Max HP',
        description: 'Gain 100 max HP and heal 100.',
        color: 0x2ecc71,
        apply: (s) => { s.maxHp += 100; s.hp = Math.min(s.maxHp, s.hp + 100); },
    },
    {
        id: 'crit_5',
        label: '+5% Crit Chance',
        description: 'Gain 5% critical strike chance. Crits deal double damage.',
        color: 0xffd700,
        apply: (s) => { s.critChance = Math.min(0.95, s.critChance + 0.05); },
    },
    {
        id: 'crit_10',
        label: '+10% Crit Chance',
        description: 'Gain 10% critical strike chance. Crits deal double damage.',
        color: 0xffd700,
        apply: (s) => { s.critChance = Math.min(0.95, s.critChance + 0.1); },
    },
    {
        id: 'armor_10',
        label: '+10 Armor',
        description: 'Reduce all incoming damage by 10 (flat).',
        color: 0x3498db,
        apply: (s) => { s.armor += 10; },
    },
    {
        id: 'armor_20',
        label: '+20 Armor',
        description: 'Reduce all incoming damage by 20 (flat).',
        color: 0x3498db,
        apply: (s) => { s.armor += 20; },
    },
];
/**
 * Returns `count` randomly chosen upgrades from the pool.
 * Uses Fisher-Yates so every combination is equally likely.
 */
export function pickRandomUpgrades(count) {
    const pool = [...UPGRADES];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}
