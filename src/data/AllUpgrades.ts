import { RulesEngine }        from '../combat/RulesEngine';
import { UpgradeDefinition, UpgradeRarity, OwnedUpgrades } from './UpgradeDefinition';

// ---------------------------------------------------------------------------
// Helper shorthands
// ---------------------------------------------------------------------------

function reg(engine: RulesEngine, id: string): void {
  engine.registerUpgrade(id);
}

// ---------------------------------------------------------------------------
// DAMAGE CATEGORY  (color: red-orange #e74c3c)
// ---------------------------------------------------------------------------

const DAMAGE_COLOR = 0xe74c3c;

const DAMAGE: UpgradeDefinition[] = [
  {
    id: 'sharp_edge', name: 'Sharp Edge',
    description: 'Deal 20% more damage per hit.',
    category: 'damage', tier: 'starter', rarity: 'common',
    color: DAMAGE_COLOR, maxStacks: 5, stackNote: '+20% damage per stack',
    tags: ['damage', 'basic'],
    apply: (s) => { s.damage = Math.ceil(s.damage * 1.20); },
  },
  {
    id: 'heavy_strikes', name: 'Heavy Strikes',
    description: '+30% damage. −10% attack speed.',
    category: 'damage', tier: 'starter', rarity: 'common',
    color: DAMAGE_COLOR, maxStacks: 3, stackNote: '+30% dmg / −10% atk spd per stack',
    tags: ['damage', 'tradeoff'],
    apply: (s) => {
      s.damage       = Math.ceil(s.damage * 1.30);
      s.attackSpeed  = parseFloat((s.attackSpeed * 0.90).toFixed(3));
    },
  },
  {
    id: 'executioner', name: 'Executioner',
    description: 'Deal up to +50% bonus damage based on the enemy\'s missing HP.',
    category: 'damage', tier: 'starter', rarity: 'uncommon',
    color: DAMAGE_COLOR, maxStacks: 1, tags: ['damage', 'conditional'],
    apply: (_s, e) => { reg(e, 'executioner'); },
  },
  {
    id: 'momentum', name: 'Momentum',
    description: 'Each kill this floor grants +2% damage (max +30%). Resets per floor.',
    category: 'damage', tier: 'synergy', rarity: 'uncommon',
    color: DAMAGE_COLOR, maxStacks: 1, tags: ['damage', 'kills'],
    apply: (_s, e) => { reg(e, 'momentum'); },
  },
  {
    id: 'overflow', name: 'Overflow',
    description: '50% of overkill damage is stored and added to your next attack.',
    category: 'damage', tier: 'transformation', rarity: 'rare',
    color: DAMAGE_COLOR, maxStacks: 1, tags: ['damage', 'overkill'],
    apply: (_s, e) => { reg(e, 'overflow'); },
  },
  {
    id: 'colossus_strike', name: 'Colossus Strike',
    description: 'Every attack deals 25% bonus area damage. Area damage can Overflow.',
    flavour: '"The ground remembers every footstep."',
    category: 'damage', tier: 'keystone', rarity: 'legendary',
    color: DAMAGE_COLOR, maxStacks: 1, tags: ['damage', 'area', 'keystone'],
    apply: (s, e) => {
      reg(e, 'colossus_strike');
      s.areaPercent = (s.areaPercent ?? 0) + 0.25;
    },
  },
];

// ---------------------------------------------------------------------------
// CRITICAL CATEGORY  (#f1c40f gold)
// ---------------------------------------------------------------------------

const CRIT_COLOR = 0xf1c40f;

const CRITICAL: UpgradeDefinition[] = [
  {
    id: 'eagle_eye', name: 'Eagle Eye',
    description: '+10% critical hit chance.',
    category: 'critical', tier: 'starter', rarity: 'common',
    color: CRIT_COLOR, maxStacks: 5, stackNote: '+10% crit chance per stack',
    tags: ['crit', 'basic'],
    apply: (s) => { s.critChance = Math.min(0.95, s.critChance + 0.10); },
  },
  {
    id: 'precision', name: 'Precision',
    description: '+60% critical damage multiplier.',
    category: 'critical', tier: 'starter', rarity: 'common',
    color: CRIT_COLOR, maxStacks: 4, stackNote: '+0.6× crit multiplier per stack',
    tags: ['crit', 'basic'],
    apply: (s) => { s.critMultiplier += 0.60; },
  },
  {
    id: 'predators_mark', name: "Predator's Mark",
    description: 'Critical hits store 20% of their damage. That bonus is added to your next attack.',
    category: 'critical', tier: 'synergy', rarity: 'uncommon',
    color: CRIT_COLOR, maxStacks: 1, tags: ['crit', 'combo'],
    apply: (_s, e) => { reg(e, 'predators_mark'); },
  },
  {
    id: 'speed_to_crit', name: 'Speed-to-Crit',
    description: 'Remove all crit chance. For every 0.1 atk/s above 1.0, gain 8% crit chance.',
    category: 'critical', tier: 'transformation', rarity: 'rare',
    color: CRIT_COLOR, maxStacks: 1, tags: ['crit', 'speed', 'transform'],
    apply: (s, e) => {
      s.critChance = 0;
      reg(e, 'speed_to_crit');
    },
  },
  {
    id: 'eternal_crit', name: 'Eternal Crit',
    description: 'Crit chance becomes 100%. Crits deal no bonus damage, but all crit effects always fire.',
    flavour: '"Every hit is the killing blow."',
    category: 'critical', tier: 'keystone', rarity: 'legendary',
    color: CRIT_COLOR, maxStacks: 1, tags: ['crit', 'keystone'],
    apply: (s, e) => {
      s.critChance = 1.0;
      reg(e, 'eternal_crit');
    },
  },
];

