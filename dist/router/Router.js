/**
 * Router.ts — Client-side screen router for the HTML UI layer.
 *
 * Routes:
 *   home          → HomeScreen
 *   class-select  → ClassSelectScreen   (params: modeId)
 *   combat        → (no HTML screen — shows Phaser canvas)
 *   shop          → ShopScreen
 *   leaderboard   → LeaderboardScreen
 *   stats         → StatsScreen
 *   settings      → SettingsScreen
 *   name-entry    → NameEntryScreen
 *
 * The router mounts one screen at a time into #screen-root.
 * It shows/hides #canvas-mount based on whether the active route is 'combat'.
 *
 * Usage:
 *   import { router } from '../router/Router';
 *   router.navigate('class-select', { modeId: 'classic' });
 *   router.back();
 */
// ---------------------------------------------------------------------------
// Router class
// ---------------------------------------------------------------------------
class Router {
    constructor() {
        this.history = [];
        this.current = null;
        this.screens = new Map();
        this.listeners = [];
    }
    /**
     * Initialise the router. Call once from main.ts after the DOM is ready.
     */
    init() {
        this.screenRoot = document.getElementById('screen-root');
        this.canvasMount = document.getElementById('canvas-mount');
        this.hudRoot = document.getElementById('hud-root');
        if (!this.screenRoot || !this.canvasMount || !this.hudRoot) {
            console.error('[Router] Required DOM elements not found. Check index.html.');
        }
    }
    /**
     * Register a screen factory for a route.
     * Call this before navigate() for any route that needs a real screen.
     */
    register(name, factory) {
        this.screens.set(name, factory);
    }
    /**
     * Navigate to a named route, optionally with params.
     * Pushes the current route onto the history stack first.
     */
    navigate(name, params = {}) {
        if (this.current) {
            this.history.push(this.current);
        }
        this.current = { name, params: params };
        this.mount(this.current);
        this.notifyListeners(this.current);
    }
    /**
     * Go back to the previous route. No-op if history is empty.
     */
    back() {
        const prev = this.history.pop();
        if (!prev)
            return;
        this.current = prev;
        this.mount(this.current);
        this.notifyListeners(this.current);
    }
    /**
     * Replace the current route without adding to history.
     * Use for redirects (e.g. first-launch name entry).
     */
    replace(name, params = {}) {
        this.current = { name, params: params };
        this.mount(this.current);
        this.notifyListeners(this.current);
    }
    /** Get the current active route (or null before first navigate). */
    getCurrent() {
        return this.current;
    }
    /** Subscribe to route changes. Returns an unsubscribe function. */
    onChange(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    // ── Private ──────────────────────────────────────────────────────────────
    mount(entry) {
        const isCombat = entry.name === 'combat';
        const factory = this.screens.get(entry.name);
        const hasScreen = Boolean(factory);
        // Hide the Phaser canvas only when a real HTML screen is registered for
        // this route, OR when navigating to combat (canvas must be visible there).
        // During migration (M1–M5), routes have no factory yet, so the canvas
        // stays visible and Phaser scenes continue to run normally.
        if (isCombat) {
            // Combat: show canvas, activate HUD
            this.canvasMount.classList.remove('is-hidden');
            this.hudRoot.classList.add('is-active');
        }
        else if (hasScreen) {
            // Real HTML screen registered: hide canvas, deactivate HUD
            this.canvasMount.classList.add('is-hidden');
            this.hudRoot.classList.remove('is-active');
        }
        else {
            // Migration mode: no factory registered → keep canvas visible, no HUD
            this.canvasMount.classList.remove('is-hidden');
            this.hudRoot.classList.remove('is-active');
        }
        // Clear previous screen content from screen-root
        while (this.screenRoot.firstChild) {
            this.screenRoot.removeChild(this.screenRoot.firstChild);
        }
        // Mount HTML screen only if a factory exists for this route.
        // No placeholder screens — during migration Phaser scenes show through.
        if (hasScreen && !isCombat) {
            const el = factory(entry.params);
            this.screenRoot.appendChild(el);
        }
    }
    notifyListeners(entry) {
        for (const listener of this.listeners) {
            listener(entry);
        }
    }
}
// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------
/** The single shared router instance. Import and use directly. */
export const router = new Router();
