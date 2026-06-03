/**
 * XPManager — experience and leveling system.
 *
 * Design goals:
 *   • Enemies grant XP proportional to their power (floor-scaled).
 *   • Player levels up on XP thresholds — no automatic floor-every-3 upgrade.
 *   • Each level-up grants an upgrade choice.
 *   • Boss kills also grant an upgrade (independent of level-up).
 *   • The level-up UI fires via a callback so GameScene remains the
 *     authority on when UpgradeScene is launched.
 *
 * XP curve:
 *   Level N requires:  BASE_XP * (N ^ EXPONENT)  cumulative XP.
 *   Defaults: BASE_XP = 60, EXPONENT = 1.45 → level progression:
 *     Lv 1 → 60  Lv 2 → 170  Lv 3 → 330  Lv 4 → 540  Lv 5 → 800
 *     Lv 10 → 2600  Lv 20 → 8900  …
 *   This is deliberately flat early (levels 1-5 happen quickly) then
 *   stretches out — keeping pace with floor progression.
 *
 * XP per kill:
 *   Base = floor * 12.  Boss = floor * 40.
 *   Both values are exposed as overrideable constants for easy tuning.
 */

const BASE_XP        = 60;
const XP_EXPONENT    = 1.45;
const XP_PER_KILL    = 12;    // multiplied by floor number
const XP_PER_BOSS    = 40;    // multiplied by floor number

/** XP required to reach level (n+1) from the start. Cached on first use. */
const _threshold_cache: number[] = [];

function xpForLevel(level: number): number {
  if (_threshold_cache[level] !== undefined) return _threshold_cache[level];
  const v = Math.floor(BASE_XP * Math.pow(level, XP_EXPONENT));
  _threshold_cache[level] = v;
  return v;
}

/** Total cumulative XP needed to be AT level `level` (just reached it). */
function cumulativeXPForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l <= level; l++) total += xpForLevel(l);
  return total;
}

// ---------------------------------------------------------------------------

export interface XPManagerState {
  xp:    number;   // total XP earned this run
  level: number;   // current level (starts at 0 — first level-up reaches 1)
}

export class XPManager {
  private xp    = 0;
  private level = 0;
  // Track total XP needed to reach next level
  private nextThreshold = xpForLevel(1);  // XP required to reach level 1

  /** Callback fired whenever the player gains a level. */
  onLevelUp?: () => void;

  get currentLevel(): number { return this.level; }
  get currentXP():    number { return this.xp; }
  get xpToNextLevel(): number {
    return Math.max(0, this.nextThreshold - this.xp);
  }
  /** 0–1 progress toward the next level threshold. */
  get xpProgress(): number {
    // XP at the START of the current level
    const prev = this.level === 0 ? 0 : cumulativeXPForLevel(this.level);
    const span = this.nextThreshold - prev;
    if (span <= 0) return 1;
    return Math.min(1, (this.xp - prev) / span);
  }

  /**
   * Award XP for a normal enemy kill.
   * @param floor  Current floor number (1-based).
   * @returns      true if a level-up occurred.
   */
  killXP(floor: number): boolean {
    return this.addXP(floor * XP_PER_KILL);
  }

  /**
   * Award XP for a boss kill.
   * @param floor  Current floor number (1-based).
   * @returns      true if a level-up occurred.
   */
  bossXP(floor: number): boolean {
    return this.addXP(floor * XP_PER_BOSS);
  }

  private addXP(amount: number): boolean {
    this.xp += amount;
    if (this.xp >= this.nextThreshold) {
      this.level++;
      // Compute the new threshold (XP needed to reach *next* level after this one)
      this.nextThreshold = cumulativeXPForLevel(this.level + 1);
      this.onLevelUp?.();
      return true;
    }
    return false;
  }

  getState(): XPManagerState {
    return { xp: this.xp, level: this.level };
  }
}