// ---------------------------------------------------------------------------
// LIFESTEAL CATEGORY  (#2ecc71 green)
// ---------------------------------------------------------------------------

const LS_COLOR = 0x2ecc71;

const LIFESTEAL: UpgradeDefinition[] = [
  {
    id: 'leech', name: 'Leech',
    description: '+5% lifesteal. Heal for a fraction of every hit.',
    category: 'lifesteal', tier: 'starter', rarity: 'common',
    color: LS_COLOR, maxStacks: 6, stackNote: '+5% lifesteal per stack',
    tags: ['lifesteal', 'sustain'],
    apply: (s) => { s.lifesteal = (s.lifesteal ?? 0) + 0.05; },
  },
  {
    id: 'vital_strike', name: 'Vital Strike',
    description: 'Every 3rd hit heals 8 HP, regardless of damage dealt.',
    category: 'lifesteal', tier: 'starter', rarity: 'common',
    color: LS_COLOR, maxStacks: 1, tags: ['lifesteal', 'sustain'],
    apply: (_s, e) => { reg(e, 'vital_strike'); },
  },
  {
    id: 'overcharge', name: 'Overcharge',
    description: 'Healing beyond max HP converts to a shield (max 20% of max HP, lasts until hit).',
    category: 'lifesteal', tier: 'synergy', rarity: 'uncommon',
    color: LS_COLOR, maxStacks: 1, tags: ['lifesteal', 'shield'],
    apply: (s, e) => {
      s.maxShield = Math.floor(s.maxHp * 0.20);
      reg(e, 'overcharge');
    },
  },
  {
    id: 'vampiric_aura', name: 'Vampiric Aura',
    description: 'Lifesteal now applies to all damage sources: poison ticks, burn ticks, and lightning.',
    category: 'lifesteal', tier: 'transformation', rarity: 'rare',
    color: LS_COLOR, maxStacks: 1, tags: ['lifesteal', 'dot', 'transform'],
    apply: (_s, e) => { reg(e, 'vampiric_aura'); },
  },
  {
    id: 'undying_thirst', name: 'Undying Thirst',
    description: 'Lifesteal doubles below 50% HP. On kill below 30% HP, restore 40% max HP.',
    flavour: '"The wound feeds itself."',
    category: 'lifesteal', tier: 'keystone', rarity: 'legendary',
    color: LS_COLOR, maxStacks: 1, tags: ['lifesteal', 'keystone'],
    apply: (_s, e) => {
      reg(e, 'undying_thirst');
      // Kill trigger: heal at low HP
      e.registerTrigger('undying_thirst_kill', {
        event: 'onKill',
        action: (ctx) => {
          const ratio = ctx.stats.hp / ctx.stats.maxHp;
          if (ratio < 0.30) {
            const heal = Math.floor(ctx.stats.maxHp * 0.40);
            ctx.result.healAmount += heal;
          }
        },
      });
    },
  },
];

// ---------------------------------------------------------------------------
// DEFENSE CATEGORY  (#3498db blue)
// ---------------------------------------------------------------------------

const DEF_COLOR = 0x3498db;

const DEFENSE: UpgradeDefinition[] = [
  {
    id: 'iron_skin', name: 'Iron Skin',
    description: '+12 armor. Reduces all incoming damage.',
    category: 'defense', tier: 'starter', rarity: 'common',
    color: DEF_COLOR, maxStacks: 6, stackNote: '+12 armor per stack',
    tags: ['defense', 'armor'],
    apply: (s) => { s.armor += 12; },
  },
  {
    id: 'hp_up', name: 'HP Up',
    description: 'Retroactively convert 20% of all damage taken this run into permanent Max HP. Going forward, every 5 damage taken also grants +1 Max HP.',
    flavour: '"Pain is just experience your body hasn\'t priced in yet."',
    category: 'defense', tier: 'synergy', rarity: 'uncommon',
    color: DEF_COLOR, maxStacks: 1, tags: ['defense', 'hp', 'reactive'],
    apply: (s, e) => {
      reg(e, 'hp_up');

      // ── Retroactive component ─────────────────────────────────────────────
      // Convert 20% of all damage the player has taken so far into Max HP.
      const retroBonus = Math.floor(e.totalDamageTaken * 0.20);
      if (retroBonus > 0) {
        s.maxHp += retroBonus;
        s.hp     = Math.min(s.maxHp, s.hp + retroBonus);
      }

      // ── Ongoing component ─────────────────────────────────────────────────
      // Accumulate 0.20 HP per point of damage taken from here on.
      // When the float accumulator reaches a whole number, grant that HP as
      // permanent Max HP (and also restore it to current HP).
      // The accumulator lives in relicData so it persists across floors.
      const data = e.getRelicData('hp_up');
      data['accumulator'] = 0;

      e.registerDefenseTrigger('hp_up_ongoing', (ctx) => {
        if (ctx.result.damageTaken <= 0) return;
        const d    = ctx.engine.getRelicData('hp_up');
        const prev = (d['accumulator'] as number) ?? 0;
        const next = prev + ctx.result.damageTaken * 0.20;
        const grant = Math.floor(next);
        d['accumulator'] = next - grant;
        if (grant > 0) {
          ctx.stats.maxHp += grant;
          ctx.stats.hp     = Math.min(ctx.stats.maxHp, ctx.stats.hp + grant);
        }
      });
    },
  },
  {
    id: 'reactive_plating', name: 'Reactive Plating',
    description: 'Each time you take damage, gain 1 armor. Armor gained this way is permanent for the entire run.',
    category: 'defense', tier: 'starter', rarity: 'uncommon',
    color: DEF_COLOR, maxStacks: 1, tags: ['defense', 'armor', 'reactive'],
    apply: (_s, e) => { reg(e, 'reactive_plating'); },
  },
  {
    id: 'living_wall', name: 'Living Wall',
    description: 'Armor above 20 contributes to attack damage (2 armor = +1 damage).',
    category: 'defense', tier: 'transformation', rarity: 'rare',
    color: DEF_COLOR, maxStacks: 1, tags: ['defense', 'damage', 'transform'],
    apply: (_s, e) => { reg(e, 'living_wall'); },
  },
  {
    id: 'diamond_body', name: 'Diamond Body',
    description: 'Immune to the first hit each floor. Afterward, armor doubles for that floor.',
    flavour: '"What does not kill you... was probably the second hit."',
    category: 'defense', tier: 'keystone', rarity: 'legendary',
    color: DEF_COLOR, maxStacks: 1, tags: ['defense', 'keystone'],
    apply: (_s, e) => { reg(e, 'diamond_body'); },
  },
];

