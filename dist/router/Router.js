/**
 * Router.ts — Client-side screen router for the HTML UI layer.
 *
 * Routes:
 *   home          → HomeScreen
 *   class-select  → ClassSelectScreen   (params: modeId)
 *   combat        → (no HTML screen — shows Phaser canvas)
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
        // Show/hide Phaser canvas
        this.canvasMount.classList.toggle('is-hidden', !isCombat);
        // Show/hide HUD
        this.hudRoot.classList.toggle('is-active', isCombat);
        // Mount screen element
        const factory = this.screens.get(entry.name);
        const el = factory
            ? factory(entry.params)
            : this.placeholderScreen(entry.name);
        // Clear previous screen
        while (this.screenRoot.firstChild) {
            this.screenRoot.removeChild(this.screenRoot.firstChild);
        }
        // Combat route shows nothing in screen-root (canvas is visible)
        if (!isCombat) {
            this.screenRoot.appendChild(el);
        }
    }
    placeholderScreen(name) {
        const div = document.createElement('div');
        div.className = 'screen-placeholder';
        div.textContent = name.toUpperCase().replace(/-/g, ' ');
        div.style.cssText = `pointer-events: auto;`;
        return div;
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
