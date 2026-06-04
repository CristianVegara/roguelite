import type { CombatStats } from '../combat/CombatStats';
import type { RulesEngine }  from '../combat/RulesEngine';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type BuildCategory =
  | 'damage'     | 'critical'   | 'lifesteal'   | 'defense'
  | 'reflect'    | 'poison'     | 'burn'         | 'lightning'
  | 'summons'    | 'rage'       | 'berserker'    | 'economy'
  | 'cooldown'   | 'areaDamage';

export type UpgradeTier    = 'starter' | 'synergy' | 'transformation' | 'keystone';
export type UpgradeRarity  = 'common'  | 'uncommon' | 'rare'          | 'legendary';

// ---------------------------------------------------------------------------
// Core interface
// ---------------------------------------------------------------------------

export interface UpgradeDefinition {
  id:           string;
  name:         string;
  description:  string;
  flavour?:     string;       // optional lore line shown in dim below desc
  category:     BuildCategory;
  tier:         UpgradeTier;
  rarity:       UpgradeRarity;
  /** Hex colour used for card accent and label text. */
  color:        number;
  /** Maximum times this upgrade can be taken in a single run (1 for keystones). */
  maxStacks:    number;
  /**
   * Short note shown on the card when maxStacks > 1, explaining what each
   * additional stack adds. E.g. "+20% damage per stack".
   */
  stackNote?:   string;
  /** IDs of other upgrades the player must own before this appears. */
  requires?:    string[];
  /** Semantic tags used by the Phase 4 draft biasing system. */
  tags:         string[];
  /**
   * Called once per stack when the player takes the upgrade.
   * Mutates stats AND registers triggers with the engine.
   * Designed to be safely called multiple times (each call = 1 stack).
   */
  apply: (stats: CombatStats, engine: RulesEngine) => void;
}

// ---------------------------------------------------------------------------
// Runtime tracking
// ---------------------------------------------------------------------------

/** Tracks how many times each upgrade has been taken this run. */
export type OwnedUpgrades = Map<string, number>;

// ---------------------------------------------------------------------------
// Visual floater specs (returned by RulesEngine, rendered by GameScene)
// ---------------------------------------------------------------------------

export type FloaterType =
  | 'damage' | 'crit'    | 'heal'    | 'poison'
  | 'burn'   | 'lightning'| 'area'   | 'reflect'
  | 'summon' | 'gold'    | 'shield';

export interface FloaterSpec {
  value:  number;
  type:   FloaterType;
  /** Which entity should the floater appear above. */
  target: 'player' | 'enemy';
}

// ---------------------------------------------------------------------------
// Rarity display helpers
// ---------------------------------------------------------------------------

export const RARITY_COLOR: Record<UpgradeRarity, number> = {
  common:     0x888899,
  uncommon:   0x2ecc71,
  rare:       0x3498db,
  legendary:  0xffd700,
};

export const RARITY_LABEL: Record<UpgradeRarity, string> = {
  common:     'COMMON',
  uncommon:   'UNCOMMON',
  rare:       'RARE',
  legendary:  'LEGENDARY',
};

export const TIER_LABEL: Record<UpgradeTier, string> = {
  starter:        'Starter',
  synergy:        'Synergy',
  transformation: 'Transform',
  keystone:       'KEYSTONE',
};