// ---------------------------------------------------------------------------
// REFLECT CATEGORY  (#9b59b6 purple)
// ---------------------------------------------------------------------------

const REF_COLOR = 0x9b59b6;

const REFLECT: UpgradeDefinition[] = [
  {
    id: 'mirror_shards', name: 'Mirror Shards',
    description: 'Reflect 15% of incoming damage back to the attacker.',
    category: 'reflect', tier: 'starter', rarity: 'common',
    color: REF_COLOR, maxStacks: 4, stackNote: '+15% reflect per stack',
    tags: ['reflect', 'basic'],
    apply: (s) => { s.reflectPercent = (s.reflectPercent ?? 0) + 0.15; },
  },
  {
    id: 'counterstrike', name: 'Counterstrike',
    description: 'When hit, 20% chance to immediately fire a free retaliatory attack.',
    category: 'reflect', tier: 'starter', rarity: 'uncommon',
    color: REF_COLOR, maxStacks: 1, tags: ['reflect', 'reactive'],
    apply: (_s, e) => {
      e.registerDefenseTrigger('counterstrike', (ctx) => {
        if (Math.random() < 0.20) {
          // Add retaliation damage to reflect result
          ctx.result.reflectDamage += Math.floor(ctx.stats.damage * (ctx.stats.damageMultiplier ?? 1));
        }
      });
    },
  },
  {
    id: 'grudge', name: 'Grudge',
    description: 'Each time you take damage, permanently gain +1% reflect for this run.',
    category: 'reflect', tier: 'transformation', rarity: 'rare',
    color: REF_COLOR, maxStacks: 1, tags: ['reflect', 'scaling', 'transform'],
    apply: (_s, e) => { reg(e, 'grudge'); },
  },
  {
    id: 'karma', name: 'Karma',
    description: 'Reflect 75% of incoming damage. You take only 25%. Your HP pool is your weapon.',
    flavour: '"The universe keeps its own ledger."',
    category: 'reflect', tier: 'keystone', rarity: 'legendary',
    color: REF_COLOR, maxStacks: 1, tags: ['reflect', 'keystone'],
    apply: (_s, e) => { reg(e, 'karma'); },
  },
];

// ---------------------------------------------------------------------------
// POISON CATEGORY  (#8e44ad dark purple)
// ---------------------------------------------------------------------------

const PSN_COLOR = 0x8e44ad;

const POISON: UpgradeDefinition[] = [
  {
    id: 'venom_tips', name: 'Venom Tips',
    description: '15% chance per attack to apply 1 poison stack (2 dmg/tick, 2 ticks/sec).',
    category: 'poison', tier: 'starter', rarity: 'common',
    color: PSN_COLOR, maxStacks: 3, stackNote: '+15% poison chance, +5 max stacks per stack',
    tags: ['poison', 'dot'],
    apply: (s) => {
      s.poisonChance  = (s.poisonChance  ?? 0) + 0.15;
      s.poisonMaxStacks = (s.poisonMaxStacks ?? 10) + 5;
    },
  },
  {
    id: 'toxic_coating', name: 'Toxic Coating',
    description: 'Poison procs apply 1 additional stack.',
    category: 'poison', tier: 'starter', rarity: 'common',
    color: PSN_COLOR, maxStacks: 3, stackNote: '+1 poison stack per proc, per stack',
    tags: ['poison', 'stacks'],
    apply: (s) => { s.poisonStacks = (s.poisonStacks ?? 1) + 1; },
  },
  {
    id: 'plague_carrier', name: 'Plague Carrier',
    description: 'On kill, 75% of your poison stacks transfer to the next enemy.',
    category: 'poison', tier: 'synergy', rarity: 'uncommon',
    color: PSN_COLOR, maxStacks: 1, tags: ['poison', 'kills'],
    apply: (_s, e) => { reg(e, 'plague_carrier'); },
  },
  {
    id: 'reactive_venom', name: 'Reactive Venom',
    description: 'Critical hits apply 3× the normal poison stacks. Poison ticks that crit deal double damage.',
    category: 'poison', tier: 'synergy', rarity: 'rare',
    requires: ['eagle_eye'],
    color: PSN_COLOR, maxStacks: 1, tags: ['poison', 'crit'],
    apply: (_s, e) => { reg(e, 'reactive_venom'); },
  },
  {
    id: 'poison_lord', name: 'Poison Lord',
    description: 'Poison stacks have no cap and never expire. Only death ends them.',
    flavour: '"They called it incurable. I call it permanent."',
    category: 'poison', tier: 'keystone', rarity: 'legendary',
    color: PSN_COLOR, maxStacks: 1, tags: ['poison', 'keystone'],
    apply: (s, e) => {
      s.poisonMaxStacks = 0;  // 0 = unlimited (engine checks this)
      reg(e, 'poison_lord');
    },
  },
];

