/**
 * GameEventBus.ts — Typed event emitter shared between Phaser and HTML.
 *
 * Architecture contract:
 * - GameScene (Phaser) emits events here; HTML modals/HUD listen here.
 * - HTML modals emit choice events here; GameScene listens and resumes.
 * - Neither side holds a reference to the other. This bus is the ONLY interface.
 *
 * Usage:
 *   import { bus } from '../bridge/GameEventBus';
 *   bus.emit({ type: 'upgrade:available', payload: { upgrades: [...] } });
 *   bus.on('upgrade:selected', (e) => applyUpgrade(e.payload.upgradeId));
 *   const unsub = bus.on('run:ended', handler);
 *   unsub(); // remove listener
 */

import type { UpgradeDefinition } from '../data/UpgradeDefinition';
import type { RelicDefinition }   from '../data/RelicDefinition';
import type { RunResultDTO }       from '../services/types';

// ---------------------------------------------------------------------------
// Event map — every event the bus can carry
// ---------------------------------------------------------------------------

export interface BusEvents {

  // ── Upgrade flow ──────────────────────────────────────────────────────────
  'upgrade:available': {
    upgrades:     UpgradeDefinition[];
    contextLabel: string;   // e.g. "Level 3" or "Floor 12 cleared"
    floor:        number;
  };
  'upgrade:selected': {
    upgradeId: string;
  };
  'upgrade:skipped': Record<string, never>;

  // ── Relic flow ────────────────────────────────────────────────────────────
  'relic:available': {
    relics: RelicDefinition[];
    floor:  number;
  };
  'relic:selected': {
    relicId: string;
  };
  'relic:skipped': Record<string, never>;

  // ── Merchant flow ─────────────────────────────────────────────────────────
  'merchant:available': {
    upgradeCards: UpgradeDefinition[];
    consumables:  Array<{ id: string; name: string; cost: number; effect: string }>;
    rerollCost:   number;
    floor:        number;
  };
  'merchant:purchase': {
    itemId: string;
    type:   'upgrade' | 'consumable' | 'reroll';
    cost:   number;
  };
  'merchant:closed': Record<string, never>;

  // ── Combat lifecycle ──────────────────────────────────────────────────────
  'floor:cleared': {
    floor: number;
    isBoss: boolean;
  };
  'boss:killed': {
    floor:    number;
    bossName: string;
  };
  'run:ended': {
    result: RunResultDTO;
  };

  // ── HUD controls (HTML → Phaser) ─────────────────────────────────────────
  /** HTML speed buttons emit this; GameScene listens and calls setGameSpeed(). */
  'speed:change': { speed: 1 | 1.5 | 2 };

  // ── Navigation ────────────────────────────────────────────────────────────
  'run:start-requested': Record<string, never>;  // HTML → Phaser to begin
  'run:return-to-hub':   Record<string, never>;  // HTML → app shell

}

export type BusEventType    = keyof BusEvents;
export type BusEventPayload = BusEvents[BusEventType];

// ---------------------------------------------------------------------------
// Internal envelope
// ---------------------------------------------------------------------------

type BusMessage<T extends BusEventType> = {
  type:    T;
  payload: BusEvents[T];
};

type ListenerFn<T extends BusEventType> = (msg: BusMessage<T>) => void;

// ---------------------------------------------------------------------------
// GameEventBus class
// ---------------------------------------------------------------------------

class GameEventBus {
  private listeners = new Map<BusEventType, Set<ListenerFn<BusEventType>>>();

  /**
   * Subscribe to an event type. Returns an unsubscribe function.
   *
   * @example
   *   const off = bus.on('upgrade:available', (e) => openModal(e.payload));
   *   // later:
   *   off();
   */
  on<T extends BusEventType>(
    type: T,
    listener: ListenerFn<T>,
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    // Cast is safe: the Set is keyed by type T
    const set = this.listeners.get(type)! as Set<ListenerFn<T>>;
    set.add(listener);
    return () => set.delete(listener);
  }

  /**
   * Subscribe to an event type for one invocation only. Auto-unsubscribes.
   */
  once<T extends BusEventType>(
    type: T,
    listener: ListenerFn<T>,
  ): () => void {
    const unsub = this.on(type, (msg) => {
      unsub();
      listener(msg);
    });
    return unsub;
  }

  /**
   * Emit an event. Synchronously calls all registered listeners.
   *
   * @example
   *   bus.emit({ type: 'floor:cleared', payload: { floor: 5, isBoss: false } });
   */
  emit<T extends BusEventType>(msg: { type: T; payload: BusEvents[T] }): void {
    const set = this.listeners.get(msg.type);
    if (!set) return;
    // Snapshot to avoid mutation-during-iteration bugs
    for (const listener of [...set]) {
      (listener as ListenerFn<T>)(msg as BusMessage<T>);
    }
  }

  /**
   * Remove all listeners. Call on scene/screen teardown to prevent leaks.
   */
  off<T extends BusEventType>(type: T, listener: ListenerFn<T>): void {
    const set = this.listeners.get(type) as Set<ListenerFn<T>> | undefined;
    set?.delete(listener);
  }

  /** Remove every listener for every event type. Use sparingly. */
  clear(): void {
    this.listeners.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** The single shared event bus instance. Import and use directly. */
export const bus = new GameEventBus();
