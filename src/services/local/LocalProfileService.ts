import {
  IProfileService,
  PlayerProfileDTO,
  RunResultDTO,
  ALL_MILESTONES,
  PROFILE_SCHEMA_VERSION,
} from '../types';

const SAVE_KEY = 'roguelite_profile_v1';

/** Blocked names (reserved / common profanity seeds). Extend as needed. */
const BLOCKED_NAMES = new Set([
  'admin', 'system', 'bot', 'null', 'undefined', 'test', 'root',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
}

function yesterday(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

function blankProfile(id: string, name: string): PlayerProfileDTO {
  const now = new Date().toISOString();
  return {
    schema_version:     PROFILE_SCHEMA_VERSION,
    id,
    name,
    created_at:         now,
    last_played_at:     now,
    total_runs:         0,
    wins:               0,
    highest_floor:      0,
    total_kills:        0,
    total_bosses_killed: 0,
    total_damage_dealt: 0,
    total_healing_done: 0,
    total_play_ms:      0,
    runs_by_class:      {},
    floors_by_class:    {},
    favorite_class:     null,
    current_streak:     0,
    best_streak:        0,
    last_played_date:   '',
    daily_played_dates: [],
    unlocked_titles:    [],
    active_title:       null,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class LocalProfileService implements IProfileService {

  // ── Public API ─────────────────────────────────────────────────────────────

  getProfile(): PlayerProfileDTO | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as Partial<PlayerProfileDTO>;
      if (data.schema_version !== PROFILE_SCHEMA_VERSION) {
        console.warn('[LocalProfileService] schema version mismatch — clearing save');
        localStorage.removeItem(SAVE_KEY);
        return null;
      }
      return data as PlayerProfileDTO;
    } catch {
      return null;
    }
  }

  createProfile(name: string): PlayerProfileDTO {
    const profile = blankProfile(generateId(), name.trim());
    this.save(profile);
    return profile;
  }

  updateProfile(updates: Partial<PlayerProfileDTO>): void {
    const p = this.getProfile();
    if (!p) return;
    this.save({ ...p, ...updates });
  }

  recordRunEnd(run: RunResultDTO): { newTitles: string[] } {
    const p = this.getProfile();
    if (!p) return { newTitles: [] };

    // ── Aggregate stats ────────────────────────────────────────────────────
    p.total_runs          += 1;
    p.wins                += run.won ? 1 : 0;
    p.highest_floor        = Math.max(p.highest_floor, run.floor_reached);
    p.total_kills         += run.kills;
    p.total_bosses_killed += run.bosses_killed;
    p.total_damage_dealt  += run.damage_dealt;
    p.total_healing_done  += run.healing_done;
    p.total_play_ms       += run.duration_ms;
    p.last_played_at       = new Date().toISOString();

    // ── Per-class breakdown ────────────────────────────────────────────────
    const cid = run.class_id;
    p.runs_by_class[cid]   = (p.runs_by_class[cid]   ?? 0) + 1;
    p.floors_by_class[cid] = (p.floors_by_class[cid] ?? 0) + run.floor_reached;

    // Favorite = most runs
    p.favorite_class = Object.entries(p.runs_by_class)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

    // ── Win/loss tracking satisfied by `wins` above ───────────────────────

    // ── Streak ────────────────────────────────────────────────────────────
    this.updateStreak(p);

    // ── Milestones ────────────────────────────────────────────────────────
    const newTitles = this.checkMilestones(p, run);
    newTitles.forEach(id => {
      if (!p.unlocked_titles.includes(id)) p.unlocked_titles.push(id);
    });

    // Auto-equip the first unlocked title if none active
    if (!p.active_title && newTitles.length > 0) {
      p.active_title = newTitles[0];
    }

    this.save(p);
    return { newTitles };
  }

  renamePlayer(name: string): void {
    this.updateProfile({ name: name.trim() });
  }

  reset(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private updateStreak(p: PlayerProfileDTO): void {
    const t = today();
    if (p.last_played_date === t) return;  // already played today

    if (p.last_played_date === yesterday()) {
      p.current_streak += 1;
    } else {
      p.current_streak = 1;  // missed a day
    }

    p.best_streak      = Math.max(p.best_streak, p.current_streak);
    p.last_played_date = t;

    // Rolling 30-day log for daily challenge tracking
    p.daily_played_dates = [
      ...p.daily_played_dates.filter(d => d >= this.thirtyDaysAgo()),
      t,
    ];
  }

  private thirtyDaysAgo(): string {
    return new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  }

  /** Returns IDs of newly unlocked milestones (not yet in profile.unlocked_titles). */
  private checkMilestones(p: PlayerProfileDTO, run: RunResultDTO): string[] {
    const newlyUnlocked: string[] = [];
    for (const m of ALL_MILESTONES) {
      if (!p.unlocked_titles.includes(m.id) && m.check(p, run)) {
        newlyUnlocked.push(m.id);
      }
    }
    return newlyUnlocked;
  }

  private save(profile: PlayerProfileDTO): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('[LocalProfileService] save failed:', e);
    }
  }

  // ── Static validation helper (used by NameEntryScene) ─────────────────────

  static validateName(raw: string): string | null {
    const name = raw.trim();
    if (name.length < 2)  return 'Name must be at least 2 characters';
    if (name.length > 16) return 'Name cannot exceed 16 characters';
    if (!/^[a-zA-Z0-9 \-']+$/.test(name))
      return 'Letters, numbers, spaces, hyphens and apostrophes only';
    if (BLOCKED_NAMES.has(name.toLowerCase())) return 'Please choose a different name';
    return null;  // valid
  }
}