// ---------------------------------------------------------------------------
// BURN CATEGORY  (#e67e22 orange)
// ---------------------------------------------------------------------------

const BURN_COLOR = 0xe67e22;

const BURN: UpgradeDefinition[] = [
  {
    id: 'kindling', name: 'Kindling',
    description: '15% chance per attack to ignite the enemy (5 dmg/tick for 3s).',
    category: 'burn', tier: 'starter', rarity: 'common',
    color: BURN_COLOR, maxStacks: 3, stackNote: '+15% burn chance per stack',
    tags: ['burn', 'dot'],
    apply: (s) => { s.burnChance = (s.burnChance ?? 0) + 0.15; },
  },
  {
    id: 'igniter', name: 'Igniter',
    description: 'Deal +20% damage against burning enemies.',
    category: 'burn', tier: 'starter', rarity: 'uncommon',
    color: BURN_COLOR, maxStacks: 1, tags: ['burn', 'damage', 'conditional'],
    apply: (_s, e) => {
      e.registerTrigger('igniter', {
        event: 'onHit',
        action: (ctx) => {
          if (ctx.enemy.statusEffects.burn) {
            ctx.result.damage = Math.floor(ctx.result.damage * 1.20);
          }
        },
      });
    },
  },
  {
    id: 'backdraft', name: 'Backdraft',
    description: 'When a burning enemy dies, 60% chance the next enemy also ignites.',
    category: 'burn', tier: 'synergy', rarity: 'uncommon',
    color: BURN_COLOR, maxStacks: 1, tags: ['burn', 'kills'],
    apply: (_s, e) => { reg(e, 'backdraft'); },
  },
  {
    id: 'conflagration', name: 'Conflagration',
    description: 'Burn ticks can critically strike, doubling their damage.',
    category: 'burn', tier: 'transformation', rarity: 'rare',
    requires: ['eagle_eye'],
    color: BURN_COLOR, maxStacks: 1, tags: ['burn', 'crit', 'transform'],
    apply: (s, e) => {
      s.burnCanCrit = true;
      reg(e, 'conflagration');
    },
  },
  {
    id: 'spontaneous_combustion', name: 'Spontaneous Combustion',
    description: 'If a single hit deals more than 30% of the enemy\'s max HP, instantly ignite them.',
    category: 'burn', tier: 'synergy', rarity: 'rare',
    color: BURN_COLOR, maxStacks: 1, tags: ['burn', 'damage'],
    apply: (_s, e) => { reg(e, 'spontaneous_combustion'); },
  },
  {
    id: 'phoenix_protocol', name: 'Phoenix Protocol',
    description: 'Once per run, survive a killing blow at 1 HP. Next 5 attacks deal double damage.',
    flavour: '"It wasn\'t the fall. It was the landing."',
    category: 'burn', tier: 'keystone', rarity: 'legendary',
    color: BURN_COLOR, maxStacks: 1, tags: ['burn', 'keystone', 'survival'],
    apply: (_s, e) => { reg(e, 'phoenix_protocol'); },
  },
];

// ---------------------------------------------------------------------------
// LIGHTNING CATEGORY  (#00bcd4 cyan)
// ---------------------------------------------------------------------------

const LTN_COLOR = 0x00bcd4;

const LIGHTNING: UpgradeDefinition[] = [
  {
    id: 'static_charge', name: 'Static Charge',
    description: '15% chance per attack to chain lightning for 50% of hit damage.',
    category: 'lightning', tier: 'starter', rarity: 'common',
    color: LTN_COLOR, maxStacks: 3, stackNote: '+15% lightning chance per stack',
    tags: ['lightning', 'chain'],
    apply: (s) => {
      s.lightningChance = (s.lightningChance ?? 0) + 0.15;
      s.lightningDamage = s.lightningDamage ?? 0.5;
    },
  },
  {
    id: 'spark', name: 'Spark',
    description: 'Build a charge every 3 attacks. On full charge, release lightning for 80% damage.',
    category: 'lightning', tier: 'starter', rarity: 'uncommon',
    color: LTN_COLOR, maxStacks: 1, tags: ['lightning', 'charge'],
    apply: (s, e) => {
      s.lightningDamage = Math.max(s.lightningDamage ?? 0, 0.80);
      reg(e, 'spark');
    },
  },
  {
    id: 'overload', name: 'Overload',
    description: 'Critical hits always chain lightning, ignoring the chance roll.',
    category: 'lightning', tier: 'synergy', rarity: 'rare',
    requires: ['static_charge'],
    color: LTN_COLOR, maxStacks: 1, tags: ['lightning', 'crit'],
    apply: (_s, e) => { reg(e, 'overload'); },
  },
  {
    id: 'ball_lightning', name: 'Ball Lightning',
    description: 'Remove the lightning chance roll. Instead, every 3 attacks release a guaranteed lightning strike for 100% damage.',
    category: 'lightning', tier: 'transformation', rarity: 'rare',
    color: LTN_COLOR, maxStacks: 1, tags: ['lightning', 'transform'],
    apply: (s, e) => {
      s.lightningChance = 0;
      s.lightningDamage = Math.max(s.lightningDamage ?? 0, 1.0);
      reg(e, 'ball_lightning');
    },
  },
  {
    id: 'thunder_engine', name: 'Thunder Engine',
    description: 'Every critical hit releases lightning dealing 50% of crit damage. Always hits.',
    flavour: '"Every strike carries the storm inside it."',
    category: 'lightning', tier: 'keystone', rarity: 'legendary',
    color: LTN_COLOR, maxStacks: 1, tags: ['lightning', 'crit', 'keystone'],
    apply: (s, e) => {
      s.lightningDamage = Math.max(s.lightningDamage ?? 0, 0.50);
      reg(e, 'thunder_engine');
      reg(e, 'overload');  // crits always chain
    },
  },
];

