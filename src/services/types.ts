/**
 * services/types.ts
 *
 * Data Transfer Objects and Service Interfaces for the platform layer.
 *
 * Architecture principle: all game code depends only on these interfaces,
 * never on a concrete implementation. When a real backend arrives, only the
 * concrete services in /local/ (or /remote/) change — nothing in game logic.
 */

// ---------------------------------------------------------------------------
// DTO: PlayerProfile
// ---------------------------------------------------------------------------

export const PROFILE_SCHEMA_VERSION = 1;

export interface PlayerProfileDTO {
  schema_version: number;
  id:             string;        // uuid, generated locally
  name:           string;
  created_at:     string;        // ISO timestamp
  last_played_at: string;        // ISO timestamp
  // ── Career ──────────────────────────────────────────────────────────────
  total_runs:           number;
  wins:                 number;  // runs reaching floor WIN_FLOOR (20+)
  highest_floor:        number;
  total_kills:          number;
  total_bosses_killed:  number;
  total_damage_dealt:   number;
  total_healing_done:   number;
  total_play_ms:        number;
  // ── Per-class breakdown ──────────────────────────────────────────────────
  runs_by_class:   Record<string, number>;  // classId → run count
  floors_by_class: Record<string, number>;  // classId → sum of floors (for avg)
  favorite_class:  string | null;           // classId with most runs
  // ── Streak ──────────────────────────────────────────────────────────────
  current_streak:    number;
  best_streak:       number;
  last_played_date:  string;        // YYYY-MM-DD, used for streak logic
  daily_played_dates: string[];     // last 30 days played
  // ── Milestones / titles ──────────────────────────────────────────────────
  unlocked_titles: string[];     // milestone ids
  active_title:    string | null;
}

// ---------------------------------------------------------------------------
// DTO: RunResult — one completed run
// ---------------------------------------------------------------------------

export interface RunResultDTO {
  id:              string;
  player_id:       string;
  mode_id:         string;   // 'classic' | 'boss_rush' | 'endless' | 'daily' | ...
  class_id:        string;
  floor_reached:   number;
  score:           number;
  build_archetype: string;
  relics_owned:    string[];
  keystone_owned:  string | null;
  kills:           number;
  bosses_killed:   number;
  damage_dealt:    number;
  healing_done:    number;
  highest_hit:     number;
  duration_ms:     number;
  date:            string;   // ISO timestamp
  won:             boolean;  // reached WIN_FLOOR
}

// ---------------------------------------------------------------------------
// DTO: LeaderboardEntry
// ---------------------------------------------------------------------------

export interface LeaderboardEntryDTO {
  rank:            number;
  player_id:       string;
  player_name:     string;
  class_id:        string;
  floor_reached:   number;
  score:           number;
  build_archetype: string;
  duration_ms:     number;
  date:            string;
  mode_id:         string;
}

// ---------------------------------------------------------------------------
// DTO: DailyChallenge
// ---------------------------------------------------------------------------

export interface DailyChallengeDTO {
  date:           string;        // YYYY-MM-DD
  seed:           string;        // deterministic RNG seed
  forced_class:   string | null; // null = random from seed
  leaderboard_id: string;        // e.g. 'daily_2025-03-15'
}

// ---------------------------------------------------------------------------
// Milestone definitions
// ---------------------------------------------------------------------------

export interface MilestoneDefinition {
  id:          string;
  title:       string;        // displayed as cosmetic label on leaderboard
  description: string;
  check:       (profile: PlayerProfileDTO, run?: RunResultDTO) => boolean;
}

export const ALL_MILESTONES: MilestoneDefinition[] = [
  {
    id:          'first_steps',
    title:       'First Steps',
    description: 'Complete your first run',
    check:       (p) => p.total_runs >= 1,
  },
  {
    id:          'floor_20',
    title:       'Climber',
    description: 'Reach Floor 20',
    check:       (p) => p.highest_floor >= 20,
  },
  {
    id:          'floor_40',
    title:       'High Ascent',
    description: 'Reach Floor 40',
    check:       (p) => p.highest_floor >= 40,
  },
  {
    id:          'boss_slayer',
    title:       'Boss Slayer',
    description: 'Defeat 10 bosses across all runs',
    check:       (p) => p.total_bosses_killed >= 10,
  },
  {
    id:          'veteran',
    title:       'Veteran',
    description: 'Complete 25 runs',
    check:       (p) => p.total_runs >= 25,
  },
  {
    id:          'speed_demon',
    title:       'Speed Demon',
    description: 'Complete a run in under 5 minutes',
    check:       (_p, run) => !!run && run.duration_ms < 300_000 && run.floor_reached >= 5,
  },
  {
    id:          'devoted',
    title:       'Devoted',
    description: 'Maintain a 7-day play streak',
    check:       (p) => p.best_streak >= 7,
  },
  {
    id:          'damage_dealer',
    title:       'Damage Dealer',
    description: 'Deal 500,000 total damage across all runs',
    check:       (p) => p.total_damage_dealt >= 500_000,
  },
];

// ---------------------------------------------------------------------------
// Service Interfaces
// ---------------------------------------------------------------------------

/** Everything related to the player's persistent identity and career stats. */
export interface IProfileService {
  /** Returns null if no profile has been created yet (first launch). */
  getProfile(): PlayerProfileDTO | null;
  /** Creates a fresh profile for a new player. */
  createProfile(name: string): PlayerProfileDTO;
  /** Persist arbitrary field updates. */
  updateProfile(updates: Partial<PlayerProfileDTO>): void;
  /** Called at the end of every run. Updates all aggregates + streak + milestones. */
  recordRunEnd(run: RunResultDTO): { newTitles: string[] };
  /** Rename the player (used from settings). */
  renamePlayer(name: string): void;
  /** Delete all local data. */
  reset(): void;
}

/** Stores per-run history for the recent runs table. */
export interface IRunHistoryService {
  addRun(run: RunResultDTO): void;
  getRecentRuns(limit?: number): RunResultDTO[];
  clear(): void;
}

/** Leaderboard read/write. In Sprint 1 this is local-only. */
export interface ILeaderboardService {
  submit(entry: Omit<LeaderboardEntryDTO, 'rank'>): void;
  fetch(options: { modeId: string; limit?: number }): LeaderboardEntryDTO[];
}
