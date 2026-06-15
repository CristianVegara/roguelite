const SAVE_KEY = 'roguelite_runs_v1';
const MAX_RUNS = 50; // cap to avoid localStorage bloat
const SCHEMA_VERSION = 1;
export class LocalRunHistoryService {
    addRun(run) {
        const history = this.load();
        // Newest first
        history.unshift(run);
        if (history.length > MAX_RUNS)
            history.length = MAX_RUNS;
        this.save(history);
    }
    getRecentRuns(limit = 20) {
        return this.load().slice(0, limit);
    }
    clear() {
        localStorage.removeItem(SAVE_KEY);
    }
    // ── Private ─────────────────────────────────────────────────────────────────
    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw)
                return [];
            const stored = JSON.parse(raw);
            if (stored.schema_version !== SCHEMA_VERSION)
                return [];
            return stored.runs ?? [];
        }
        catch {
            return [];
        }
    }
    save(runs) {
        try {
            const stored = { schema_version: SCHEMA_VERSION, runs };
            localStorage.setItem(SAVE_KEY, JSON.stringify(stored));
        }
        catch (e) {
            console.warn('[LocalRunHistoryService] save failed:', e);
        }
    }
}