// ---------------------------------------------------------------------------
// SUMMONS CATEGORY  (#1abc9c teal)
// ---------------------------------------------------------------------------

const SUM_COLOR = 0x1abc9c;

const SUMMONS: UpgradeDefinition[] = [
  {
    id: 'familiar', name: 'Familiar',
    description: 'Summon a familiar that deals 20% of your damage with each of your attacks.',
    category: 'summons', tier: 'starter', rarity: 'uncommon',
    color: SUM_COLOR, maxStacks: 2, tags: ['summons', 'familiar'],
    apply: (s) => {
      s.summonCount         = (s.summonCount ?? 0) + 1;
      s.summonDamagePercent = s.summonDamagePercent ?? 0.20;
    },
  },
  {
    id: 'pack_leader', name: 'Pack Leader',
    description: 'Each active summon grants +5% to your own damage.',
    category: 'summons', tier: 'starter', rarity: 'uncommon',
    color: SUM_COLOR, maxStacks: 1, tags: ['summons', 'damage'],
    apply: (s, e) => {
      reg(e, 'pack_leader');
      // Apply immediately based on current summon count
      const bonus = (s.summonCount ?? 0) * 0.05;
      s.damage = Math.ceil(s.damage * (1 + bonus));
    },
  },
  {
    id: 'coordinated_strike', name: 'Coordinated Strike',
    description: 'When you land a critical hit, all summons attack simultaneously (their damage fires once per summon).',
    category: 'summons', tier: 'synergy', rarity: 'rare',
    requires: ['familiar'],
    color: SUM_COLOR, maxStacks: 1, tags: ['summons', 'crit'],
    apply: (_s, e) => { reg(e, 'coordinated_strike'); },
  },
  {
    id: 'lich_form', name: 'Lich Form',
    description: 'You stop attacking. Summons gain +300% damage and attack twice as often.',
    flavour: '"Command is its own kind of power."',
    category: 'summons', tier: 'keystone', rarity: 'legendary',
    requires: ['familiar'],
    color: SUM_COLOR, maxStacks: 1, tags: ['summons', 'keystone'],
    apply: (s, e) => {
      s.damage              = 0;
      s.summonDamagePercent = (s.summonDamagePercent ?? 0.20) * 4;  // +300%
      reg(e, 'lich_form');
    },
  },
];

// ---------------------------------------------------------------------------
// RAGE CATEGORY  (#c0392b dark red)
// ---------------------------------------------------------------------------

const RAGE_COLOR = 0xc0392b;

const RAGE: UpgradeDefinition[] = [
  {
    id: 'fury', name: 'Fury',
    description: '+8% damage when below 75% HP. Each stack of Fury adds another 8%.',
    category: 'rage', tier: 'starter', rarity: 'common',
    color: RAGE_COLOR, maxStacks: 4, stackNote: '+8% low-HP damage bonus per stack',
    tags: ['rage', 'hp', 'conditional'],
    apply: (_s, e) => { reg(e, 'fury'); },
  },
  {
    id: 'berserkers_heart', name: "Berserker's Heart",
    description: '+15% damage when below 50% HP.',
    category: 'rage', tier: 'starter', rarity: 'uncommon',
    color: RAGE_COLOR, maxStacks: 1, tags: ['rage', 'hp', 'conditional'],
    apply: (_s, e) => { reg(e, 'berserkers_heart'); },
  },
  {
    id: 'bloodlust', name: 'Bloodlust',
    description: 'While below 50% HP, your lifesteal rate triples.',
    category: 'rage', tier: 'synergy', rarity: 'rare',
    requires: ['leech'],
    color: RAGE_COLOR, maxStacks: 1, tags: ['rage', 'lifesteal'],
    apply: (_s, e) => { reg(e, 'bloodlust'); },
  },
  {
    id: 'frenzy', name: 'Frenzy',
    description: 'When your HP drops below 50%, gain +60% attack speed. Lost when HP recovers.',
    category: 'rage', tier: 'transformation', rarity: 'rare',
    color: RAGE_COLOR, maxStacks: 1, tags: ['rage', 'speed', 'transform'],
    apply: (_s, e) => { reg(e, 'frenzy'); },
  },
  {
    id: 'rage_god', name: 'Rage God',
    description: 'Damage scales with missing HP: 1× at full, ~5× at 50%, 10× at 1 HP. Lifesteal reduced by 75%.',
    flavour: '"Pain is just data. I\'ve collected a lot of data."',
    category: 'rage', tier: 'keystone', rarity: 'legendary',
    color: RAGE_COLOR, maxStacks: 1, tags: ['rage', 'hp', 'keystone'],
    apply: (s, e) => {
      // All healing is less effective (thematic penalty)
      s.lifesteal = (s.lifesteal ?? 0) * 0.25;
      reg(e, 'rage_god');
    },
  },
];

// ---------------------------------------------------------------------------
// BERSERKER CATEGORY  (#d35400 dark orange)
// ---------------------------------------------------------------------------

const BRSRK_COLOR = 0xd35400;

