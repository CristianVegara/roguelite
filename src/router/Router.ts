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
// Route registry
// ---------------------------------------------------------------------------

export type RouteName =
  | 'home'
  | 'class-select'
  | 'combat'
  | 'leaderboard'
  | 'stats'
  | 'settings'
  | 'name-entry';

export interface RouteParams {
  'home':         Record<string, never>;
  'class-select': { modeId: string };
  'combat':       Record<string, never>;
  'leaderboard':  Record<string, never>;
  'stats':        Record<string, never>;
  'settings':     Record<string, never>;
  'name-entry':   Record<string, never>;
}

interface RouteEntry {
  name:   RouteName;
  params: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Screen factory type
// ---------------------------------------------------------------------------

/** A screen factory is a function that returns an HTMLElement for a given route. */
type ScreenFactory = (params: Record<string, unknown>) => HTMLElement;

// ---------------------------------------------------------------------------
// Router class
// ---------------------------------------------------------------------------

class Router {
  private screenRoot!:  HTMLElement;
  private canvasMount!: HTMLElement;
  private hudRoot!:     HTMLElement;

  private history:  RouteEntry[] = [];
  private current:  RouteEntry | null = null;

  private screens:  Map<RouteName, ScreenFactory> = new Map();
  private listeners: Array<(route: RouteEntry) => void> = [];

  /**
   * Initialise the router. Call once from main.ts after the DOM is ready.
   */
  init(): void {
    this.screenRoot  = document.getElementById('screen-root')!;
    this.canvasMount = document.getElementById('canvas-mount')!;
    this.hudRoot     = document.getElementById('hud-root')!;

    if (!this.screenRoot || !this.canvasMount || !this.hudRoot) {
      console.error('[Router] Required DOM elements not found. Check index.html.');
    }
  }

  /**
   * Register a screen factory for a route.
   * Call this before navigate() for any route that needs a real screen.
   */
  register(name: RouteName, factory: ScreenFactory): void {
    this.screens.set(name, factory);
  }

  /**
   * Navigate to a named route, optionally with params.
   * Pushes the current route onto the history stack first.
   */
  navigate<T extends RouteName>(
    name: T,
    params: RouteParams[T] = {} as RouteParams[T],
  ): void {
    if (this.current) {
      this.history.push(this.current);
    }
    this.current = { name, params: params as Record<string, unknown> };
    this.mount(this.current);
    this.notifyListeners(this.current);
  }

  /**
   * Go back to the previous route. No-op if history is empty.
   */
  back(): void {
    const prev = this.history.pop();
    if (!prev) return;
    this.current = prev;
    this.mount(this.current);
    this.notifyListeners(this.current);
  }

  /**
   * Replace the current route without adding to history.
   * Use for redirects (e.g. first-launch name entry).
   */
  replace<T extends RouteName>(
    name: T,
    params: RouteParams[T] = {} as RouteParams[T],
  ): void {
    this.current = { name, params: params as Record<string, unknown> };
    this.mount(this.current);
    this.notifyListeners(this.current);
  }

  /** Get the current active route (or null before first navigate). */
  getCurrent(): RouteEntry | null {
    return this.current;
  }

  /** Subscribe to route changes. Returns an unsubscribe function. */
  onChange(listener: (route: RouteEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private mount(entry: RouteEntry): void {
    const isCombat  = entry.name === 'combat';
    const factory   = this.screens.get(entry.name);
    const hasScreen = Boolean(factory);

    // Hide the Phaser canvas only when a real HTML screen is registered for
    // this route, OR when navigating to combat (canvas must be visible there).
    // During migration (M1–M5), routes have no factory yet, so the canvas
    // stays visible and Phaser scenes continue to run normally.
    if (isCombat) {
      // Combat: show canvas, activate HUD
      this.canvasMount.classList.remove('is-hidden');
      this.hudRoot.classList.add('is-active');
    } else if (hasScreen) {
      // Real HTML screen registered: hide canvas, deactivate HUD
      this.canvasMount.classList.add('is-hidden');
      this.hudRoot.classList.remove('is-active');
    } else {
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
      const el = factory!(entry.params);
      this.screenRoot.appendChild(el);
    }
  }

  private notifyListeners(entry: RouteEntry): void {
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
