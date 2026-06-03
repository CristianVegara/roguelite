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
// ---------------------------------------------------------------------------
// GameEventBus class
// ---------------------------------------------------------------------------
class GameEventBus {
    constructor() {
        this.listeners = new Map();
    }
    /**
     * Subscribe to an event type. Returns an unsubscribe function.
     *
     * @example
     *   const off = bus.on('upgrade:available', (e) => openModal(e.payload));
     *   // later:
     *   off();
     */
    on(type, listener) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        // Cast is safe: the Set is keyed by type T
        const set = this.listeners.get(type);
        set.add(listener);
        return () => set.delete(listener);
    }
    /**
     * Subscribe to an event type for one invocation only. Auto-unsubscribes.
     */
    once(type, listener) {
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
    emit(msg) {
        const set = this.listeners.get(msg.type);
        if (!set)
            return;
        // Snapshot to avoid mutation-during-iteration bugs
        for (const listener of [...set]) {
            listener(msg);
        }
    }
    /**
     * Remove all listeners. Call on scene/screen teardown to prevent leaks.
     */
    off(type, listener) {
        const set = this.listeners.get(type);
        set?.delete(listener);
    }
    /** Remove every listener for every event type. Use sparingly. */
    clear() {
        this.listeners.clear();
    }
}
// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------
/** The single shared event bus instance. Import and use directly. */
export const bus = new GameEventBus();
