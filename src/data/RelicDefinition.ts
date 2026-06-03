import type { CombatStats } from '../combat/CombatStats';
import type { RulesEngine }  from '../combat/RulesEngine';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type RelicRarity = 'uncommon' | 'rare' | 'legendary';

// ---------------------------------------------------------------------------
// Core interface
// ---------------------------------------------------------------------------

export interface RelicDefinition {
  id:           string;
  name:         string;
  description:  string;
  flavour?:     string;
  rarity:       RelicRarity;
  /** Hex colour for card accent. */
  color:        number;
  tags:         string[];
  /**
   * Called once when the player acquires the relic.
   * May mutate stats AND register triggers with the engine.
   */
  onAcquire:    (stats: CombatStats, engine: RulesEngine) => void;
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const RELIC_RARITY_COLOR: Record<RelicRarity, number> = {
  uncommon:  0x2ecc71,
  rare:      0x3498db,
  legendary: 0xffd700,
};

export const RELIC_RARITY_LABEL: Record<RelicRarity, string> = {
  uncommon:  'UNCOMMON',
  rare:      'RARE',
  legendary: 'LEGENDARY',
};