const BERSERKER: UpgradeDefinition[] = [
  {
    id: 'quick_draw', name: 'Quick Draw',
    description: '+15% attack speed.',
    category: 'berserker', tier: 'starter', rarity: 'common',
    color: BRSRK_COLOR, maxStacks: 5, stackNote: '+15% attack speed per stack',
    tags: ['speed', 'basic'],
    apply: (s) => { s.attackSpeed = parseFloat((s.attackSpeed * 1.15).toFixed(3)); },
  },
  {
    id: 'combo_sense', name: 'Combo Sense',
    description: 'Each consecutive hit without taking damage grants +1% damage (max +20%). Resets on damage.',
    category: 'berserker', tier: 'starter', rarity: 'uncommon',
    color: BRSRK_COLOR, maxStacks: 1, tags: ['speed', 'combo'],
    apply: (_s, e) => { reg(e, 'combo_sense'); },
  },
  {
    id: 'perpetual_motion', name: 'Perpetual Motion',
    description: 'Kills extend your active combo — they no longer reset the streak.',
    category: 'berserker', tier: 'synergy', rarity: 'rare',
    requires: ['combo_sense'],
    color: BRSRK_COLOR, maxStacks: 1, tags: ['speed', 'combo', 'kills'],
    apply: (_s, e) => { reg(e, 'perpetual_motion'); },
  },
  {
    id: 'infinite_assault', name: 'Infinite Assault',
    description: 'Start at 30% damage. Each consecutive hit multiplies damage ×1.05. Equal to normal at 20 hits; 4× normal at 50 hits.',
    category: 'berserker', tier: 'transformation', rarity: 'rare',
    color: BRSRK_COLOR, maxStacks: 1, tags: ['speed', 'combo', 'transform'],
    apply: (_s, e) => { reg(e, 'infinite_assault'); },
  },
  {
    id: 'speedforce', name: 'Speedforce',
    description: 'For every 0.5 atk/s above 2.0, fire an extra projectile dealing 40% damage.',
    flavour: '"Fast enough to outrun causality."',
    category: 'berserker', tier: 'keystone', rarity: 'legendary',
    color: BRSRK_COLOR, maxStacks: 1, tags: ['speed', 'area', 'keystone'],
    apply: (_s, e) => { reg(e, 'speedforce'); },
  },
];

// ---------------------------------------------------------------------------
// ECONOMY CATEGORY  (#f39c12 amber)
// ---------------------------------------------------------------------------

const ECO_COLOR = 0xf39c12;

const ECONOMY: UpgradeDefinition[] = [
  {
    id: 'treasure_hunter', name: 'Treasure Hunter',
    description: '+8 gold on each floor clear.',
    category: 'economy', tier: 'starter', rarity: 'common',
    color: ECO_COLOR, maxStacks: 4, stackNote: '+8 gold per floor clear per stack',
    tags: ['gold', 'economy'],
    apply: (s) => { s.goldPerFloor = (s.goldPerFloor ?? 0) + 8; },
  },
  {
    id: 'midas_touch', name: 'Midas Touch',
    description: 'Critical hits generate 1 gold each.',
    category: 'economy', tier: 'synergy', rarity: 'uncommon',
    requires: ['eagle_eye'],
    color: ECO_COLOR, maxStacks: 1, tags: ['gold', 'crit'],
    apply: (_s, e) => { reg(e, 'midas_touch'); },
  },
  {
    id: 'war_chest', name: 'War Chest',
    description: 'At the start of each floor, convert your gold total into a damage bonus (every 10 gold = +1% damage for that floor).',
    category: 'economy', tier: 'transformation', rarity: 'rare',
    color: ECO_COLOR, maxStacks: 1, tags: ['gold', 'damage', 'transform'],
    apply: (_s, e) => { reg(e, 'war_chest'); },
  },
  {
    id: 'compound_interest', name: 'Compound Interest',
    description: 'After every 5 floors, your current gold total increases by 20%.',
    category: 'economy', tier: 'synergy', rarity: 'uncommon',
    color: ECO_COLOR, maxStacks: 1, tags: ['gold', 'economy'],
    apply: (_s, e) => { reg(e, 'compound_interest'); },
  },
];

// ---------------------------------------------------------------------------
// COOLDOWN / ABILITY CATEGORY  (#16a085 dark teal)
// ---------------------------------------------------------------------------

const CD_COLOR = 0x16a085;

