import { CombatStats } from '../combat/CombatStats';
import { RulesEngine } from '../combat/RulesEngine';

// ---------------------------------------------------------------------------
// Class type
// ---------------------------------------------------------------------------

export interface ClassDefinition {
  id:          string;
  name:        string;
  icon:        string;  // emoji or symbol for the class picker
  color:       number;
  description: string;  // build-ecosystem description shown in class picker
  flavour:     string;
  /**
   * Category weight multipliers for the upgrade draft pool.
   * A weight of 3 means upgrades in that category appear 3× as often.
   */
  categoryWeights: Partial<Record<string, number>>;
  /**
   * Run-start effect: mutates playerStats and registers engine triggers.
   * Called once in GameScene.create() after the player entity is ready.
   */
  apply: (stats: CombatStats, engine: RulesEngine) => void;
}

// ---------------------------------------------------------------------------
// The 8 Classes
// ---------------------------------------------------------------------------

export const ALL_CLASSES: ClassDefinition[] = [

  // ── 1. Necromancer ─────────────────────────────────────────────────────────
  {
    id:          'necromancer',
    name:        'Necromancer',
    icon:        '💀',
    color:       0x8e44ad,
    description: 'Summon upgrades appear 3× more often. Each familiar adds +1 poison stack per hit.',
    flavour:     '"They were better workers after death."',
    categoryWeights: { summons: 3, defense: 1 },
    apply: (_stats, engine) => {
      engine.registerTrigger('necromancer_class', {
        event: 'onHit',
        action: (ctx) => {
          const count = ctx.stats.summonCount ?? 0;
          if (count > 0) {
            ctx.result.poisonApplied = Math.max(
              ctx.result.poisonApplied,
              count * 1,
            );
          }
        },
      });
      engine.registerUpgrade('necromancer_class');
    },
  },

  // ── 2. Assassin ────────────────────────────────────────────────────────────
  {
    id:          'assassin',
    name:        'Assassin',
    icon:        '🗡',
    color:       0xe74c3c,
    description: 'Critical upgrades appear 3× more often. Crits deal +25% bonus damage. Poison upgrades appear 1.5× more often.',
    flavour:     '"One wound. Many consequences."',
    categoryWeights: { critical: 3, damage: 2 },
    apply: (_stats, engine) => {
      engine.registerTrigger('assassin_class', {
        event: 'onCrit',
        action: (ctx) => {
          ctx.result.damage = Math.floor(ctx.result.damage * 1.25);
        },
      });
      engine.registerUpgrade('assassin_class');
    },
  },

  // ── 3. Paladin ─────────────────────────────────────────────────────────────
  {
    id:          'paladin',
    name:        'Paladin',
    icon:        '🛡',
    color:       0x3498db,
    description: 'Defense upgrades appear 3× more often. Start with +25 armor. Every hit heals 0.5 HP per 10 excess armor.',
    flavour:     '"The shield is not a wall. It is a promise."',
    categoryWeights: { defense: 3, lifesteal: 2 },
    apply: (stats, engine) => {
      stats.armor += 25;
      engine.registerTrigger('paladin_class', {
        event: 'onHit',
        action: (ctx) => {
          const extraArmor = Math.max(0, ctx.stats.armor - 30);
          if (extraArmor > 0) {
            const heal = Math.max(1, Math.floor(extraArmor / 10));
            const headroom = ctx.stats.maxHp - ctx.stats.hp;
            const actual   = Math.min(heal, headroom);
            if (actual > 0) {
              ctx.result.healAmount += actual;
              ctx.result.floaters.push({ value: actual, type: 'heal', target: 'player' });
            }
          }
        },
      });
      engine.registerUpgrade('paladin_class');
    },
  },

  // ── 4. Pyromancer ──────────────────────────────────────────────────────────
  {
    id:          'pyromancer',
    name:        'Pyromancer',
    icon:        '🔥',
    color:       0xe67e22,
    description: 'Burn upgrades appear 3× more often. Start with +10% ignite chance. Burn deals 75% more damage.',
    flavour:     '"The world is fuel. I am the spark."',
    categoryWeights: { burn: 3, damage: 2 },
    apply: (stats, _engine) => {
      stats.burnChance  = (stats.burnChance ?? 0) + 0.10;
      stats.burnDamage  = Math.floor((stats.burnDamage ?? 5) * 1.75);
    },
  },

  // ── 5. Plague Doctor ───────────────────────────────────────────────────────
  {
    id:          'plague_doctor',
    name:        'Plague Doctor',
    icon:        '🧪',
    color:       0x27ae60,
    description: 'Poison upgrades appear 3× more often. Start with +1 stack/proc and +10% proc chance. Stacks always transfer on kill.',
    flavour:     '"The cure and the disease are the same thing at different doses."',
    categoryWeights: { poison: 3, cooldown: 2 },
    apply: (stats, engine) => {
      stats.poisonStacks  = (stats.poisonStacks ?? 1) + 1;
      stats.poisonChance  = (stats.poisonChance ?? 0) + 0.10;
      // Free Plague Carrier: 100% stack transfer on kill
      engine.registerUpgrade('plague_carrier');
      engine.registerUpgrade('plague_doctor_class');
    },
  },

  // ── 6. Berserker ───────────────────────────────────────────────────────────
  {
    id:          'berserker',
    name:        'Berserker',
    icon:        '⚔',
    color:       0xc0392b,
    description: 'Rage upgrades appear 3× more often. Killing restores 5% max HP. You enter each floor angry.',
    flavour:     '"Pain is just damage you haven\'t used yet."',
    categoryWeights: { rage: 3, berserker: 3 },
    apply: (_stats, engine) => {
      engine.registerUpgrade('berserker_class');
      // Kill-heal is handled via onEnemyKilled pendingHeal in RulesEngine
    },
  },

  // ── 7. Archmage ────────────────────────────────────────────────────────────
  {
    id:          'archmage',
    name:        'Archmage',
    icon:        '⚡',
    color:       0x00bcd4,
    description: 'Lightning upgrades appear 3× more often. Lightning always deals 100% damage. Ball Lightning fires every 2 attacks.',
    flavour:     '"The storm obeys. The storm does not tire."',
    categoryWeights: { lightning: 3, cooldown: 2 },
    apply: (stats, engine) => {
      // Boost lightning damage to 100% minimum
      stats.lightningDamage = Math.max(stats.lightningDamage ?? 0.5, 1.0);
      engine.registerUpgrade('archmage_class');
      // Archmage starts with Ball Lightning built-in (fires every 2 attacks via archmage_class flag)
      engine.registerUpgrade('ball_lightning');
    },
  },

  // ── 8. Warlock ─────────────────────────────────────────────────────────────
  {
    id:          'warlock',
    name:        'Warlock',
    icon:        '📜',
    color:       0xf39c12,
    description: 'Economy upgrades appear 3× more often. Start with 30 gold. Every 20 gold permanently boosts damage by 3%.',
    flavour:     '"Power has a price. I can afford it."',
    categoryWeights: { economy: 3, damage: 2 },
    apply: (_stats, engine) => {
      engine.addGold(30);
      engine.registerUpgrade('warlock_class');
    },
  },
];

/** Returns a class by ID, or null for 'no_class' / unknown. */
export function findClass(id: string): ClassDefinition | null {
  return ALL_CLASSES.find(c => c.id === id) ?? null;
}
