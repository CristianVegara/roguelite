/**
 * Game Mode System — Phase 4
 *
 * Each mode is a self-contained config object.
 * Adding a new mode = adding one entry to MODES_REGISTRY.
 * All game code reads rules through RunConfig; nothing reaches into
 * GameModeConfig at runtime except ModeRunner and the hub UI.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModeId =
  | 'classic'    // standard run, no rule changes
  | 'endless'    // same as classic but separate leaderboard
  | 'one_hp'     // maxHp=1, armor still applies
  | 'chaos'      // random class + 2 random starting relics
  | 'boss_rush'  // every floor is a boss; between-boss upgrade drafts
  | 'nightmare'; // harder enemies, forced modifiers, no meta bonuses

export type ModeDifficulty = 'normal' | 'hard' | 'extreme';

export interface GameModeRules {
  /** null = player picks class in ClassScene */
  forcedClassId:          string | null;
  /** If true, a random class is chosen at runtime (skips ClassScene) */
  forceRandomClass:       boolean;
  /** Bonus gold granted before floor 1 */
  startingGold:           number;
  /** Override player maxHp (null = keep stat bonuses) */
  maxHpOverride:          number | null;
  /** Set lifesteal to 0 and prevent shield generation */
  disableLifesteal:       boolean;
  /** N random relics applied before combat starts */
  forceRandomRelics:      number;
  /** Boss floors still appear normally */
  noFloorCap:             boolean;   // flag for leaderboard display only; FloorManager already scales forever

  // ── Boss Rush ──────────────────────────────────────────────────────────────
  /** Every floor is a boss; regular floor logic and modifiers are bypassed. */
  bossesOnly:             boolean;

  // ── Nightmare ──────────────────────────────────────────────────────────────
  /** Multiply all enemy base HP. */
  enemyHpMultiplier:      number;
  /** Multiply all enemy base damage. */
  enemyDamageMultiplier:  number;
  /** Multiply all enemy attack speed. */
  enemySpeedMultiplier:   number;
  /** If true, permanent upgrade bonuses (damage, HP, attack speed) are not applied. */
  noMetaBonuses:          boolean;
  /** If true, every floor has a modifier (no plain floors). */
  allFloorsModified:      boolean;
  /** Override the boss-floor interval (default 10). */
  bossEveryNFloors:       number;
}

export interface GameModeConfig {
  id:          ModeId;
  name:        string;
  tagline:     string;
  icon:        string;           // emoji or symbol
  color:       number;           // hex accent colour
  difficulty:  ModeDifficulty;
  isAvailable: () => boolean;
  rules:       GameModeRules;
  scoring: {
    formula:      'floor' | 'floor_time' | 'bosses';
    displayLabel: string;        // e.g. "Floor reached" | "Bosses cleared"
  };
  rewards: {
    currencyMultiplier: number;  // ×1.0 = same as classic
  };
  leaderboard: {
    id: string;
  };
}

// ---------------------------------------------------------------------------
// Default rules (spread + override for each mode)
// ---------------------------------------------------------------------------

const DEFAULT_RULES: GameModeRules = {
  forcedClassId:          null,
  forceRandomClass:       false,
  startingGold:           0,
  maxHpOverride:          null,
  disableLifesteal:       false,
  forceRandomRelics:      0,
  noFloorCap:             false,
  bossesOnly:             false,
  enemyHpMultiplier:      1,
  enemyDamageMultiplier:  1,
  enemySpeedMultiplier:   1,
  noMetaBonuses:          false,
  allFloorsModified:      false,
  bossEveryNFloors:       10,
};

// ---------------------------------------------------------------------------
// Mode registry
// ---------------------------------------------------------------------------

export const MODES_REGISTRY: GameModeConfig[] = [
  {
    id:         'classic',
    name:       'Classic Run',
    tagline:    'Standard run. Build your way to the top.',
    icon:       '⚔',
    color:      0x4fc3f7,
    difficulty: 'normal',
    isAvailable: () => true,
    rules:      { ...DEFAULT_RULES },
    scoring:    { formula: 'floor', displayLabel: 'Floor reached' },
    rewards:    { currencyMultiplier: 1.0 },
    leaderboard: { id: 'classic_all_time' },
  },

  {
    id:         'endless',
    name:       'Endless',
    tagline:    'No finish line. How far can you go?',
    icon:       '∞',
    color:      0x9b59b6,
    difficulty: 'normal',
    isAvailable: () => true,
    rules:      { ...DEFAULT_RULES, noFloorCap: true },
    scoring:    { formula: 'floor', displayLabel: 'Floor reached' },
    rewards:    { currencyMultiplier: 1.0 },
    leaderboard: { id: 'endless_all_time' },
  },

  {
    id:         'one_hp',
    name:       'One HP',
    tagline:    'You have 1 HP. Armor is your only shield.',
    icon:       '♥',
    color:      0xe74c3c,
    difficulty: 'extreme',
    isAvailable: () => true,
    rules:      {
      ...DEFAULT_RULES,
      maxHpOverride:    1,
      disableLifesteal: true,
    },
    scoring:    { formula: 'floor', displayLabel: 'Floor reached' },
    rewards:    { currencyMultiplier: 1.5 },
    leaderboard: { id: 'one_hp_all_time' },
  },

  {
    id:         'chaos',
    name:       'Chaos Run',
    tagline:    'Random class. Random relics. Adapt or die.',
    icon:       '⚡',
    color:      0xe67e22,
    difficulty: 'hard',
    isAvailable: () => true,
    rules:      {
      ...DEFAULT_RULES,
      forceRandomClass:  true,
      forceRandomRelics: 2,
    },
    scoring:    { formula: 'floor', displayLabel: 'Floor reached' },
    rewards:    { currencyMultiplier: 1.2 },
    leaderboard: { id: 'chaos_all_time' },
  },

  {
    id:         'boss_rush',
    name:       'Boss Rush',
    tagline:    'Every floor is a boss. How many can you fell?',
    icon:       '☠',
    color:      0xf1c40f,
    difficulty: 'hard',
    isAvailable: () => true,
    rules:      {
      ...DEFAULT_RULES,
      bossesOnly:        true,
      forceRandomRelics: 0,   // relics come from relic floors every 3 bosses
    },
    scoring:    { formula: 'bosses', displayLabel: 'Bosses cleared' },
    rewards:    { currencyMultiplier: 1.25 },
    leaderboard: { id: 'boss_rush_all_time' },
  },

  {
    id:         'nightmare',
    name:       'Nightmare',
    tagline:    'Maximum difficulty. No mercy, no bonuses.',
    icon:       '💀',
    color:      0x8e44ad,
    difficulty: 'extreme',
    isAvailable: () => true,
    rules:      {
      ...DEFAULT_RULES,
      enemyHpMultiplier:      1.4,
      enemyDamageMultiplier:  1.25,
      enemySpeedMultiplier:   1.15,
      noMetaBonuses:          true,
      allFloorsModified:      true,
      bossEveryNFloors:       8,
    },
    scoring:    { formula: 'floor', displayLabel: 'Floor reached' },
    rewards:    { currencyMultiplier: 3.0 },
    leaderboard: { id: 'nightmare_all_time' },
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getModeById(id: string): GameModeConfig {
  return MODES_REGISTRY.find(m => m.id === id) ?? MODES_REGISTRY[0];
}

export function getDefaultRules(): GameModeRules {
  return { ...DEFAULT_RULES };
}