const COOLDOWN: UpgradeDefinition[] = [
  {
    id: 'echo', name: 'Echo',
    description: '20% chance that any special effect (lightning, burn proc, poison proc) triggers twice.',
    category: 'cooldown', tier: 'starter', rarity: 'uncommon',
    color: CD_COLOR, maxStacks: 3, stackNote: '+20% echo proc chance per stack',
    tags: ['ability', 'double'],
    apply: (_s, e) => {
      // Echo is checked inside RulesEngine for each proc — register once
      reg(e, 'echo');
    },
  },
  {
    id: 'quick_recovery', name: 'Quick Recovery',
    description: 'Every 8 attacks, release a free burst dealing 80% of your base damage.',
    category: 'cooldown', tier: 'starter', rarity: 'uncommon',
    color: CD_COLOR, maxStacks: 1, tags: ['ability', 'burst'],
    apply: (_s, e) => {
      e.registerTrigger('quick_recovery', {
        event: 'onHit',
        action: (ctx) => {
          if (ctx.engine.hitStreak > 0 && (ctx.engine.floorKills + 1) % 8 === 0) {
            ctx.result.areaDamage += Math.floor(ctx.stats.damage * 0.80);
          }
        },
      });
    },
  },
  {
    id: 'preparation', name: 'Preparation',
    description: 'At the start of each floor, your next 3 attacks are guaranteed to critically strike.',
    category: 'cooldown', tier: 'synergy', rarity: 'rare',
    requires: ['eagle_eye'],
    color: CD_COLOR, maxStacks: 1, tags: ['ability', 'crit'],
    apply: (_s, e) => {
      // Handled via onFloorStart trigger that temporarily sets critChance to 1
      e.registerTrigger('preparation', {
        event: 'onFloorStart',
        action: (ctx) => {
          // Store original crit and boost
          ctx.stats.critChance = Math.min(1.0, (ctx.stats.critChance ?? 0) + 0.99);
        },
      });
    },
  },
  {
    id: 'perpetual_machine', name: 'Perpetual Machine',
    description: 'Every 10 consecutive unhit attacks, all procs (poison, burn, lightning) fire at once. Resets on taking damage.',
    flavour: '"The machine does not tire. You might."',
    category: 'cooldown', tier: 'keystone', rarity: 'legendary',
    color: CD_COLOR, maxStacks: 1, tags: ['ability', 'keystone'],
    apply: (_s, e) => {
      reg(e, 'perpetual_machine');
      e.registerTrigger('perpetual_machine', {
        event: 'onHit',
        action: (ctx) => {
          if (ctx.engine.hitStreak > 0 && ctx.engine.hitStreak % 10 === 0) {
            // Force all procs this hit
            if ((ctx.stats.poisonChance ?? 0) > 0)  ctx.result.poisonApplied = Math.max(ctx.result.poisonApplied, ctx.stats.poisonStacks ?? 1);
            if ((ctx.stats.burnChance   ?? 0) > 0)  ctx.result.burnApplied   = true;
            if ((ctx.stats.lightningChance ?? 0) > 0) ctx.result.lightningDamage = Math.max(ctx.result.lightningDamage, Math.floor(ctx.damage * (ctx.stats.lightningDamage ?? 0.5)));
          }
        },
      });
    },
  },
];

// ---------------------------------------------------------------------------
// AREA DAMAGE CATEGORY  (#e74c3c red — distinct shade via lighter tint)
// ---------------------------------------------------------------------------

const AREA_COLOR = 0xff7675;

const AREA_DAMAGE: UpgradeDefinition[] = [
  {
    id: 'cleave', name: 'Cleave',
    description: 'Every attack deals +30% of its damage as bonus area damage.',
    category: 'areaDamage', tier: 'starter', rarity: 'common',
    color: AREA_COLOR, maxStacks: 3, stackNote: '+30% area damage per stack',
    tags: ['area', 'basic'],
    apply: (s) => { s.areaPercent = (s.areaPercent ?? 0) + 0.30; },
  },
  {
    id: 'shockwave', name: 'Shockwave',
    description: 'Every 5th attack releases a shockwave for an additional 40% of hit damage.',
    category: 'areaDamage', tier: 'starter', rarity: 'uncommon',
    color: AREA_COLOR, maxStacks: 1, tags: ['area', 'periodic'],
    apply: (s) => {
      s.areaEveryNHits = s.areaEveryNHits && s.areaEveryNHits > 0 ? Math.min(s.areaEveryNHits, 5) : 5;
    },
  },
  {
    id: 'ripple', name: 'Ripple',
    description: 'Area damage procs also apply 1 poison stack to the target.',
    category: 'areaDamage', tier: 'synergy', rarity: 'uncommon',
    requires: ['cleave'],
    color: AREA_COLOR, maxStacks: 1, tags: ['area', 'poison'],
    apply: (_s, e) => {
      e.registerTrigger('ripple', {
        event: 'onHit',
        action: (ctx) => {
          if (ctx.result.areaDamage > 0) {
            ctx.result.poisonApplied = Math.max(ctx.result.poisonApplied, 1);
          }
        },
      });
    },
  },
  {
    id: 'nuclear_option', name: 'Nuclear Option',
    description: 'Your direct attack deals 40% of normal damage. Area damage increases to 300%. You are now an area specialist.',
    category: 'areaDamage', tier: 'transformation', rarity: 'rare',
    color: AREA_COLOR, maxStacks: 1, tags: ['area', 'transform'],
    apply: (s) => {
      s.damage      = Math.floor(s.damage * 0.40);
      s.areaPercent = 3.0;
    },
  },
  {
    id: 'singularity', name: 'Singularity',
    description: 'Once per floor, your next attack deals +200% bonus damage as a gravitational burst. Recharges on clear.',
    flavour: '"Even light cannot escape what you have become."',
    category: 'areaDamage', tier: 'keystone', rarity: 'legendary',
    color: AREA_COLOR, maxStacks: 1, tags: ['area', 'keystone'],
    apply: (_s, e) => {
      reg(e, 'singularity');
      e.registerTrigger('singularity', {
        event: 'onFloorStart',
        action: (ctx) => {
          // Re-enable singularity each floor — engine reads 'singularity_ready' in resolvePlayerAttack
          // We use gold as a proxy flag here; actual impl in GameScene
          ctx.engine.registerUpgrade('singularity_ready');
        },
      });
    },
  },
];

// ---------------------------------------------------------------------------
// Full upgrade pool
// ---------------------------------------------------------------------------

export const ALL_UPGRADES: UpgradeDefinition[] = [
  ...DAMAGE,
  ...CRITICAL,
  ...LIFESTEAL,
  ...DEFENSE,
  ...REFLECT,
  ...POISON,
  ...BURN,
  ...LIGHTNING,
  ...SUMMONS,
  ...RAGE,
  ...BERSERKER,
  ...ECONOMY,
  ...COOLDOWN,
  ...AREA_DAMAGE,
];

