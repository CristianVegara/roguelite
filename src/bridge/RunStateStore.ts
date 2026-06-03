/**
 * RunStateStore.ts — Observable run state shared between Phaser and HTML.
 *
 * Architecture contract:
 * - GameScene (Phaser) writes into this store via `runState.update(patch)`.
 * - HTML components (CombatHUD) subscribe via `runState.subscribe(selector, cb)`.
 * - HTML code NEVER writes to this store.
 * - Phaser code NEVER reads subscribers.
 *
 * Usage (Phaser write):
 *   import { runState } from '../bridge/RunStateStore';
 *   runState.update({ playerHp: player.stats.hp, gold: engine.gold });
 *
 * Usage (HTML read):
 *   import { runState } from '../bridge/RunStateStore';
 *   const off = runState.subscribe(s => s.playerHp, (hp) => updateBar(hp));
 *   off(); // unsubscribe
 *
 *   const snapshot = runState.get(); // synchronous read
 */

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface RunState {
  // ── Combat identifiers ───────────────────────────────────────────────────
  isRunActive:    boolean;
  floor:          number;
  isBoss:         boolean;
  modifierName:   string;   // '' if no modifier
  modifierDesc:   string;

  // ── Player ───────────────────────────────────────────────────────────────
  playerHp:       number;
  playerMaxHp:    number;
  playerLevel:    number;
  playerXp:       number;
  playerXpNeeded: number;
  className:      string;   // display name
  classId:        string;

  // ── Enemy ────────────────────────────────────────────────────────────────
  enemyHp:        number;
  enemyMaxHp:     number;
  enemyName:      string;
  enemyPoisonStacks: number;
  enemyBurnStacks:   number;

  // ── Economy ──────────────────────────────────────────────────────────────
  gold:           number;

  // ── Build ────────────────────────────────────────────────────────────────
  keystoneName:   string;   // '' if no keystone held
  keystoneId:     string;
  relicCount:     number;
  buildArchetype: string;   // e.g. 'Poison Assassin', 'Berserker', …

  // ── Upgrade category breakdown (for Build Fingerprint) ──────────────────
  categoryBreakdown: Record<string, number>;  // category → total stacks

  // ── Speed ────────────────────────────────────────────────────────────────
  gameSpeed:      1 | 1.5 | 2;

  // ── Meta ─────────────────────────────────────────────────────────────────
  modeId:         string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_STATE: RunState = {
  isRunActive:       false,
  floor:             0,
  isBoss:            false,
  modifierName:      '',
  modifierDesc:      '',

  playerHp:          0,
  playerMaxHp:       0,
  playerLevel:       1,
  playerXp:          0,
  playerXpNeeded:    100,
  className:         '',
  classId:           '',

  enemyHp:           0,
  enemyMaxHp:        0,
  enemyName:         '',
  enemyPoisonStacks: 0,
  enemyBurnStacks:   0,

  gold:              0,

  keystoneName:      '',
  keystoneId:        '',
  relicCount:        0,
  buildArchetype:    '',
  categoryBreakdown: {},

  gameSpeed:         1,
  modeId:            '',
};

// ---------------------------------------------------------------------------
// Subscriber types
// ---------------------------------------------------------------------------

type Selector<T>   = (state: RunState) => T;
type Subscriber<T> = (value: T, prevValue: T) => void;

interface Subscription<T> {
  selector:   Selector<T>;
  subscriber: Subscriber<T>;
  lastValue:  T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySubscription = Subscription<any>;

// ---------------------------------------------------------------------------
// RunStateStore class
// ---------------------------------------------------------------------------

class RunStateStore {
  private state: RunState = { ...DEFAULT_STATE };
  private subscriptions   = new Set<AnySubscription>();

  // ── Write (Phaser only) ──────────────────────────────────────────────────

  /**
   * Merge a partial state patch and notify all affected subscribers.
   * Call this from GameScene after any state-changing operation.
   */
  update(patch: Partial<RunState>): void {
    const prev = this.state;
    this.state = { ...this.state, ...patch };
    this.notify(prev);
  }

  /**
   * Reset to default state. Call when a run ends and the player returns to hub.
   */
  reset(): void {
    const prev = this.state;
    this.state = { ...DEFAULT_STATE };
    this.notify(prev);
  }

  // ── Read (HTML and Phaser) ───────────────────────────────────────────────

  /**
   * Get a synchronous snapshot of the current state.
   */
  get(): Readonly<RunState> {
    return this.state;
  }

  /**
   * Subscribe to a derived slice of state. The callback fires immediately
   * with the current value, then whenever the selected value changes
   * (by reference equality for objects, strict equality for primitives).
   *
   * Returns an unsubscribe function.
   *
   * @example
   *   const off = runState.subscribe(s => s.playerHp, (hp) => bar.style.width = hp + 'px');
   *   off(); // stop listening
   */
  subscribe<T>(selector: Selector<T>, subscriber: Subscriber<T>): () => void {
    const sub: Subscription<T> = {
      selector,
      subscriber,
      lastValue: selector(this.state),
    };
    this.subscriptions.add(sub as AnySubscription);

    // Fire immediately so the subscriber can set up initial DOM state
    subscriber(sub.lastValue, sub.lastValue);

    return () => this.subscriptions.delete(sub as AnySubscription);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private notify(_prev: RunState): void {
    for (const sub of this.subscriptions) {
      const newValue = sub.selector(this.state);
      if (newValue !== sub.lastValue) {
        const prevValue  = sub.lastValue;
        sub.lastValue    = newValue;
        sub.subscriber(newValue, prevValue);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** The single shared run state store. Import and use directly. */
export const runState = new RunStateStore();