// ---------------------------------------------------------------------------
// Rarity weight tables  (by floor range)
// ---------------------------------------------------------------------------

interface RarityWeights { common: number; uncommon: number; rare: number; legendary: number; }

function rarityWeightsForFloor(floor: number): RarityWeights {
  if (floor <= 3)  return { common: 80, uncommon: 18, rare: 2,  legendary: 0  };
  if (floor <= 6)  return { common: 55, uncommon: 30, rare: 13, legendary: 2  };
  if (floor <= 10) return { common: 35, uncommon: 32, rare: 24, legendary: 9  };
  if (floor <= 15) return { common: 15, uncommon: 30, rare: 35, legendary: 20 };
  return              { common: 8,  uncommon: 17, rare: 38, legendary: 37 };
}

function weightedRarityRoll(weights: RarityWeights): UpgradeRarity {
  const total = weights.common + weights.uncommon + weights.rare + weights.legendary;
  let roll = Math.random() * total;
  if ((roll -= weights.common)    < 0) return 'common';
  if ((roll -= weights.uncommon)  < 0) return 'uncommon';
  if ((roll -= weights.rare)      < 0) return 'rare';
  return 'legendary';
}

// ---------------------------------------------------------------------------
// Draft picker
// ---------------------------------------------------------------------------

/**
 * Pick `count` upgrades for the upgrade screen.
 * - Weighted rarity by floor
 * - Keystones (legendary tier) are excluded from regular slots and have a
 *   separate 15% chance to replace one slot on eligible floors (>=7)
 * - Already-maxed upgrades are filtered out
 * - No duplicate IDs in one offer
 * - classWeights: optional map of category → weight multiplier (from the
 *   chosen class). Categories with weight N appear N× as often in the pool.
 */
export function pickRunUpgrades(
  count:   number,
  floor:   number,
  owned:   OwnedUpgrades,
  classWeights?: Partial<Record<string, number>>,
  guaranteeCategory?: string,   // if set, slot 0 is always from this category
): UpgradeDefinition[] {
  const weights = rarityWeightsForFloor(floor);

  // Split pool: regular vs keystones
  const regular   = ALL_UPGRADES.filter(u => u.tier !== 'keystone');
  const keystones = ALL_UPGRADES.filter(u => u.tier === 'keystone');

  const isAvailable = (u: UpgradeDefinition): boolean => {
    // Filter maxed-out
    const stacks = owned.get(u.id) ?? 0;
    if (stacks >= u.maxStacks) return false;
    // Filter unmet requirements
    if (u.requires) {
      const met = u.requires.every(req => (owned.get(req) ?? 0) > 0);
      if (!met) return false;
    }
    return true;
  };

  // Build a weighted regular pool based on class category weights
  const buildWeightedPool = (source: UpgradeDefinition[]): UpgradeDefinition[] => {
    if (!classWeights) return source;
    const pool: UpgradeDefinition[] = [];
    for (const upg of source) {
      const weight = classWeights[upg.category] ?? 1;
      for (let w = 0; w < weight; w++) pool.push(upg);
    }
    return pool;
  };

  const chosen: UpgradeDefinition[] = [];
  const usedIds = new Set<string>();

  // Guaranteed category pick (first level-up class guarantee)
  if (guaranteeCategory) {
    const catPool = regular.filter(
      u => u.category === guaranteeCategory && isAvailable(u),
    );
    if (catPool.length > 0) {
      const pick = catPool[Math.floor(Math.random() * catPool.length)];
      chosen.push(pick);
      usedIds.add(pick.id);
    }
  }

  // Decide if a keystone slot replaces one slot
  let keystoneSlot = -1;
  if (floor >= 7 && Math.random() < 0.15) {
    const availableKS = keystones.filter(isAvailable);
    if (availableKS.length > 0) {
      keystoneSlot = Math.floor(Math.random() * count);
      const ks = availableKS[Math.floor(Math.random() * availableKS.length)];
      chosen.push(ks);
      usedIds.add(ks.id);
    }
  }

  for (let i = 0; i < count; i++) {
    if (i === keystoneSlot && chosen.length >= 1) continue;  // already filled

    const rarity = weightedRarityRoll(weights);
    const weightedRegular = buildWeightedPool(regular);
    const pool = weightedRegular.filter(
      u => u.rarity === rarity && isAvailable(u) && !usedIds.has(u.id),
    );

    // Fallback: any available rarity if pool is empty
    const fallback = weightedRegular.filter(u => isAvailable(u) && !usedIds.has(u.id));
    const source = pool.length > 0 ? pool : fallback;

    if (source.length === 0) continue;  // extremely unlikely

    const pick = source[Math.floor(Math.random() * source.length)];
    chosen.push(pick);
    usedIds.add(pick.id);
  }

  // Floor 10+: if no card is synergy/transformation/keystone tier, replace the
  // last common card with one from the higher tiers to help build-smoothing.
  if (floor >= 10) {
    const hasAdvanced = chosen.some(u => u.tier !== 'starter');
    if (!hasAdvanced) {
      const advPool = regular.filter(
        u => u.tier !== 'starter' && isAvailable(u) && !usedIds.has(u.id),
      );
      if (advPool.length > 0 && chosen.length > 0) {
        const replacement = advPool[Math.floor(Math.random() * advPool.length)];
        chosen[chosen.length - 1] = replacement;
      }
    }
  }

  // Shuffle so keystone isn't always in slot 0
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }

  return chosen.slice(0, count);
}

// Re-export for backward compat (GameScene currently imports from here)
export type { UpgradeDefinition } from './UpgradeDefinition';
